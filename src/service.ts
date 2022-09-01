import {CrawlerFactory} from "./crawlers/factory.js";
import {CustomRequestQueue} from "./custom_crawlee/custom_request_queue.js";
import {Dictionary, log, PlaywrightCrawlerOptions, RequestOptions} from "crawlee";
import {extractRootUrl} from "./utils.js";
import {BigQuery} from "@google-cloud/bigquery";
import {RequestBatch} from "./types/offer";
import {PubSub} from "@google-cloud/pubsub";


export async function exploreCategory(targetUrl: string): Promise<void> {
    const rootUrl = extractRootUrl(targetUrl)

    const [crawler, _] = await CrawlerFactory.buildCrawlerForRootUrl({url: rootUrl},{
        maxConcurrency: 1
    })
    await crawler.run([{
        url: targetUrl,
        label: 'LIST'
    }])

    const inWaitQueue = (<CustomRequestQueue>crawler.requestQueue).inWaitQueue

    const maxBatchSize = 40
    let detailedPages = []

    const pubSubClient = new PubSub();
    while (true) {
        const request = await inWaitQueue.fetchNextRequest()
        if (request === null) {
            await sendRequestBatch(pubSubClient, detailedPages)
            break
        }

        detailedPages.push({
            url: request.url,
            userData: request.userData
        })

        if (detailedPages.length >= maxBatchSize) {
            await sendRequestBatch(pubSubClient, detailedPages)
            detailedPages = []
        }
    }
}

async function sendRequestBatch(pubSubClient: PubSub, detailedPages: RequestOptions[]) {
    log.info(`Sending a request batch with ${detailedPages.length} requests`)
    const batchRequest: RequestBatch = {
        productDetails: detailedPages
    }

    try {
        const messageId = await pubSubClient
            .topic("trigger_schedule_product_scrapes")
            .publishMessage({json: batchRequest});
      log.info(`Message ${messageId} published.`);
    } catch (error) {
      log.error(`Received error while publishing: ${error}`);
    }
}

export async function extractLeafCategories(targetUrl: string) {
    const rootUrl = extractRootUrl(targetUrl)

    const [crawler, _] = await CrawlerFactory.buildCrawlerForRootUrl(
        {
            url: rootUrl,
            customQueueSettings: {
                captureLabels: ["LIST"]
            }
        },{
            maxConcurrency: 1
        }
    )
    await crawler.run([{
        url: targetUrl,
        label: 'INTERMEDIATE_CATEGORY'
    }])

    const inWaitQueue = (<CustomRequestQueue>crawler.requestQueue).inWaitQueue
    const categoryUrls = []
    while(true) {
        const nextRequest = await inWaitQueue.fetchNextRequest()
        if (!nextRequest) {
            break
        }

        categoryUrls.push(nextRequest.url)
    }

    categoryUrls.forEach(u => log.info(u))
}

export async function scrapeDetails(detailedPages: RequestOptions[],
                                    overrides?: PlaywrightCrawlerOptions,
                                    skipBigQuery: boolean = false): Promise<void> {
    if (detailedPages.length === 0) {
        return
    }

    const sampleUrl = detailedPages[0].url
    const rootUrl = extractRootUrl(sampleUrl)
    const [crawler, crawlerDefinition] = await CrawlerFactory.buildCrawlerForRootUrl({
        url: rootUrl,
        useCustomQueue: false
    }, overrides)

    await crawler.run(detailedPages)
    if (skipBigQuery) {
        return
    }

    const savedItems = await crawlerDefinition.detailsDataset.getData()
    const bigquery = new BigQuery()

    await bigquery
      .dataset("b2b_brand_product_index")
      .table("retailer_offerings")
      .insert(stringifyDeep(savedItems.items), {
          ignoreUnknownValues: true
      });
}

function stringifyDeep(items: Dictionary<any>[]): Dictionary<any>[] {
    const reduceToSimpleTypes = (e: any) => {
        const currentType = typeof e

        switch (currentType) {
            case "boolean":
            case "number":
            case "string":
                return e
            case "object":
                return JSON.stringify(e)
            default:
                return undefined
        }
    }

    return items.map(
        i => {
            for (let key in i) {
                if (Array.isArray(i[key])) {
                    i[key] = Array.from(i[key]).map(reduceToSimpleTypes)

                    continue
                }
                i[key] = reduceToSimpleTypes(i[key])
            }

            return i
        }
    )
}
