import {
  CheerioCrawler,
  CheerioCrawlerOptions,
  log,
  PlaywrightCrawler,
  PlaywrightCrawlerOptions,
  PlaywrightCrawlingContext,
  PlaywrightGotoOptions,
  PlaywrightHook,
  ProxyConfiguration,
  RequestQueue,
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
  CrawlerDefinition,
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
import { extractDomainFromUrl } from "../utils";
import { ChilliCheerioCrawlerDefinition } from "./custom/chilli-cheerio";
import { EllosCrawlerDefinition } from "./custom/ellos";
import { TrendrumCrawlerDefinition } from "./custom/trendrum";
import { Route } from "playwright-core";
import { Furniture1CrawlerDefinition } from "./custom/furniture1";
import { FinnishDesignShopCrawlerDefinition } from "./custom/finnishdesignshop";
import { LannaMoblerCrawlerDefinition } from "./custom/lannamobler";
import { NordiskaGallerietCrawlerDefinition } from "./custom/nordiskagalleriet";
import { AmazonCrawlerDefinition } from "./custom/amazon";
import { WayfairCrawlerDefinition } from "./custom/wayfair";

export interface CrawlerFactoryArgs {
  domain: string;
  type: "scrapeDetails" | "categoryExploration" | "search";
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
  static async buildPlaywrightCrawler(
    args: CrawlerFactoryArgs,
    overrides?: PlaywrightCrawlerOptions,
    launchOptions?: CrawlerLaunchOptions
  ): Promise<[PlaywrightCrawler, AbstractCrawlerDefinition]> {
    if (args.useCustomQueue === undefined) {
      // use custom queue by default
      args.useCustomQueue = true;
    }

    const domain = args.domain;
    const requestQueue = args.useCustomQueue
      ? await CustomRequestQueue.open(
          "__CRAWLEE_TEMPORARY_rootQueue_" + uuidv4(),
          {},
          args.customQueueSettings
        )
      : await RequestQueue.open("__CRAWLEE_TEMPORARY_rootQueue_" + uuidv4());

    const defaultOptions: PlaywrightCrawlerOptions = {
      requestQueue,
      browserPoolOptions: {
        retireBrowserAfterPageCount: 20,
        preLaunchHooks: [
          async (_ctx) => {
            log.info("Launching new browser");
          },
        ],
      },
      useSessionPool: false,
      autoscaledPoolOptions: {
        autoscaleIntervalSecs: 300,
        loggingIntervalSecs: 300,
      },
      headless: true,
      maxRequestsPerMinute: 60,
      maxConcurrency: 4,
      maxRequestRetries: 2,
      navigationTimeoutSecs: 150,
      launchContext: {
        userDataDir: CHROMIUM_USER_DATA_DIR,
      },
      ...overrides,
      preNavigationHooks: [
        ...(overrides?.preNavigationHooks ?? []),
        async (ctx) => {
          ctx.page.setDefaultTimeout(20000);
          log.info("Proxy Info", { proxy: ctx.proxyInfo || null });
        },
      ],
      postNavigationHooks: [
        async (ctx) => {
          log.info("Request finished", {
            requestUrl: ctx.request.url,
            url: ctx.page.url(),
            responseStatusCode: ctx.response?.status() || null,
            proxy: ctx.proxyInfo?.hostname || null,
            sessionId: ctx.proxyInfo?.sessionId || null,
          });
        },
      ],
    };

    const blockImagesAndScriptsHooks: PlaywrightHook[] = [
      async ({ page }) => {
        await page.route("**/*", (route) => {
          const base64Image =
            "data:image/png;base64," +
            "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAA9ElEQVQ4jWP4//8/" +
            "AyWMyvIyMDAwMDCzMDAwMDCzMDAwMDCzMDAwMDCzMDAwMDCzMDAwMDCzMDAwMDCzMDAwMDCzMDAwMDCzMDAwMDCzMDAwMDCzMDAwMDCz" +
            "MDAwMDCzMDAwMDCzMDAwMDAwoJjKUEl6AEmU6zQAe3/8nGxjKQNsbMDEyM///n19nJpMjR9zVlZUDcwufmBoKkCGxkA/" +
            "g+VHlpDQACAKrE1fJ5eYZMAAAAASUVORK5CYII=";

          return route.request().resourceType() === "image"
            ? route.fulfill({
                contentType: "image/png",
                body: Buffer.from(base64Image.split(",")[1], "base64"),
              })
            : route.continue();
        });

        Promise.all(
          [
            "https://www.googletagmanager.com",
            "https://cdn.cookielaw.org",
            "https://gtm.hfnordic.com/gtm.js",
            "https://www.google-analytics.com",
            "https://www.google.com",
          ].map(
            async (domain) =>
              await page.route(`${domain}/**`, (route: Route) => route.abort())
          )
        );
      },
    ];

    let definition: AbstractCrawlerDefinition,
      options: PlaywrightCrawlerOptions;
    switch (domain) {
      case "homeroom.se":
        definition = await HomeroomCrawlerDefinition.create(launchOptions);
        // Would be nice to use pattern matching here instead of this if:
        if (args.type === "categoryExploration") {
          options = {
            ...defaultOptions,
            maxConcurrency: 5,
            requestHandler: definition.router,
          };
        } else {
          options = {
            ...defaultOptions,
            maxConcurrency: 2, // homeroom/ellos is laggy when opening many pages at once
            requestHandler: definition.router,
          };
        }
        return [new PlaywrightCrawler(options), definition];
      case "ellos.se":
        definition = await EllosCrawlerDefinition.create(launchOptions);
        if (args.type === "categoryExploration") {
          options = {
            ...defaultOptions,
            // maxConcurrency: 5, unlike homeroom, ellos doesn't support category scraping with multiple tabs
            requestHandler: definition.router,
            proxyConfiguration: proxyConfiguration.DE,
          };
        } else {
          options = {
            ...defaultOptions,
            maxConcurrency: 2, // homeroom/ellos is laggy when opening many pages at once
            requestHandler: definition.router,
            proxyConfiguration: proxyConfiguration.DE,
          };
        }
        return [new PlaywrightCrawler(options), definition];
      case "venturedesign.se":
        definition = await VentureDesignCrawlerDefinition.create(launchOptions);
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
          preNavigationHooks: [
            ...(defaultOptions.preNavigationHooks as PlaywrightHook[]),
            ...blockImagesAndScriptsHooks,
          ],
        };
        return [new PlaywrightCrawler(options), definition];
      case "nordiskarum.se":
        definition = await NordiskaRumCrawlerDefinition.create(launchOptions);
        options = {
          ...defaultOptions,
          maxConcurrency: 5,
          requestHandler: definition.router,
        };
        return [new PlaywrightCrawler(options), definition];
      case "k-rauta.se":
        definition = await KrautaCrawlerDefinition.create(launchOptions);
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
        };
        return [new PlaywrightCrawler(options), definition];
      case "bygghemma.se":
        definition = await BygghemmaCrawlerDefinition.create(launchOptions);
        options = {
          ...defaultOptions,
          preNavigationHooks: [
            ...(defaultOptions.preNavigationHooks as PlaywrightHook[]),
            async (
              _: PlaywrightCrawlingContext,
              goToOptions: PlaywrightGotoOptions
            ) => {
              goToOptions!.waitUntil = "domcontentloaded";
            },
          ],
          requestHandler: definition.router,
        };
        return [new PlaywrightCrawler(options), definition];
      case "gardenstore.se":
        definition = await GardenStoreCrawlerDefinition.create(launchOptions);
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
          proxyConfiguration: proxyConfiguration.DE,
        };
        return [new PlaywrightCrawler(options), definition];
      case "unoliving.com":
        definition = await UnolivingCrawlerDefinition.create(launchOptions);
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
          proxyConfiguration: proxyConfiguration.DE,
        };
        return [new PlaywrightCrawler(options), definition];
      case "ebuy24.dk":
        definition = await Ebuy24CrawlerDefinition.create(launchOptions);
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
          proxyConfiguration: proxyConfiguration.DE,
        };
        return [new PlaywrightCrawler(options), definition];
      case "trademax.se":
        definition = await TrademaxCrawlerDefinition.create(launchOptions);
        options = {
          ...defaultOptions,
          maxConcurrency: 5,
          requestHandler: definition.router,
          // proxyConfiguration: proxyConfiguration.SE,
          preNavigationHooks: [
            ...(defaultOptions.preNavigationHooks as PlaywrightHook[]),
            ...blockImagesAndScriptsHooks,
          ],
        };
        return [new PlaywrightCrawler(options), definition];
      case "chilli.se":
        definition = await ChilliCrawlerDefinition.create(launchOptions);
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
          // proxyConfiguration: proxyConfiguration.SE,
          preNavigationHooks: [
            ...(defaultOptions.preNavigationHooks as PlaywrightHook[]),
            ...blockImagesAndScriptsHooks,
          ],
        };
        return [new PlaywrightCrawler(options), definition];
      case "furniturebox.se":
        definition = await FurnitureboxCrawlerDefinition.create(launchOptions);
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
          // proxyConfiguration: proxyConfiguration.SE,
          preNavigationHooks: [
            ...(defaultOptions.preNavigationHooks as PlaywrightHook[]),
            ...blockImagesAndScriptsHooks,
          ],
        };
        return [new PlaywrightCrawler(options), definition];
      case "bernomobler.se":
        definition = await BernoMoblerCrawlerDefinition.create(launchOptions);
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
        };
        return [new PlaywrightCrawler(options), definition];
      case "trendrum.se":
        definition = await TrendrumCrawlerDefinition.create();
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
        };
        return [new PlaywrightCrawler(options), definition];
      case "baldai1.lt":
        definition = await Furniture1CrawlerDefinition.create(launchOptions);
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
          proxyConfiguration: proxyConfiguration.DE,
        };
        return [new PlaywrightCrawler(options), definition];
      case "finnishdesignshop.fi":
      case "finnishdesignshop.com":
        definition = await FinnishDesignShopCrawlerDefinition.create(
          launchOptions
        );
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
        };
        return [new PlaywrightCrawler(options), definition];
      case "lannamobler.se":
      case "lanna.no":
      case "lanna.fi":
        definition = await LannaMoblerCrawlerDefinition.create(launchOptions);
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
        };
        return [new PlaywrightCrawler(options), definition];
      case "nordiskagalleriet.se":
      case "nordiskagalleriet.fi":
      case "nordiskagalleriet.no":
        definition = await NordiskaGallerietCrawlerDefinition.create(
          launchOptions
        );
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
        };
        return [new PlaywrightCrawler(options), definition];
      case "amazon.de":
        definition = await AmazonCrawlerDefinition.create(launchOptions);
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
          proxyConfiguration: proxyConfiguration.DE,
        };
        return [new PlaywrightCrawler(options), definition];
      case "wayfair.de":
        definition = await WayfairCrawlerDefinition.create(launchOptions);
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
          maxConcurrency: 1, // can't scrape too quickly due to captcha
          headless: false, // wayfair will throw captcha if headless

          // Read more from the docs at https://crawlee.dev/api/core/class/SessionPool
          useSessionPool: true,
          persistCookiesPerSession: true,
          sessionPoolOptions: {
            // Only need to rotate between 10 sessions. If one is blocked
            // another will be created
            maxPoolSize: 10,
            sessionOptions: {
              maxUsageCount: 10, // rotate IPs every 10 pages
            },
            persistStateKeyValueStoreId: "wayfair_session_pool",
            // blockedStatusCodes: [], // only in dev mode - not blocking 429 so that we can see the captcha
          },
          proxyConfiguration: randomProxyConfiguration,
        };
        return [new PlaywrightCrawler(options), definition];
      // Comment to help the script understand where to add new cases
    }

    log.warning(`Asked for unknown root url: ${domain}`);
    throw Error(`Asked for unknown root url: ${domain}`);
  }

  static async buildCheerioCrawler(
    args: CrawlerFactoryArgs
  ): Promise<[CheerioCrawler, AbstractCheerioCrawlerDefinition]> {
    if (args.useCustomQueue === undefined) {
      // use custom queue by default
      args.useCustomQueue = true;
    }

    const url = args.domain;
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

    const rootUrl = extractDomainFromUrl(url);
    switch (rootUrl) {
      case "chilli.se":
      case "trademax.se":
      case "furniturebox.se":
        const definition = await ChilliCheerioCrawlerDefinition.create();
        const options: CheerioCrawlerOptions = {
          ...defaultOptions,
          requestHandler: definition.router,
          proxyConfiguration: proxyConfiguration.SE,
        };
        return [new CheerioCrawler(options), definition];
    }

    log.warning(`Asked for unknown root url: ${url}`);
    throw Error(`Asked for unknown root url: ${url}`);
  }
}

