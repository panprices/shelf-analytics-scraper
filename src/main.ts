import {scrapeCategoryPage} from "./trademax.js";
import {CrawlerFactory} from "./crawlers/factory.js";
import {CustomRequestQueue} from "./custom_request_queue";
import {log} from "crawlee";

const targetUrl = 'https://www.trademax.se/utem%C3%B6bler/utestolar-tr%C3%A4dg%C3%A5rdsstolar/solstolar/d%C3%A4ckstol'

const parsedTargetUrl = new URL(targetUrl)
const rootUrl = `${parsedTargetUrl.protocol}//${parsedTargetUrl.host}`

const crawler = await CrawlerFactory.buildCrawlerForRootUrl(rootUrl, {
    headless: false
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
