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
import { v4 as uuidv4 } from "uuid";
import {
  CustomQueueSettings,
  CustomRequestQueue,
} from "../custom-crawlee/custom-request-queue.js";
import { HomeroomCrawlerDefinition } from "./custom/homeroom.js";
import { TrademaxCrawlerDefinition } from "./custom/trademax.js";
import {
  AbstractCheerioCrawlerDefinition,
  AbstractCrawlerDefinition,
  CrawlerLaunchOptions,
} from "./abstract.js";
import {
  addCachedCookiesToBrowserContext,
  newAvailableIp,
  syncBrowserCookiesToFirestore,
} from "./proxy-rotator.js";

import { VentureDesignCrawlerDefinition } from "./custom/venture-design.js";
import { NordiskaRumCrawlerDefinition } from "./custom/nordiskarum.js";
import { Route } from "playwright-core";
import { Furniture1CrawlerDefinition } from "./custom/furniture1.js";
import { FinnishDesignShopCrawlerDefinition } from "./custom/finnishdesignshop.js";
import { AmazonCrawlerDefinition } from "./custom/amazon.js";
import { WayfairCrawlerDefinition } from "./custom/wayfair.js";
import { getFirestore } from "firebase-admin/firestore";
import { KrautaCrawlerDefinition } from "./custom/krauta.js";
import { BygghemmaCrawlerDefinition } from "./custom/bygghemma.js";
import { ChilliCrawlerDefinition } from "./custom/chilli.js";
import { GardenStoreCrawlerDefinition } from "./custom/gardenstore.js";
import { UnolivingCrawlerDefinition } from "./custom/unoliving.js";
import { Ebuy24CrawlerDefinition } from "./custom/ebuy24.js";
import { FurnitureboxCrawlerDefinition } from "./custom/furniturebox.js";
import { BernoMoblerCrawlerDefinition } from "./custom/bernomobler.js";
import { extractDomainFromUrl } from "../utils.js";
import { ChilliCheerioCrawlerDefinition } from "./custom/chilli-cheerio.js";
import { EllosCrawlerDefinition } from "./custom/ellos.js";
import { TrendrumCrawlerDefinition } from "./custom/trendrum.js";
import { ConnoxCrawlerDefinition } from "./custom/connox.js";
import { NorlivingCrawlerDefinition } from "./custom/norliving.js";
import { NordlyLivingCrawlerDefinition } from "./custom/nordlyliving.js";
import { LouisPoulsenCrawlerDefinition } from "./custom/louispoulsen.js";
import { JardindecoCrawlerDefinition } from "./custom/jardindeco.js";
import { JensenCompanyCrawlerDefinition } from "./custom/jensencompany.js";
import { HMCrawlerDefinition } from "./custom/hm.js";
import { GigameubelCrawlerDefinition } from "./custom/gigameubel.js";
import { AutoCrawler } from "./auto-crawler.js";
import fs from "fs";
import { AndLightCrawlerDefinition } from "./custom/andlight.js";
import { RoyalDesignCrawlerDefinition } from "./custom/royaldesign.js";

// for the script that adds a new scraper to work properly, the last import has to be a one-liner

