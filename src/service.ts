import {CrawlerFactory} from "./crawlers/factory.js";
import {CustomRequestQueue} from "./custom_crawlee/custom_request_queue.js";
import {log, RequestOptions} from "crawlee";
import {extractRootUrl} from "./utils.js";


export async function exploreCategory(targetUrl: string): Promise<void> {
    const rootUrl = extractRootUrl(targetUrl)

    const crawler = await CrawlerFactory.buildCrawlerForRootUrl({url: rootUrl},{
        maxConcurrency: 1
    })
    await crawler.run([{
        url: targetUrl,
        label: 'LIST'
    }])

    const inWaitQueue = (<CustomRequestQueue>crawler.requestQueue).inWaitQueue

    const detailedPages = []
    while (true) {
        const request = await inWaitQueue.fetchNextRequest()
        if (request === null) {
            break
        }

        detailedPages.push({
            url: request.url,
            userData: request.userData
        })
    }
    log.info(JSON.stringify(detailedPages))
}

export async function scrapeDetails(detailedPages: RequestOptions[]): Promise<void> {
    if (detailedPages.length === 0) {
        return
    }

    const sampleUrl = detailedPages[0].url
    const rootUrl = extractRootUrl(sampleUrl)
    const crawler = await CrawlerFactory.buildCrawlerForRootUrl({url: rootUrl, useCustomQueue: false})

    await crawler.run(detailedPages)
}
