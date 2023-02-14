import {
  log,
  CheerioCrawler,
  PlaywrightCrawler,
  PlaywrightCrawlerOptions,
  ProxyConfiguration,
  RequestQueue,
  CheerioCrawlerOptions,
} from "crawlee";
import {
  CustomQueueSettings,
  CustomRequestQueue,
} from "../custom_crawlee/custom_request_queue";
import { HomeroomCrawlerDefinition } from "./custom/homeroom";
import { TrademaxCrawlerDefinition } from "./custom/trademax";
import {
  AbstractCheerioCrawlerDefinition,
  AbstractCrawlerDefinition,
  CrawlerLaunchOptions,
} from "./abstract";
import { VentureDesignCrawlerDefinition } from "./custom/venture-design";
import { NordiskaRumCrawlerDefinition } from "./custom/nordiskarum";
import { v4 as uuidv4 } from "uuid";
import { KrautaCrawlerDefinition } from "./custom/krauta";
import { BygghemmaCrawlerDefinition } from "./custom/bygghemma";
import { ChilliCrawlerDefinition } from "./custom/chilli";
import { GardenStoreCrawlerDefinition } from "./custom/gardenstore";
import { UnolivingCrawlerDefinition } from "./custom/unoliving";
import { Ebuy24CrawlerDefinition } from "./custom/ebuy24";
import { FurnitureboxCrawlerDefinition } from "./custom/furniturebox";
import { BernoMoblerCrawlerDefinition } from "./custom/bernomobler";
import { CHROMIUM_USER_DATA_DIR } from "../constants";
import { extractRootUrl } from "../utils";
import { ChilliCheerioCrawlerDefinition } from "./custom/chilli-cheerio";
import { EllosCrawlerDefinition } from "./custom/ellos";

export interface CrawlerFactoryArgs {
  url: string;
  useCustomQueue?: boolean;
  customQueueSettings?: CustomQueueSettings;
  ignoreVariants?: boolean;
}

/**
 * This class knows which crawler to create depending on the root URL that is being targeted.
 *
 * As more sources are being added they should be added here as well, so we keep this one class as a central point
 * to interact with the various sources.
 */

