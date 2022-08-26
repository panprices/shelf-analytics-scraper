import {
    Dictionary,
    QueueOperationInfo,
    RequestOptions,
    Request,
    RequestQueue,
    RequestQueueOperationOptions,
    StorageManager,
    Configuration, RequestQueueOptions, StorageManagerOptions, purgeDefaultStorages
} from "crawlee";
import {BatchAddRequestsResult} from "@crawlee/types";


export class CustomRequestQueue extends RequestQueue {
    requestsToSchedule: Map<string, string> = new Map<string, string>()

    override async addRequest(
        requestLike: Request | RequestOptions,
        options?: RequestQueueOperationOptions): Promise<QueueOperationInfo> {

        const result = await super.addRequest(requestLike, options);
        if (requestLike.label !== 'DETAIL') {
            return result
        }

        const registeredRequest = (await this.client.getRequest(result.requestId)) as unknown as RequestOptions
        this.requestsToSchedule.set(result.uniqueKey, registeredRequest.url)
        await this.client.deleteRequest(result.requestId)
        this.log.info(`Cached individual url for later processing: ${requestLike.url}`)

        return result
    }

    override async addRequests(
        requestsLike: (Request | RequestOptions)[],
        options: RequestQueueOperationOptions = {},
    ): Promise<BatchAddRequestsResult> {
        const result = await super.addRequests(requestsLike, options);

        for(const unprocessed of result.processedRequests) {
            if (this.requestsToSchedule.has(unprocessed.uniqueKey)) {
                continue
            }

            const request = requestsLike.filter(r => r.uniqueKey == unprocessed.uniqueKey)[0]
            if (
                (request instanceof Request && request.userData.label !== 'DETAIL') &&
                (<RequestOptions> request).label !== 'DETAIL'
            ) {
                continue
            }

            this.requestsToSchedule.set(unprocessed.uniqueKey, request.url)
            await this.client.deleteRequest(unprocessed.requestId)
            this.log.info(`Cached part of batch url for later processing: ${request.url}`)
        }

        return result
    }

    static override async open(queueIdOrName?: string | null, options: StorageManagerOptions = {}): Promise<RequestQueue> {
        await purgeDefaultStorages();
        const manager = StorageManager.getManager(RequestQueue, options.config);

        const wrappedQueue: RequestQueue = await manager.openStorage(queueIdOrName);
        return new CustomRequestQueue({
            client: Configuration.getStorageClient(),
            id: wrappedQueue.id,
            name: wrappedQueue.name
        })
    }
}