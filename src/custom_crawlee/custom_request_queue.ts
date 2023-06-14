import {
  Configuration,
  getRequestId,
  purgeDefaultStorages,
  QueueOperationInfo,
  Request,
  RequestOptions,
  RequestQueue,
  RequestQueueOperationOptions,
  RequestQueueOptions,
  StorageManager,
  StorageManagerOptions,
} from "crawlee";
import { v4 as uuidv4 } from "uuid";
import { BatchAddRequestsResult } from "@crawlee/types";

export interface CustomQueueSettings {
  captureLabels: string[];
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
  inWaitQueue: RequestQueue;
  syncedQueue: RequestQueue;

  private readonly captureLabels: string[];

  constructor(
    options: RequestQueueOptions,
    inWaitQueue: RequestQueue,
    syncedQueue: RequestQueue,
    config?: Configuration,
    customSettings?: CustomQueueSettings
  ) {
    super(options, config);

    this.inWaitQueue = inWaitQueue;
    this.syncedQueue = syncedQueue;

    this.captureLabels = customSettings ? customSettings.captureLabels : [];
  }

  override async addRequest(
    requestLike: Request | RequestOptions,
    options?: RequestQueueOperationOptions
  ): Promise<QueueOperationInfo> {
    const alreadyKnownRequest = await this.checkRequestIsKnownInAnyQueue(
      <string>requestLike.uniqueKey
    );
    if (alreadyKnownRequest) {
      return {
        wasAlreadyPresent: true,
        wasAlreadyHandled: true,
        requestId: <string>requestLike.id,
        uniqueKey: <string>requestLike.uniqueKey,
      };
    }

    if (requestLike.label && this.captureLabels.includes(requestLike.label)) {
      /**
       * Add the request to the secondary `inWaitQueue` instead.
       *
       * Elements in the `inWaitQueue` will be later sent to the server for scheduling, we remove it from the primary
       * queue to prevent the current crawler from processing it
       */
      this.log.info(
        `Cached individual url for later processing: ${requestLike.url}`
      );
      const result = await this.inWaitQueue.addRequest(requestLike, options);

      return result;
    }

    // Default behavior for pages without a capture label
    const result = await super.addRequest(requestLike, options);
    return result;
  }

  override async addRequests(
    requestsLike: (Request | RequestOptions)[],
    options: RequestQueueOperationOptions = {}
  ): Promise<BatchAddRequestsResult> {
    const delegatedRequests = []; // those that should be in the inWaitQueue
    const normalRequests = []; // those that should be in the standard queue
    for (const request of requestsLike) {
      const alreadyKnownRequest = await this.checkRequestIsKnownInAnyQueue(
        <string>request.uniqueKey
      );
      if (alreadyKnownRequest) {
        continue;
      }

      if (request.label && this.captureLabels.includes(request.label)) {
        delegatedRequests.push(request);
        this.log.info(
          `Cached part of batch url for later processing: ${request.url}`
        );
      } else {
        normalRequests.push(request);
      }
    }

    const result1 = await this.inWaitQueue.addRequests(
      delegatedRequests,
      options
    );
    const result2 = await super.addRequests(normalRequests, options);

    return {
      processedRequests: result1.processedRequests.concat(
        result2.processedRequests
      ),
      unprocessedRequests: result1.unprocessedRequests.concat(
        result2.unprocessedRequests
      ),
    };
  }

  /**
   * Check if the request identified by `uniqueKey` is already part of the queues managed by the current object
   * @param uniqueKey
   */
  async checkRequestIsKnownInAnyQueue(uniqueKey: string): Promise<Boolean> {
    const cacheKey = getRequestId(uniqueKey);
    const alreadyKnownRequest = await this.syncedQueue
      .getRequest(cacheKey)
      .then(async (value: Request | null) => {
        if (value === null) {
          value = await this.inWaitQueue.getRequest(cacheKey);
        }

        return value;
      });

    return alreadyKnownRequest !== null;
  }

  static override async open(
    queueIdOrName?: string | null,
    options: StorageManagerOptions = {},
    customSettings?: CustomQueueSettings
  ): Promise<RequestQueue> {
    await purgeDefaultStorages();
    const manager = StorageManager.getManager(RequestQueue, options.config);

    const wrappedQueue: RequestQueue = await manager.openStorage(queueIdOrName);

    /**
     * The prefix `__CRAWLEE_TEMPORARY_` tells crawlee that we want these datasets to be purged (deleted) at the
     * beginning of every run.
     */
    const inWaitQueue = await RequestQueue.open(
      "__CRAWLEE_TEMPORARY_inWaitQueue_" + uuidv4(),
      options
    );
    const syncedQueue = await RequestQueue.open(
      "__CRAWLEE_TEMPORARY_syncedQueue_" + uuidv4(),
      options
    );

    return new CustomRequestQueue(
      {
        client: Configuration.getStorageClient(),
        id: wrappedQueue.id,
        name: wrappedQueue.name,
      },
      inWaitQueue,
      syncedQueue,
      undefined,
      customSettings
    );
  }
}
