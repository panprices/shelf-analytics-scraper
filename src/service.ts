import { CrawlerFactory } from "./crawlers/factory.js";
import { CustomRequestQueue } from "./custom-crawlee/custom-request-queue.js";
import { log, PlaywrightCrawlerOptions, RequestOptions } from "crawlee";
import { clearStorage, extractDomainFromUrl, normaliseUrl } from "./utils.js";
import { DetailedProductInfo, ListingProductInfo } from "./types/offer.js";
import {
  CrawlerDefinition,
  CrawlerLaunchOptions,
} from "./crawlers/abstract.js";
import { v4 as uuidv4 } from "uuid";

export async function exploreCategory(
  targetUrl: string,
  overrides?: PlaywrightCrawlerOptions
): Promise<ListingProductInfo[]> {
  const domain = extractDomainFromUrl(targetUrl);
  const uniqueCrawlerKey = uuidv4();

  const [crawler, crawlerDefinition] =
    await CrawlerFactory.buildPlaywrightCrawler(
      {
        domain,
        type: "categoryExploration",
        customQueueSettings: { captureLabels: ["DETAIL"] },
      },
      {
        uniqueCrawlerKey,
      },
      {
        ...overrides,
        maxConcurrency: 1,
        requestHandlerTimeoutSecs: 3600,
      }
    );
  await crawler.run([
    {
      url: targetUrl,
      label: "LIST",
    },
  ]);

  const inWaitQueue = (<CustomRequestQueue>crawler.requestQueue).inWaitQueue;

  let listingProducts = [];
  while (true) {
    const request = await inWaitQueue.fetchNextRequest();
    if (!request) {
      break;
    }

    const product = request.userData as ListingProductInfo;
    try {
      postProcessListingProduct(product, crawlerDefinition);
    } catch (e) {
      log.error("Error when post processing listing products", { error: e });
    }

    listingProducts.push(product);
    await inWaitQueue.markRequestHandled(request);
  }

  await clearStorage(uniqueCrawlerKey);
  return listingProducts;
}

function postProcessListingProduct(
  p: ListingProductInfo,
  crawlerDefinition: CrawlerDefinition<any>
): void {
  // Convert dynamic category url to absolute url:
  if (p.categoryUrl?.startsWith("/")) {
    p.categoryUrl = normaliseUrl(p.categoryUrl, p.url);
  }
  for (let i = 0; i < (p.popularityCategory?.length ?? 0); i++) {
    const category = p.popularityCategory?.[i];
    if (category?.url.startsWith("/")) {
      category.url = normaliseUrl(category.url, p.url);
    }
  }

  if (crawlerDefinition.normalizeProductUrl) {
    p.url = crawlerDefinition.normalizeProductUrl(p.url);
  }
}

/**
 * Explore the category page and then scrape product pages.
 */
export async function exploreCategoryEndToEnd(
  categoryUrls: string[],
  overrides?: PlaywrightCrawlerOptions
): Promise<DetailedProductInfo[]> {
  let result: DetailedProductInfo[] = [];
  for (const u of categoryUrls) {
    console.log(u);
    const detailedProducts = await exploreCategory(u, overrides).then(
      (listingProducts) => {
        console.log(`Found ${listingProducts.length} detailed urls`);

        const requestOptions = listingProducts.map((p) => {
          return {
            url: p.url,
            userData: p,
          } as RequestOptions;
        });
        return scrapeDetails(requestOptions, overrides).then(
          (detailedProducts) => {
            console.log(
              `Category ${u} obtained ${detailedProducts.length} product details`
            );

            if (detailedProducts.length < listingProducts.length) {
              throw "Missing detailed products";
            }
            return detailedProducts;
          }
        );
      }
    );

    result = [...result, ...detailedProducts];
  }

  return result;
}

export async function exploreCategoryEndToEndCheerio(
  categoryUrls: string[]
): Promise<DetailedProductInfo[]> {
  let result: DetailedProductInfo[] = [];
  for (const u of categoryUrls) {
    console.log(u);
    const detailedProducts = await exploreCategory(u).then(
      async (detailRequests) => {
        console.log(`Found ${detailRequests.length} detailed urls`);

        const detailedProducts = await scrapeDetails(
          detailRequests,
          undefined,
          true
        );
        console.log(
          `Category ${u} obtained ${detailedProducts.length} product details`
        );

        if (detailedProducts.length < detailRequests.length) {
          log.error("Missing detailed products", {
            fromCategoryExplore: detailRequests.length,
            got: detailedProducts.length,
          });
        }
        return detailedProducts;
      }
    );

    log.info(JSON.stringify(detailedProducts, null, 2));
    log.info("Item found", {
      nrItems: detailedProducts.length,
      urls: detailedProducts.map((item) => item.url),
      nrImages: detailedProducts.map((item) => item.images.length),
    });

    result = [...result, ...detailedProducts];
  }

  return result;
}

