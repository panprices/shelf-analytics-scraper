import { CrawlerFactory } from "./crawlers/factory";
import { CustomRequestQueue } from "./custom_crawlee/custom_request_queue";
import {
  Dictionary,
  log,
  PlaywrightCrawlerOptions,
  RequestOptions,
} from "crawlee";
import { clearStorage, extractDomainFromUrl, normaliseUrl } from "./utils";
import { DetailedProductInfo, ListingProductInfo } from "./types/offer";
import { CrawlerDefinition, CrawlerLaunchOptions } from "./crawlers/abstract";
import { findCategoryTree } from "./category-tree-mapping";
import { v4 as uuidv4 } from "uuid";

export async function exploreCategory(
  targetUrl: string,
  jobId: string,
  overrides?: PlaywrightCrawlerOptions
): Promise<RequestOptions[]> {
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

  let requestOptions = [];
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

    // Normalize the request url so that we can check for it in postges later
    // and determine if we should proceed with scraping the product or not.
    const normalizedRequestUrl = crawlerDefinition.normalizeProductUrl(
      request.url
    );

    requestOptions.push({
      url: normalizedRequestUrl,
      userData: {
        jobId: jobId,
        ...product,
      },
    });
    await inWaitQueue.markRequestHandled(request);
  }

  const result = requestOptions;
  await clearStorage(uniqueCrawlerKey);
  return result;
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
 * Explore the category page and goes into product pages.
 */
export async function exploreCategoriesNoCapture(
  targetUrls: string[],
  overrides: PlaywrightCrawlerOptions
): Promise<DetailedProductInfo[]> {
  if (targetUrls.length === 0) {
    return [];
  }
  const uniqueCrawlerKey = uuidv4();
  const domain = extractDomainFromUrl(targetUrls[0]);

  const [crawler, crawlerDefinition] =
    await CrawlerFactory.buildPlaywrightCrawler(
      {
        domain,
        type: "categoryExploration",
        customQueueSettings: {
          captureLabels: [],
        },
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
  await crawler.run(
    targetUrls.map((t) => {
      return {
        url: t,
        label: "LIST",
      };
    })
  );

  const result = await extractProductDetails(crawlerDefinition);
  await clearStorage(uniqueCrawlerKey);
  return result;
}

export async function exploreCategoryEndToEnd(
  categoryUrls: string[]
): Promise<DetailedProductInfo[]> {
  let result: DetailedProductInfo[] = [];
  for (const u of categoryUrls) {
    console.log(u);
    const detailedProducts = await exploreCategory(u, "end_to_end").then(
      (detailRequests) => {
        console.log(`Found ${detailRequests.length} detailed urls`);

        return scrapeDetails(detailRequests).then((detailedProducts) => {
          console.log(
            `Category ${u} obtained ${detailedProducts.length} product details`
          );

          if (detailedProducts.length < detailRequests.length) {
            throw "Missing detailed products";
          }
          return detailedProducts;
        });
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
    const detailedProducts = await exploreCategory(
      u,
      "end_to_end_2022_01_03_v2"
    ).then(async (detailRequests) => {
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
    });

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
): Promise<RequestOptions[]> {
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
  let requestOptions = [];
  while (true) {
    const request = await inWaitQueue.fetchNextRequest();
    if (!request) {
      break;
    }

    // Normalize the request url so that we can check for it in postges later
    // and determine if we should proceed with scraping the product or not.
    const normalizedRequestUrl = crawlerDefinition.normalizeProductUrl(
      request.url
    );

    requestOptions.push({
      url: normalizedRequestUrl,
      userData: request.userData,
    });
    await inWaitQueue.markRequestHandled(request);
  }

  const result = requestOptions;
  await clearStorage(uniqueCrawlerKey);
  return result;
}

export async function extractLeafCategories(
  targetUrls: string[]
): Promise<RequestOptions[]> {
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
  const uniqueCrawlerKey = uuidv4();

  const allProducts = [];

  // Build a crawler for each domain and scrape the product details.
  const domains = new Set(
    detailedPages.map((p) => extractDomainFromUrl(p.url))
  );
  for (const domain of domains) {
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
            uniqueCrawlerKey: uuidv4(),
          },
          {
            ...overrides,
          }
        );
    }
    await crawler.run(pagesToScrape);

    const products = await extractProductDetails(crawlerDefinition);
    allProducts.push(...products);
  }

  const result = allProducts;
  await clearStorage(uniqueCrawlerKey);
  return result;
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
        p.price = Math.floor(p.price * 100);
      }
      if (p.originalPrice) {
        p.originalPrice = Math.floor(p.originalPrice * 100);
      }
    }
  }

  if (!p.categoryTree) {
    // Try to get it from categoryTreeMapping instead. Namely for the retailer Berno Mobler.
    if (!p.categoryUrl) {
      throw new Error("Cannot find neither categoryTree nor categoryUrl");
    }
    p.categoryTree = findCategoryTree(p.categoryUrl);
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
