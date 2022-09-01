import {CrawlerFactory} from "./crawlers/factory.js";
import {CustomRequestQueue} from "./custom_crawlee/custom_request_queue.js";
import {PlaywrightCrawlerOptions, RequestOptions} from "crawlee";
import {extractRootUrl} from "./utils.js";
import {persistProductsToDatabase, sendRequestBatch} from "./publishing";


export async function exploreCategory(targetUrl: string, overrides?: PlaywrightCrawlerOptions): Promise<void> {
    const rootUrl = extractRootUrl(targetUrl)

    const [crawler, _] = await CrawlerFactory.buildCrawlerForRootUrl({url: rootUrl},{
        ...overrides,
        maxConcurrency: 1,
        requestHandlerTimeoutSecs: 3600
    })
    await crawler.run([{
        url: targetUrl,
        label: 'LIST'
    }])

    const inWaitQueue = (<CustomRequestQueue>crawler.requestQueue).inWaitQueue

    const maxBatchSize = 40
    let detailedPages = []

    while (true) {
        const request = await inWaitQueue.fetchNextRequest()
        if (request === null) {
            await sendRequestBatch(detailedPages)
            break
        }

        detailedPages.push({
            url: request.url,
            userData: request.userData
        })
        await inWaitQueue.markRequestHandled(request)

        if (detailedPages.length >= maxBatchSize) {
            await sendRequestBatch(detailedPages)
            detailedPages = []
        }
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
            headless: false
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
    await persistProductsToDatabase(savedItems)
}