export async function searchForProducts(
  query: string,
  retailerDomain: string,
  overrides?: PlaywrightCrawlerOptions
): Promise<ListingProductInfo[]> {
  const uniqueCrawlerKey = uuidv4();
  const [crawler, crawlerDefinition] =
    await CrawlerFactory.buildPlaywrightCrawler(
      {
        domain: retailerDomain,
        type: "search",
        // Do not continue to explore the product page.
        // Capture those pages and publish them to the scheduler later.
        customQueueSettings: { captureLabels: ["DETAIL"] },
      },
      {
        uniqueCrawlerKey,
      },
      overrides
    );

  const searchUrl = crawlerDefinition.getSearchUrl(query, retailerDomain);
  log.info("Searching for products", { url: searchUrl });
  await crawler.run([
    {
      url: searchUrl,
      label: "SEARCH",
    },
  ]);

  const inWaitQueue = (<CustomRequestQueue>crawler.requestQueue).inWaitQueue;
  let listingProducts = [];
  while (true) {
    const request = await inWaitQueue.fetchNextRequest();
    if (!request) {
      break;
    }

    const product = request.userData as ListingProductInfo;
    try {
      postProcessListingProduct(product, crawlerDefinition);
    } catch (e) {
      log.error("Error when post processing listing products", { error: e });
    }

    listingProducts.push(product);
    await inWaitQueue.markRequestHandled(request);
  }

  return listingProducts;
}

export async function extractCategories(
  targetUrls: string[],
  overrides?: PlaywrightCrawlerOptions
): Promise<RequestOptions[]> {
  log.info("Extracting categories");
  const uniqueCrawlerKey = uuidv4();
  if (targetUrls.length === 0) {
    return [];
  }

  const domain = extractDomainFromUrl(targetUrls[0]);

  const [crawler, _] = await CrawlerFactory.buildPlaywrightCrawler(
    {
      domain,
      type: "categoryExploration",
      customQueueSettings: {
        captureLabels: ["LIST"],
      },
    },
    {
      uniqueCrawlerKey,
    },
    {
      headless: true,
      maxConcurrency: 5,
      requestHandlerTimeoutSecs: 600,
      ...overrides,
    }
  );
  await crawler.run(
    targetUrls.map((t) => {
      return {
        url: t,
        label: "INTERMEDIATE_CATEGORY",
      };
    })
  );

  const inWaitQueue = (<CustomRequestQueue>crawler.requestQueue).inWaitQueue;
  const categoryUrls = [];
  while (true) {
    const nextRequest = await inWaitQueue.fetchNextRequest();
    if (!nextRequest) {
      break;
    }

    categoryUrls.push({
      url: nextRequest.url,
      userData: nextRequest.userData,
    });
  }

  log.info("Categories found", { nrCategoryUrls: categoryUrls.length });
  const result = categoryUrls;
  await clearStorage(uniqueCrawlerKey);
  return result;
}

export async function scrapeDetails(
  detailedPages: RequestOptions[],
  overrides?: PlaywrightCrawlerOptions,
  useCheerio: boolean = false,
  launchOptions?: CrawlerLaunchOptions
): Promise<DetailedProductInfo[]> {
  if (detailedPages.length === 0) {
    return [];
  }

  const allProducts = [];

  // Build a crawler for each domain and scrape the product details.
  const domains = new Set(
    detailedPages.map((p) => extractDomainFromUrl(p.url))
  );
  for (const domain of domains) {
    const uniqueCrawlerKey = uuidv4();
    const pagesToScrape = detailedPages.filter(
      (p) => extractDomainFromUrl(p.url) === domain
    );
    let crawler, crawlerDefinition;
    if (useCheerio) {
      [crawler, crawlerDefinition] = await CrawlerFactory.buildCheerioCrawler(
        {
          domain,
          type: "scrapeDetails",
          useCustomQueue: false,
        },
        {
          uniqueCrawlerKey,
        }
      );
    } else {
      [crawler, crawlerDefinition] =
        await CrawlerFactory.buildPlaywrightCrawler(
          {
            domain,
            type: "scrapeDetails",
            useCustomQueue: false,
          },
          {
            ...(launchOptions ?? {}),
            uniqueCrawlerKey,
          },
          {
            ...overrides,
          }
        );
    }
    await crawler.run(pagesToScrape);

    const products = await extractProductDetails(crawlerDefinition);
    allProducts.push(...products);

    await clearStorage(uniqueCrawlerKey);
  }

  return allProducts;
}

