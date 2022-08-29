import {scrapeCategoryPage} from "./trademax.js";
import {CrawlerFactory} from "./crawlers/factory.js";
import {CustomRequestQueue} from "./custom_request_queue";
import {log} from "crawlee";

const targetUrl = 'https://www.homeroom.se/utemobler-tradgard/utesoffor-bankar/loungesoffor'

const crawler = await CrawlerFactory.buildCrawlerForRootUrl("https://www.homeroom.se/", {
    // headless: false
})
await crawler.run([{
    url: targetUrl,
    label: 'LIST'
}])

const inWaitQueue = (<CustomRequestQueue>crawler.requestQueue).inWaitQueue

while (true) {
    const request = await inWaitQueue.fetchNextRequest()
    if (request === null) {
        break
    }

    log.info(`${request.url} at index ${request.userData.popularityIndex}`)
}
