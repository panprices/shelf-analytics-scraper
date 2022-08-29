import {
    Configuration, getRequestId,
    purgeDefaultStorages,
    QueueOperationInfo,
    Request,
    RequestOptions,
    RequestQueue,
    RequestQueueOperationOptions,
    RequestQueueOptions,
    StorageManager,
    StorageManagerOptions
} from "crawlee";
import {BatchAddRequestsResult} from "@crawlee/types";


export class CustomRequestQueue extends RequestQueue {
    inWaitQueue: RequestQueue
    syncedQueue: RequestQueue

    constructor(options: RequestQueueOptions,
                inWaitQueue: RequestQueue,
                syncedQueue: RequestQueue,
                config?: Configuration) {
        super(options, config);

        this.inWaitQueue = inWaitQueue
        this.syncedQueue = syncedQueue
    }

    override async addRequest(
        requestLike: Request | RequestOptions,
        options?: RequestQueueOperationOptions): Promise<QueueOperationInfo> {

        const alreadyKnownRequest = await this.checkRequestIsKnownInAnyQueue(<string>requestLike.uniqueKey)
        if (alreadyKnownRequest) {
            return {
                wasAlreadyPresent: true,
                wasAlreadyHandled: true,
                requestId: <string>requestLike.id,
                uniqueKey: <string>requestLike.uniqueKey
            }
        }

        const result = await super.addRequest(requestLike, options);
        if (requestLike.label !== 'DETAIL') {
            return result
        }

        const registeredRequest = (await this.client.getRequest(result.requestId)) as unknown as RequestOptions
        await this.inWaitQueue.addRequest(registeredRequest)
        await this.client.deleteRequest(result.requestId)
        this.log.info(`Cached individual url for later processing: ${requestLike.url}`)

        return result
    }

    override async addRequests(
        requestsLike: (Request | RequestOptions)[],
        options: RequestQueueOperationOptions = {},
    ): Promise<BatchAddRequestsResult> {
        const result = await super.addRequests(requestsLike, options);

        const delegatedRequests = []
        for(const unprocessed of result.processedRequests) {
            const alreadyKnownRequest = await this.checkRequestIsKnownInAnyQueue(unprocessed.uniqueKey)

            if (alreadyKnownRequest) {
                continue
            }

            const request = requestsLike.filter(r => r.uniqueKey == unprocessed.uniqueKey)[0]
            if (
                (request instanceof Request && request.userData.label !== 'DETAIL') &&
                (<RequestOptions> request).label !== 'DETAIL'
            ) {
                continue
            }

            await this.client.deleteRequest(unprocessed.requestId)
            request.id = undefined
            delegatedRequests.push(request)
            this.log.info(`Cached part of batch url for later processing: ${request.url}`)
        }
        await this.inWaitQueue.addRequests(delegatedRequests)

        return result
    }

    async checkRequestIsKnownInAnyQueue(uniqueKey: string): Promise<Boolean> {
        const cacheKey = getRequestId(uniqueKey);
        const alreadyKnownRequest = await this.syncedQueue.getRequest(cacheKey)
            .then(async (value: Request | null) => {
                if (value === null) {
                    value = await this.inWaitQueue.getRequest(cacheKey)
                }

                return value
            })

        return alreadyKnownRequest !== null
    }

    static override async open(queueIdOrName?: string | null, options: StorageManagerOptions = {}): Promise<RequestQueue> {
        await purgeDefaultStorages();
        const manager = StorageManager.getManager(RequestQueue, options.config);

        const wrappedQueue: RequestQueue = await manager.openStorage(queueIdOrName);

        const inWaitQueue = await RequestQueue.open("__CRAWLEE_TEMPORARY_inWaitQueue", options)
        const syncedQueue = await RequestQueue.open("__CRAWLEE_TEMPORARY_syncedQueue", options)

        return new CustomRequestQueue({
            client: Configuration.getStorageClient(),
            id: wrappedQueue.id,
            name: wrappedQueue.name
        },
        inWaitQueue, syncedQueue)
    }
}