async function extractProductDetails(
  crawlerDefinition: CrawlerDefinition<any>
): Promise<DetailedProductInfo[]> {
  const products = (await crawlerDefinition.detailsDataset.getData()).items.map(
    (i) => <DetailedProductInfo>i
  );

  // Post-process products. Remove products with errors from the result, only
  // return the good ones.
  const processedProducts = [];
  const errors = [];
  for (const p of products) {
    try {
      postProcessProductDetail(p, crawlerDefinition);
      processedProducts.push(p);
    } catch (e) {
      errors.push({
        product: p,
        error: e,
      });
    }
  }

  if (errors.length > 0) {
    errors.forEach((e) => {
      log.exception(
        e.error as Error,
        "Error when post processing product details",
        {
          url: e.product.url,
          product: e.product,
        }
      );
    });
  }

  return processedProducts;
}

function postProcessProductDetail(
  p: DetailedProductInfo,
  crawlerDefinition: CrawlerDefinition<any>
): void {
  // Mostly for AutoScraper (price lite). An error should already be thrown
  // in the scraper when extractProductDetails if no product name is found.
  if (!p.name) {
    throw new Error(
      "No product name found in the final result. It should either be scraped or supplied in the input."
    );
  }
  // Avoid empty string
  p.description = p.description || undefined;
  p.brand = p.brand || undefined;
  p.brandUrl = p.brandUrl || undefined;

  p.images = p.images
    .filter((imgUrl) => !!imgUrl)
    .map((imgUrl) => {
      if (imgUrl.startsWith("/")) {
        return new URL(imgUrl, p.url).href;
      }
      return imgUrl;
    });

  // Convert dynamic category url to absolute url:
  if (p.brandUrl?.startsWith("/")) {
    p.brandUrl = new URL(p.brandUrl, p.url).href;
  }

  if (p.categoryUrl?.startsWith("/")) {
    p.categoryUrl = new URL(p.categoryUrl, p.url).href;
  }
  for (let i = 0; i < (p.categoryTree?.length ?? 0); i++) {
    const category = p.categoryTree?.[i];
    if (category?.url.startsWith("/")) {
      category.url = new URL(category.url, p.url).href;
    }
  }

  if (p.gtin) {
    if (!isValidGTIN(p.gtin)) {
      log.warning(`GTIN is not valid`, { gtin: p.gtin });
      p.gtin = undefined;
    } else {
      p.gtin = p.gtin?.padStart(14, "0");
    }
  }

  if (p.currency) {
    p.currency = p.currency.toUpperCase();
    if (p.currency.length !== 3 && p.currency !== "UNKNOWN") {
      throw new Error(`Unknown currency '${p.currency}'`);
    }
  }
  switch (p.currency) {
    // SEK, USD, EUR
    default: {
      if (p.price) {
        p.price = Math.round(p.price * 100);
      }
      if (p.originalPrice) {
        p.originalPrice = Math.round(p.originalPrice * 100);
      }
    }
  }

  if (crawlerDefinition.normalizeProductUrl) {
    p.url = crawlerDefinition.normalizeProductUrl(p.url);
  }
  if (crawlerDefinition.postProcessProductDetails) {
    crawlerDefinition.postProcessProductDetails(p);
  }
}

function isValidGTIN(gtin: string) {
  return gtin.length >= 8 && gtin.length <= 14 && /^\d+$/.test(gtin);
}

export async function exploreHomepage(
  url: string,
  overrides?: PlaywrightCrawlerOptions
): Promise<void> {
  const uniqueCrawlerKey = uuidv4();
  const [crawler, _crawlerDefinition] =
    await CrawlerFactory.buildPlaywrightCrawler(
      {
        domain: extractDomainFromUrl(url),
        type: "homepageExploration",
        useCustomQueue: false,
        customQueueSettings: { captureLabels: ["DETAIL"] },
      },
      {
        uniqueCrawlerKey,
      },
      {
        ...overrides,
      }
    );

  await crawler.run([
    {
      url: url,
      label: "HOMEPAGE",
    },
  ]);
}