export class CrawlerFactory {
  static async buildPlaywrightCrawlerForRootUrl(
    args: CrawlerFactoryArgs,
    overrides?: PlaywrightCrawlerOptions,
    launchOptions?: CrawlerLaunchOptions
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
    const defaultOptions: PlaywrightCrawlerOptions = {
      requestQueue,
      headless: true,
      maxRequestsPerMinute: 60,
      maxConcurrency: 4,
      maxRequestRetries: 2,
      navigationTimeoutSecs: 150,
      launchContext: {
        userDataDir: CHROMIUM_USER_DATA_DIR,
      },
      ...overrides,
      // Block unnecessary requests such as loading images:
      preNavigationHooks: [
        ...(overrides?.preNavigationHooks ?? []),
        async ({ page }) => {
          page.setDefaultTimeout(20000);
        },
        // async ({ page }) => {
        //   await page.route("**/*", (route) => {
        //     return route.request().resourceType() === "image"
        //       ? route.fulfill({
        //           status: 200,
        //           body: "accept",
        //         })
        //       : route.continue();
        //   });
        // },
      ],
    };

    let definition, options;
    switch (url) {
      case "https://www.homeroom.se":
        definition = await HomeroomCrawlerDefinition.create();
        options = {
          ...defaultOptions,
          maxConcurrency: 5,
          requestHandler: definition.router,
        };
        return [new PlaywrightCrawler(options), definition];
      case "https://www.ellos.se":
        definition = await EllosCrawlerDefinition.create();
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
          proxyConfiguration: proxyConfiguration.DE,
        };
        return [new PlaywrightCrawler(options), definition];
      case "https://www.venturedesign.se":
        definition = await VentureDesignCrawlerDefinition.create();
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
        };
        return [new PlaywrightCrawler(options), definition];
      case "https://www.nordiskarum.se":
        definition = await NordiskaRumCrawlerDefinition.create();
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
        };
        return [new PlaywrightCrawler(options), definition];
      case "https://www.k-rauta.se":
        definition = await KrautaCrawlerDefinition.create();
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
        };
        return [new PlaywrightCrawler(options), definition];
      case "https://www.bygghemma.se":
        definition = await BygghemmaCrawlerDefinition.create();
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
        };
        return [new PlaywrightCrawler(options), definition];
      case "https://www.gardenstore.se":
        definition = await GardenStoreCrawlerDefinition.create();
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
          proxyConfiguration: proxyConfiguration.DE,
        };
        return [new PlaywrightCrawler(options), definition];
      case "https://unoliving.com":
        definition = await UnolivingCrawlerDefinition.create();
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
          proxyConfiguration: proxyConfiguration.DE,
        };
        return [new PlaywrightCrawler(options), definition];
      case "https://ebuy24.dk":
        definition = await Ebuy24CrawlerDefinition.create();
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
          proxyConfiguration: proxyConfiguration.DE,
        };
        return [new PlaywrightCrawler(options), definition];
      case "https://www.trademax.se":
        definition = await TrademaxCrawlerDefinition.create();
        options = {
          ...defaultOptions,
          maxConcurrency: 5,
          requestHandler: definition.router,
          proxyConfiguration: proxyConfiguration.SHARED_DATACENTER_DE,
        };
        return [new PlaywrightCrawler(options), definition];
      case "https://www.chilli.se":
        definition = await ChilliCrawlerDefinition.create();
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
          proxyConfiguration: proxyConfiguration.SHARED_DATACENTER_DE,
        };
        return [new PlaywrightCrawler(options), definition];
      case "https://www.furniturebox.se":
        definition = await FurnitureboxCrawlerDefinition.create(launchOptions);
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
          proxyConfiguration: proxyConfiguration.SHARED_DATACENTER_UK,
        };
        return [new PlaywrightCrawler(options), definition];
      case "https://bernomobler.se":
        definition = await BernoMoblerCrawlerDefinition.create();
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
        };
        return [new PlaywrightCrawler(options), definition];
    }

    log.warning(`Asked for unknown root url: ${url}`);
    throw Error(`Asked for unknown root url: ${url}`);
  }

  static async buildCheerioCrawlerForRootUrl(
    args: CrawlerFactoryArgs
  ): Promise<[CheerioCrawler, AbstractCheerioCrawlerDefinition]> {
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

    const defaultOptions: CheerioCrawlerOptions = {
      requestQueue,
      maxRequestsPerMinute: 30,
      maxRequestRetries: 2,
    };

    const rootUrl = extractRootUrl(url);
    switch (rootUrl) {
      case "https://www.chilli.se":
      case "https://www.trademax.se":
      case "https://www.furniturebox.se":
        const definition = await ChilliCheerioCrawlerDefinition.create();
        const options: CheerioCrawlerOptions = {
          ...defaultOptions,
          requestHandler: definition.router,
          proxyConfiguration: proxyConfiguration.SHARED_DATACENTER_DE,
        };
        return [new CheerioCrawler(options), definition];
    }

    log.warning(`Asked for unknown root url: ${url}`);
    throw Error(`Asked for unknown root url: ${url}`);
  }
}

const proxyConfiguration = {
  DE: new ProxyConfiguration({
    proxyUrls: ["http://panprices:BB4NC4WQmx@panprices.oxylabs.io:60003"],
  }),
  SE: new ProxyConfiguration({
    proxyUrls: ["http://panprices:BB4NC4WQmx@panprices.oxylabs.io:60002"],
  }),
  SHARED_DATACENTER_GLOBAL: new ProxyConfiguration({
    proxyUrls: ["http://sdcpanprices:BB4NC4WQmx@dc.pr.oxylabs.io:10000"],
  }),
  SHARED_DATACENTER_DE: new ProxyConfiguration({
    proxyUrls: ["http://sdcpanprices:BB4NC4WQmx@dc.de-pr.oxylabs.io:40000"],
  }),
  SHARED_DATACENTER_FR: new ProxyConfiguration({
    proxyUrls: ["http://sdcpanprices:BB4NC4WQmx@dc.fr-pr.oxylabs.io:42000"],
  }),
  SHARED_DATACENTER_UK: new ProxyConfiguration({
    proxyUrls: ["http://sdcpanprices:BB4NC4WQmx@dc.gb-pr.oxylabs.io:46000"],
  }),
};