export const proxyConfiguration = {
  // Using Oxylabs proxy rotator.
  // This means that each individual request will be done by a different IP.
  DE: new ProxyConfiguration({
    proxyUrls: ["http://panprices:BB4NC4WQmx@panprices.oxylabs.io:60003"],
  }),
  SE: new ProxyConfiguration({
    proxyUrls: ["http://panprices:BB4NC4WQmx@panprices.oxylabs.io:60002"],
  }),

  // Using Crawlee's default proxy rotator.
  // This mean that each request in a session will keep the same IP.
  // Useful for Wayfair since they will block us if 1 browser session
  // is used with multiple IPs.
  SE_CRAWLEE_IP_ROTATE: new ProxyConfiguration({
    proxyUrls: [
      "103.69.158.128",
      "103.69.158.130",
      "103.69.158.131",
      "103.69.158.132",
      "103.69.158.133",
      "103.69.158.135",
      "103.69.158.136",
      "103.69.158.137",
      "103.69.158.141",
      "103.69.158.143",
      "103.69.158.145",
      "103.69.158.146",
      "103.69.158.147",
      "103.69.158.148",
      "103.69.158.150",
      "103.69.158.151",
      "103.69.158.152",
      "103.69.158.156",
      "103.69.158.158",
      "103.69.158.160",
      "103.69.158.161",
      "103.69.158.162",
      "103.69.158.163",
      "103.69.158.165",
      "103.69.158.166",
      "103.69.158.167",
      "103.69.158.168",
      "103.69.158.171",
      "103.69.158.173",
      "103.69.158.175",
      "103.69.158.176",
      "103.69.158.177",
      "103.69.158.178",
      "103.69.158.180",
      "103.69.158.181",
      "103.69.158.182",
      "103.69.158.183",
      "103.69.158.186",
      "103.69.158.188",
      "103.69.158.190",
      "103.69.158.192",
      "103.69.158.195",
      "103.69.158.196",
      "103.69.158.197",
      "103.69.158.198",
      "103.69.158.200",
      "103.69.158.201",
      "103.69.158.203",
      "103.69.158.205",
      "103.69.158.207",
    ].map((ip) => `http://panprices:BB4NC4WQmx@${ip}:60000`),
  }),
  DE_CRAWLEE_IP_ROTATE: new ProxyConfiguration({
    proxyUrls: [
      "185.228.18.101",
      "185.228.18.103",
      "185.228.18.114",
      "185.228.18.116",
      "185.228.18.118",
      "185.228.18.131",
      "185.228.18.133",
      "185.228.18.135",
      "185.228.18.146",
      "185.228.18.148",
      "185.228.18.150",
      "185.228.18.163",
      "185.228.18.165",
      "185.228.18.167",
      "185.228.18.178",
      "185.228.18.18",
      "185.228.18.180",
      "185.228.18.182",
      "185.228.18.195",
      "185.228.18.197",
      "185.228.18.199",
      "185.228.18.20",
      "185.228.18.210",
      "185.228.18.212",
      "185.228.18.214",
      "185.228.18.22",
      "185.228.18.227",
      "185.228.18.229",
      "185.228.18.231",
      "185.228.18.24",
      "185.228.18.242",
      "185.228.18.244",
      "185.228.18.246",
      "185.228.18.248",
      "185.228.18.3",
      "185.228.18.35",
      "185.228.18.37",
      "185.228.18.39",
      "185.228.18.5",
      "185.228.18.50",
      "185.228.18.52",
      "185.228.18.54",
      "185.228.18.67",
      "185.228.18.69",
      "185.228.18.7",
      "185.228.18.71",
      "185.228.18.82",
      "185.228.18.84",
      "185.228.18.86",
      "185.228.18.99",
    ].map((ip) => `http://panprices:BB4NC4WQmx@${ip}:60000`),
  }),

  TEST_IP: new ProxyConfiguration({
    proxyUrls: [
      "185.228.18.3",
      // "185.228.18.35",
      // "185.228.18.37",
      // "185.228.18.39",
    ].map((ip) => `http://panprices:BB4NC4WQmx@${ip}:60000`),
  }),

  // Deprecated. We don't use shared datacenter proxies anymore.
  // SHARED_DATACENTER_GLOBAL: new ProxyConfiguration({
  //   proxyUrls: ["http://sdcpanprices:BB4NC4WQmx@dc.pr.oxylabs.io:10000"],
  // }),
  // SHARED_DATACENTER_DE: new ProxyConfiguration({
  //   proxyUrls: ["http://sdcpanprices:BB4NC4WQmx@dc.de-pr.oxylabs.io:40000"],
  // }),
  // SHARED_DATACENTER_FR: new ProxyConfiguration({
  //   proxyUrls: ["http://sdcpanprices:BB4NC4WQmx@dc.fr-pr.oxylabs.io:42000"],
  // }),
  // SHARED_DATACENTER_UK: new ProxyConfiguration({
  //   proxyUrls: ["http://sdcpanprices:BB4NC4WQmx@dc.gb-pr.oxylabs.io:46000"],
  // }),
  // SHARED_DATACENTER_NL: new ProxyConfiguration({
  //   proxyUrls: ["http://sdcpanprices:BB4NC4WQmx@dc.nl-pr.oxylabs.io:44000"],
  // }),
};

