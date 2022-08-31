import {log, PlaywrightCrawler, PlaywrightCrawlerOptions, RequestQueue} from "crawlee";
import {CustomRequestQueue} from "../custom_crawlee/custom_request_queue.js";
import {HomeroomCrawlerDefinition} from "./custom/homeroom.js";
import {TrademaxCrawlerDefinition} from "./custom/trademax.js";
import {AbstractCrawlerDefinition} from "./abstract";


export interface CrawlerFactoryArgs {
    url: string
    useCustomQueue?: boolean
}


/**
 * This class knows which crawler to create depending on the root URL that is being targeted.
 *
 * As more sources are being added they should be added here as well, so we keep this one class as a central point
 * to interact with the various sources.
 */
export class CrawlerFactory {
    static async buildCrawlerForRootUrl(
        args: CrawlerFactoryArgs,
        overrides?: PlaywrightCrawlerOptions
    ): Promise<[PlaywrightCrawler, AbstractCrawlerDefinition]> {
        if (args.useCustomQueue === undefined) { // use custom queue by default
            args.useCustomQueue = true
        }

        const url = args.url
        const requestQueue = args.useCustomQueue ? await CustomRequestQueue.open(): await RequestQueue.open()
        let options: PlaywrightCrawlerOptions = {
            requestQueue,
            headless: true,
            maxRequestsPerMinute: 60,
            maxConcurrency: 10,
            ...overrides
        }

        let definition
        switch (url) {
            case "https://www.homeroom.se":
                definition = await HomeroomCrawlerDefinition.create()
                options = {
                    ...options,
                    requestHandler: definition.router
                }
                return [new PlaywrightCrawler(options), definition]
            case "https://www.trademax.se":
                definition = await TrademaxCrawlerDefinition.create()
                options = {
                    ...options,
                    requestHandler: definition.router
                }
                return [new PlaywrightCrawler(options), definition]
        }

        log.warning(`Asked for unknown root url: ${url}`)
        throw Error("Asked for unknown root url: ${url}")
    }
}