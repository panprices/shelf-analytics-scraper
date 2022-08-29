import {log, PlaywrightCrawler, PlaywrightCrawlerOptions} from "crawlee";
import {CustomRequestQueue} from "../custom_request_queue.js";
import {HomeroomCrawlerDefinition} from "./custom/homeroom.js";

export class CrawlerFactory {
    static async buildCrawlerForRootUrl(url: string,
                                        overrides?: PlaywrightCrawlerOptions): Promise<PlaywrightCrawler> {
        const requestQueue = await CustomRequestQueue.open()
        let options: PlaywrightCrawlerOptions = {
            requestQueue,
            headless: true,
            maxRequestsPerMinute: 60,
            maxConcurrency: 10,
            ...overrides
        }

        switch (url) {
            case "https://www.homeroom.se/":
                const definition = await HomeroomCrawlerDefinition.create()
                options = {
                    ...options,
                    requestHandler: definition.router
                }
                return new PlaywrightCrawler(options)
        }

        log.warning(`Asked for unknown root url: ${url}`)
        return new PlaywrightCrawler()
    }
}