// TODO Refactor this to make it more clean
const proxyUrls = [
  "185.228.18.101",
  "185.228.18.103",
  "185.228.18.114",
  "185.228.18.116",
  "185.228.18.118",
  "185.228.18.131",
  "185.228.18.133",
  "185.228.18.135",
  "185.228.18.146",
  "185.228.18.148",
  "185.228.18.150",
  "185.228.18.163",
  "185.228.18.165",
  "185.228.18.167",
  "185.228.18.178",
  "185.228.18.18",
  "185.228.18.180",
  "185.228.18.182",
  "185.228.18.195",
  "185.228.18.197",
  "185.228.18.199",
  "185.228.18.20",
  "185.228.18.210",
  "185.228.18.212",
  "185.228.18.214",
  "185.228.18.22",
  "185.228.18.227",
  "185.228.18.229",
  "185.228.18.231",
  "185.228.18.24",
  "185.228.18.242",
  "185.228.18.244",
  "185.228.18.246",
  "185.228.18.248",
  "185.228.18.3",
  "185.228.18.35",
  "185.228.18.37",
  "185.228.18.39",
  "185.228.18.5",
  "185.228.18.50",
  "185.228.18.52",
  "185.228.18.54",
  "185.228.18.67",
  "185.228.18.69",
  "185.228.18.7",
  "185.228.18.71",
  "185.228.18.82",
  "185.228.18.84",
  "185.228.18.86",
  "185.228.18.99",
].map((ip) => `http://panprices:BB4NC4WQmx@${ip}:60000`);

const usedProxyUrls = new Map();
const randomProxyConfiguration = new ProxyConfiguration({
  // proxyUrls,
  newUrlFunction: (sessionId) => {
    // This is based on Crawlee implementation, but assign IPs randomly
    // to sessions instead of the default of assigning sequencially
    // (1st sessionID - 1st proxy, then 2nd session - 2nd IP, and so on.)
    let customUrlToUse;
    if (!sessionId) {
      // Purely random
      return proxyUrls[Math.floor(Math.random() * proxyUrls.length)];
    }
    if (usedProxyUrls.has(sessionId)) {
      customUrlToUse = usedProxyUrls.get(sessionId);
    } else {
      customUrlToUse = proxyUrls[Math.floor(Math.random() * proxyUrls.length)];
      usedProxyUrls.set(sessionId, customUrlToUse);
    }
    return customUrlToUse;
  },
});
