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

export interface CustomQueueSettings {
    captureLabels: string[]
}

/**
 * A custom implementation of crawlee's `RequestQueue`
 *
 * We withold pages with labels included in the `captureLabels` field and keep them to synchronize later to our services,
 * so we can start other crawlers to handle them. This is done for 2 reasons:
 * - we execute the crawlers on Google Cloud Run, which has a time limit of 10 minutes, so we need to restrict the
 * work done by a single worker
 * - we want to scale and schedule the crawling with ease. We want to spread the work across different workers and also
 * spread the crawling in time to avoid our traffic becoming an issue for the website we crawl
 */
export class CustomRequestQueue extends RequestQueue {
    inWaitQueue: RequestQueue
    syncedQueue: RequestQueue

    private readonly captureLabels: string[]

    constructor(options: RequestQueueOptions,
                inWaitQueue: RequestQueue,
                syncedQueue: RequestQueue,
                config?: Configuration,
                customSettings?: CustomQueueSettings) {
        super(options, config);

        this.inWaitQueue = inWaitQueue
        this.syncedQueue = syncedQueue

        this.captureLabels = customSettings ? customSettings.captureLabels: ["DETAIL"]
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
        /**
         * We only care about overriding the normal behaviour for pages with a capture label
         */
        if (requestLike.label && !this.captureLabels.includes(requestLike.label)) {
            return result
        }

        /**
         * Add the request to the secondary `inWaitQueue` and remove it from the primary queue.
         *
         * Elements in the `inWaitQueue` will be later sent to the server for scheduling, we remove it from the primary
         * queue to prevent the current crawler from processing it
         */
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
            const label = request instanceof Request ? request.userData.label: (<RequestOptions> request).label
            if (label && !this.captureLabels.includes(label)) {
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

    /**
     * Check if the request identified by `uniqueKey` is already part of the queues managed by the current object
     * @param uniqueKey
     */
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

    static override async open(
        queueIdOrName?: string | null,
        options: StorageManagerOptions = {},
        customSettings?: CustomQueueSettings,
    ): Promise<RequestQueue> {
        await purgeDefaultStorages();
        const manager = StorageManager.getManager(RequestQueue, options.config);

        const wrappedQueue: RequestQueue = await manager.openStorage(queueIdOrName);

        /**
         * The prefix `__CRAWLEE_TEMPORARY_` tells crawlee that we want these datasets to be purged (deleted) at the
         * beginning of every run.
         */
        const inWaitQueue = await RequestQueue.open("__CRAWLEE_TEMPORARY_inWaitQueue", options)
        const syncedQueue = await RequestQueue.open("__CRAWLEE_TEMPORARY_syncedQueue", options)

        return new CustomRequestQueue({
            client: Configuration.getStorageClient(),
            id: wrappedQueue.id,
            name: wrappedQueue.name
        },
        inWaitQueue, syncedQueue, undefined, customSettings)
    }
}