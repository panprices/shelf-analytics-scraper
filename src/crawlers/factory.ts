import {
  log,
  PlaywrightCrawler,
  PlaywrightCrawlerOptions,
  playwrightUtils,
  ProxyConfiguration,
  RequestQueue,
} from "crawlee";
import {
  CustomQueueSettings,
  CustomRequestQueue,
} from "../custom_crawlee/custom_request_queue";
import { HomeroomCrawlerDefinition } from "./custom/homeroom";
import { TrademaxCrawlerDefinition } from "./custom/trademax";
import { AbstractCrawlerDefinition } from "./abstract";
import { VentureDesignCrawlerDefinition } from "./custom/venture-design";
import { NordiskaRumCrawlerDefinition } from "./custom/nordiskarum";
import { v4 as uuidv4 } from "uuid";
import { KrautaCrawlerDefinition } from "./custom/krauta";
import { BygghemmaCrawlerDefinition } from "./custom/bygghemma";
import { ChilliCrawlerDefinition } from "./custom/chilli";
import { GardenStoreCrawlerDefinition } from "./custom/gardenstore";
import { UnolivingCrawlerDefinition } from "./custom/unoliving";

export interface CrawlerFactoryArgs {
  url: string;
  useCustomQueue?: boolean;
  customQueueSettings?: CustomQueueSettings;
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
    if (args.useCustomQueue === undefined) {
      // use custom queue by default
      args.useCustomQueue = true;
    }

    const url = args.url;
    const requestQueue = args.useCustomQueue
      ? await CustomRequestQueue.open(
          "__CRAWLEE_TEMPORARY_rootQueue_" + uuidv4(),
          {},
          args.customQueueSettings
        )
      : await RequestQueue.open("__CRAWLEE_TEMPORARY_rootQueue_" + uuidv4());
    let options: PlaywrightCrawlerOptions = {
      requestQueue,
      headless: true,
      maxRequestsPerMinute: 60,
      maxConcurrency: 5,
      navigationTimeoutSecs: 150,
      ...overrides,
    };

    const proxyConfiguration = {
      DE: new ProxyConfiguration({
        proxyUrls: ["http://panprices:BB4NC4WQmx@panprices.oxylabs.io:60000"],
      }),
      UK: new ProxyConfiguration({
        proxyUrls: ["http://panprices:BB4NC4WQmx@panprices.oxylabs.io:60001"],
      }),
      SE: new ProxyConfiguration({
        proxyUrls: ["http://panprices:BB4NC4WQmx@panprices.oxylabs.io:60002"],
      }),
      DE2: new ProxyConfiguration({
        proxyUrls: ["http://panprices:BB4NC4WQmx@panprices.oxylabs.io:60003"],
      }),
      SHARED_DATACENTER: new ProxyConfiguration({
        proxyUrls: ["http://sdcpanprices:C8N3KgxrWe@dc.pr.oxylabs.io:10000"],
      }),
    };

    let definition;
    switch (url) {
      case "https://www.homeroom.se":
        definition = await HomeroomCrawlerDefinition.create();
        options = {
          ...options,
          requestHandler: definition.router,
        };
        return [new PlaywrightCrawler(options), definition];
      case "https://www.trademax.se":
        definition = await TrademaxCrawlerDefinition.create();
        options = {
          ...options,
          requestHandler: definition.router,
          proxyConfiguration: proxyConfiguration.SHARED_DATACENTER,
        };
        return [new PlaywrightCrawler(options), definition];
      case "https://www.chilli.se":
        definition = await ChilliCrawlerDefinition.create();
        options = {
          ...options,
          requestHandler: definition.router,
          proxyConfiguration: proxyConfiguration.SHARED_DATACENTER,
          // Block unnecessary requests such as loading images:
          // preNavigationHooks: [
          //   async ({ page }) => {
          //     await playwrightUtils.blockRequests(page, {
          //       urlPatterns: [".jpg", ".jpeg", ".png", ".svg", ".gif", ".woff"],
          //     });
          // },
          // ],
        };
        return [new PlaywrightCrawler(options), definition];
      case "https://www.venturedesign.se":
        definition = await VentureDesignCrawlerDefinition.create();
        options = {
          ...options,
          requestHandler: definition.router,
        };
        return [new PlaywrightCrawler(options), definition];
      case "https://www.nordiskarum.se":
        definition = await NordiskaRumCrawlerDefinition.create();
        options = {
          ...options,
          requestHandler: definition.router,
        };
        return [new PlaywrightCrawler(options), definition];
      case "https://www.k-rauta.se":
        definition = await KrautaCrawlerDefinition.create();
        options = {
          ...options,
          requestHandler: definition.router,
        };
        return [new PlaywrightCrawler(options), definition];
      case "https://www.bygghemma.se":
        definition = await BygghemmaCrawlerDefinition.create();
        options = {
          ...options,
          requestHandler: definition.router,
        };
        return [new PlaywrightCrawler(options), definition];
      case "https://www.gardenstore.se":
        definition = await GardenStoreCrawlerDefinition.create();
        options = {
          ...options,
          requestHandler: definition.router,
        };
        return [new PlaywrightCrawler(options), definition];
      case "https://unoliving.com":
        definition = await UnolivingCrawlerDefinition.create();
        options = {
          ...options,
          requestHandler: definition.router,
          proxyConfiguration: proxyConfiguration.DE,
        };
        return [new PlaywrightCrawler(options), definition];
    }

    log.warning(`Asked for unknown root url: ${url}`);
    throw Error(`Asked for unknown root url: ${url}`);
  }
}
