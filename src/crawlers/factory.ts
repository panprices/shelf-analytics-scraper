import {log, PlaywrightCrawler, PlaywrightCrawlerOptions} from "crawlee";
import {CustomRequestQueue} from "../custom_request_queue.js";
import {HomeroomCrawlerDefinition} from "./custom/homeroom.js";

/**
 * This class knows which crawler to create depending on the root URL that is being targeted.
 *
 * As more sources are being added they should be added here as well, so we keep this one class as a central point
 * to interact with the various sources.
 */
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