export interface CrawlerFactoryArgs {
  domain: string;
  type:
    | "scrapeDetails"
    | "categoryExploration"
    | "search"
    | "homepageExploration";
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
    launchOptions: CrawlerLaunchOptions,
    overrides?: PlaywrightCrawlerOptions
  ): Promise<[PlaywrightCrawler, AbstractCrawlerDefinition]> {
    if (args.useCustomQueue === undefined) {
      // use custom queue by default
      args.useCustomQueue = true;
    }

    const domain = args.domain;
    const uniqueCrawlerKey = launchOptions.uniqueCrawlerKey;
    const requestQueue = args.useCustomQueue
      ? await CustomRequestQueue.open(
          "__CRAWLEE_PANPRICES_rootQueue_" + uniqueCrawlerKey,
          {},
          args.customQueueSettings,
          uniqueCrawlerKey
        )
      : await RequestQueue.open(
          "__CRAWLEE_PANPRICES_rootQueue_" + uniqueCrawlerKey
        );

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
      maxRequestsPerMinute: 20,
      requestHandlerTimeoutSecs: 90,
      maxConcurrency: 4,
      maxRequestRetries: 2,
      navigationTimeoutSecs: 150,
      failedRequestHandler: async (ctx) => {
        // Try to save screenshot. Should not throw an error if fails to do so.
        try {
          await AbstractCrawlerDefinition.saveScreenshot(
            ctx.page,
            ctx.page.url()
          );
        } catch (saveScreenshotError) {
          log.error("Error saving screenshot", {
            url: ctx.page.url(),
            error: saveScreenshotError,
          });
        }
      },
      ...overrides,
      preNavigationHooks: [
        ...(overrides?.preNavigationHooks ?? []),
        async (ctx) => {
          ctx.page.setDefaultTimeout(20000);
        },
      ],
      postNavigationHooks: [
        async (ctx) => {
          const proxy = ctx.proxyInfo
            ? `${ctx.proxyInfo.hostname}:${ctx.proxyInfo.port}`
            : null;
          log.info("Request finished", {
            requestUrl: ctx.request.url,
            url: ctx.page.url(),
            statusCode: ctx.response?.status() || null,
            proxy: proxy,
            sessionId: ctx.session?.id || null,
            nrCookies: (await ctx.page.context().cookies(ctx.page.url()))
              .length,
          });
        },
      ],
    };

    const antiBotDetectionOptions: PlaywrightCrawlerOptions = {
      ...defaultOptions,
      maxRequestsPerMinute: 10,
      browserPoolOptions: {
        ...defaultOptions.browserPoolOptions,
        // Don't try to fool Wayfair because they send back a script to check that we didn't send
        // a gibberish fingerprint
        useFingerprints: false,
      },
      maxConcurrency: 1, // can't scrape too quickly due to captcha
      headless: false, // wayfair will throw captcha if headless

      // Read more from the docs at https://crawlee.dev/api/core/class/SessionPool
      useSessionPool: true,
      persistCookiesPerSession: true,
      sessionPoolOptions: {
        persistStateKeyValueStoreId: "KEY_VALUE_" + uuidv4(),
        maxPoolSize: 1,
        sessionOptions: {
          maxUsageCount: 10, // rotate IPs often to avoid getting blocked
        },
        blockedStatusCodes: [], // we handle the 429 error ourselves
      },

      preNavigationHooks: [
        async (ctx) =>
          await addCachedCookiesToBrowserContext(firestore, ctx, domain),
        ...(defaultOptions.preNavigationHooks ?? []),
      ],

      postNavigationHooks: [
        async (ctx) =>
          await syncBrowserCookiesToFirestore(firestore, ctx, domain),
        ...(defaultOptions.postNavigationHooks ?? []),
      ],
      proxyConfiguration: new ProxyConfiguration({
        newUrlFunction: async (_sessionId) => {
          const availableIp = await newAvailableIp(firestore, domain);
          return `http://panprices:BB4NC4WQmx@${availableIp}:60000`;
        },
      }),
    };

    const blockImagesAndScriptsHooks: PlaywrightHook[] = [
      async ({ page }) => {
        const noImageReplacer = fs.readFileSync("resources/no_image.png");

        await page.route("**/*", (route) => {
          return route.request().resourceType() === "image"
            ? route.fulfill({
                contentType: "image/png",
                body: noImageReplacer,
              })
            : route.continue();
        });

        await Promise.all(
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
    const firestore = getFirestore();

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
            requestHandlerTimeoutSecs: 600, // exploring the variant space takes a long time
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
        definition = await VentureDesignCrawlerDefinition.create({
          ...launchOptions,
          screenshotOptions: {
            waitForNetwork: true,
          },
        });
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
          failedRequestHandler: async (ctx) => {
            await AbstractCrawlerDefinition.saveScreenshot(
              ctx.page,
              ctx.page.url()
            );
          },
        };
        return [new PlaywrightCrawler(options), definition];
      case "nordiskarum.se":
        definition = await NordiskaRumCrawlerDefinition.create({
          ...launchOptions,
          screenshotOptions: {
            waitForNetwork: true,
            waitForNetworkTimeout: 10_000,
            /**
             * Nordiskarum's website doesn't show the main image anymore if the screen is under a certain width.
             *
             * When taking the screenshot playwright briefly opens the developer tools, which makes the available
             * width of the page small enough to hide the main image. The actual screenshot is taken without the
             * developer tools open, but it seems the website doesn't have enough time to recover from one state
             * to the other. By giving it a larger screen width, we make sure the main image is still visible even
             * with developer tools open.
             */
            customScreenshotResolution: { width: 1960, height: 1000 },
          },
        });
        options = {
          ...defaultOptions,
          maxConcurrency: 5,
          requestHandler: definition.router,
          requestHandlerTimeoutSecs: 300, // allow longer loading timeout for slow website
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
        definition = await UnolivingCrawlerDefinition.create({
          ...launchOptions,
          screenshotOptions: {
            waitForNetwork: true,
            waitForNetworkTimeout: 4000,
          },
        });
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
        definition = await TrademaxCrawlerDefinition.create({
          ...launchOptions,
          // Removing images step 3. Let the default screenshot function know that there are no images
          screenshotOptions: {
            hasBlockedImages: true,
          },
        });
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
          // avoid scraping too fast on products with many variants
          maxConcurrency: 1,
          maxRequestsPerMinute: 10,
          proxyConfiguration: proxyConfiguration.SE,
          preNavigationHooks: [
            ...(defaultOptions.preNavigationHooks as PlaywrightHook[]),
            ...blockImagesAndScriptsHooks, // Removing images Step 1. actual removing of images
          ],
          failedRequestHandler: async (ctx) => {
            // Removing images step 2. let the fallback screenshot function know that there are no images
            await AbstractCrawlerDefinition.saveScreenshot(
              ctx.page,
              ctx.page.url(),
              {
                hasBlockedImages: true,
              }
            );
          },
        };
        return [new PlaywrightCrawler(options), definition];
      case "chilli.se":
        definition = await ChilliCrawlerDefinition.create({
          ...launchOptions,
          screenshotOptions: {
            hasBlockedImages: true,
          },
        });
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
          // avoid scraping too fast on products with many variants
          maxConcurrency: 1,
          maxRequestsPerMinute: 10,
          proxyConfiguration: proxyConfiguration.SE,
          preNavigationHooks: [
            ...(defaultOptions.preNavigationHooks as PlaywrightHook[]),
            ...blockImagesAndScriptsHooks,
          ],
          failedRequestHandler: async (ctx) => {
            // Removing images step 2. let the fallback screenshot function know that there are no images
            await AbstractCrawlerDefinition.saveScreenshot(
              ctx.page,
              ctx.page.url(),
              {
                hasBlockedImages: true,
              }
            );
          },
        };
        return [new PlaywrightCrawler(options), definition];
      case "furniturebox.se":
        definition = await FurnitureboxCrawlerDefinition.create({
          ...launchOptions,
          screenshotOptions: {
            hasBlockedImages: true,
          },
        });
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
          // avoid scraping too fast on products with many variants
          maxConcurrency: 1,
          maxRequestsPerMinute: 10,
          proxyConfiguration: proxyConfiguration.SE,
          preNavigationHooks: [
            ...(defaultOptions.preNavigationHooks as PlaywrightHook[]),
            ...blockImagesAndScriptsHooks,
          ],
          failedRequestHandler: async (ctx) => {
            // Removing images step 2. let the fallback screenshot function know that there are no images
            await AbstractCrawlerDefinition.saveScreenshot(
              ctx.page,
              ctx.page.url(),
              {
                hasBlockedImages: true,
              }
            );
          },
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
        definition = await TrendrumCrawlerDefinition.create(launchOptions);
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
        };
        return [new PlaywrightCrawler(options), definition];
      case "baldai1.lt":
        definition = await Furniture1CrawlerDefinition.create(launchOptions);

        options = {
          ...antiBotDetectionOptions,
          launchContext: {
            ...defaultOptions.launchContext,
            launchOptions: {
              ...(defaultOptions.launchContext?.launchOptions ?? []),
              args: ["--window-size=1920,1080"],
            },
          },
          requestHandler: definition.router,
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
      case "amazon.de":
        definition = await AmazonCrawlerDefinition.create(launchOptions);
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
          proxyConfiguration: proxyConfiguration.DE,
          postNavigationHooks: [
            async (context) => {
              const cookies = await context.page.context().cookies();
              const isBrowsingFromUS =
                cookies.filter(
                  (c) => c.name === "sp-cdn" && c.value.endsWith(':US"')
                ).length > 0;

              if (!isBrowsingFromUS) {
                return;
              }

              try {
                const changeAddressButton = context.page.locator(
                  "//input[@data-action-type='SELECT_LOCATION']"
                );
                await changeAddressButton.click();

                const postalCodeInput = context.page.locator(
                  "//input[@data-action='GLUXPostalInputAction']"
                );
                await postalCodeInput.click();
                await postalCodeInput.fill("90402");

                const postalCodeUpdateButton = context.page.locator(
                  "//span[@data-action='GLUXPostalUpdateAction']/input"
                );
                await postalCodeUpdateButton.click();

                const postalCodeConfirmationButton = context.page.locator(
                  ".a-popover-footer #GLUXConfirmClose"
                );
                await postalCodeConfirmationButton.click();

                // Give the page 2 seconds to notice the change and then wait for the page to reload
                await context.page
                  .waitForTimeout(2000)
                  .then(async () =>
                    context.page.waitForLoadState("domcontentloaded")
                  );
              } catch (err) {
                log.warning("Could not change address out of US", { err });
              }
            },
          ],
        };
        return [new PlaywrightCrawler(options), definition];
      case "wayfair.de":
        definition = await WayfairCrawlerDefinition.create({
          ...launchOptions,
          screenshotOptions: { disablePageResize: true },
        });
        options = {
          ...antiBotDetectionOptions,
          launchContext: {
            ...defaultOptions.launchContext,
            launchOptions: {
              ...(defaultOptions.launchContext?.launchOptions ?? []),
              // Wayfair will like us more if we open the devtools ¯\_(ツ)_/¯
              devtools: true,
              args: ["--window-size=1920,1080"],
            },
          },
          requestHandler: definition.router,
        };
        const crawler = new PlaywrightCrawler(options);
        return [crawler, definition];
      case "connox.dk":
        definition = await ConnoxCrawlerDefinition.create(launchOptions);
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
        };
        return [new PlaywrightCrawler(options), definition];
      case "nordlyliving.dk":
        definition = await NordlyLivingCrawlerDefinition.create({
          ...launchOptions,
          shouldUseGenericCookieConsentLogic: true,
        });
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
        };
        return [new PlaywrightCrawler(options), definition];
      case "jardindeco.com":
        definition = await JardindecoCrawlerDefinition.create(launchOptions);
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
        };
        return [new PlaywrightCrawler(options), definition];
      case "jensen-company.dk":
        definition = await JensenCompanyCrawlerDefinition.create(launchOptions);
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
        };
        return [new PlaywrightCrawler(options), definition];
      case "louispoulsen.com":
        definition = await LouisPoulsenCrawlerDefinition.create(launchOptions);
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
          requestHandlerTimeoutSecs: 600, // exploring the variant space takes a long time
        };
        return [new PlaywrightCrawler(options), definition];
      case "norliving.dk":
        definition = await NorlivingCrawlerDefinition.create(launchOptions);
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
        };
        return [new PlaywrightCrawler(options), definition];
      case "hm.com":
        definition = await HMCrawlerDefinition.create(launchOptions);
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
        };
        return [new PlaywrightCrawler(options), definition];
      case "gigameubel.nl":
        definition = await GigameubelCrawlerDefinition.create(launchOptions);
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
        };
        return [new PlaywrightCrawler(options), definition];
      case "andlight.dk":
        definition = await AndLightCrawlerDefinition.create(launchOptions);
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
        };
        return [new PlaywrightCrawler(options), definition];

      case "royaldesign.se":
        definition = await RoyalDesignCrawlerDefinition.create(launchOptions);
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
        };
        return [new PlaywrightCrawler(options), definition];
      // Comment to help the script understand where to add new cases
      /**
       * !!! WARNING !!!
       * Definitions for the retailers below this comment exist, but they are incomplete.
       * (ex: used to quickly get product images or specifications)
       *
       * We restrain to using them only locally for development, but they should not be added as fully fledged retailers
       * until they are completely defined.
       */
      case "flos.com":
      case "levellight.se":
      /**
       * Deprecated section.
       *
       * Here we add the retailers that used to work but are now deprecated. We implemented them for a client that
       * didn't renew, so we did not invest the time in fixing them
       */
      case "nordiskagalleriet.se":
      case "nordiskagalleriet.fi":
      case "nordiskagalleriet.no":
      case "nordiskagalleriet.dk":
      case "lannamobler.se":
      case "lanna.no":
      case "lanna.fi":
      case "lampen24.nl":
      case "lamptwist.com":
        definition = await AutoCrawler.create(launchOptions, [
          "schema-attributes",
          "schema-json",
        ]);
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
          proxyConfiguration: proxyConfiguration.SE,
        };
        return [new PlaywrightCrawler(options), definition];
      default:
        definition = await AutoCrawler.create(launchOptions);
        options = {
          ...defaultOptions,
          requestHandler: definition.router,
          proxyConfiguration: proxyConfiguration.SE,
        };
        return [new PlaywrightCrawler(options), definition];
    }

    log.warning(`Asked for unknown root url: ${domain}`);
    throw Error(`Asked for unknown root url: ${domain}`);
  }

  static async buildCheerioCrawler(
    args: CrawlerFactoryArgs,
    launchOptions: CrawlerLaunchOptions
  ): Promise<[CheerioCrawler, AbstractCheerioCrawlerDefinition]> {
    if (args.useCustomQueue === undefined) {
      // use custom queue by default
      args.useCustomQueue = true;
    }

    const url = args.domain;
    const uniqueCrawlerKey = launchOptions.uniqueCrawlerKey;
    const requestQueue = args.useCustomQueue
      ? await CustomRequestQueue.open(
          "__CRAWLEE_PANPRICES_rootQueue_" + uniqueCrawlerKey,
          {},
          args.customQueueSettings
        )
      : await RequestQueue.open(
          "__CRAWLEE_PANPRICES_rootQueue_" + uniqueCrawlerKey
        );

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
        const definition = await ChilliCheerioCrawlerDefinition.create(
          uniqueCrawlerKey
        );
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
      // "185.228.18.69",
      // "185.228.18.35",
      "185.228.18.37",
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
