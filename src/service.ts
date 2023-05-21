import { CrawlerFactory } from "./crawlers/factory";
import { CustomRequestQueue } from "./custom_crawlee/custom_request_queue";
import { log, PlaywrightCrawlerOptions, RequestOptions } from "crawlee";
import { extractDomainFromUrl } from "./utils";
import { DetailedProductInfo, ListingProductInfo } from "./types/offer";
import { persistProductsToDatabase, sendRequestBatch } from "./publishing";
import { CrawlerDefinition, CrawlerLaunchOptions } from "./crawlers/abstract";
import { findCategoryTree } from "./category-tree-mapping";

export async function exploreCategory(
  targetUrl: string,
  jobId: string,
  overrides?: PlaywrightCrawlerOptions
): Promise<RequestOptions[]> {
  const domain = extractDomainFromUrl(targetUrl);

  const [crawler, _] = await CrawlerFactory.buildPlaywrightCrawlerForDomain(
    { domain },
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

  let detailedPages = [];
  while (true) {
    const request = await inWaitQueue.fetchNextRequest();
    if (!request) {
      break;
    }

    const product = request.userData as ListingProductInfo;
    try {
      postProcessListingProduct(product);
    } catch (e) {
      log.error("Error when post processing listing products", { error: e });
    }

    detailedPages.push({
      url: request.url,
      userData: {
        jobId: jobId,
        ...product,
      },
    });
    await inWaitQueue.markRequestHandled(request);
  }

  return detailedPages;
}

function postProcessListingProduct(p: ListingProductInfo): void {
  // Convert dynamic category url to absolute url:
  if (p.categoryUrl?.startsWith("/")) {
    p.categoryUrl = new URL(p.categoryUrl, p.url).href;
  }
  for (let i = 0; i < (p.popularityCategory?.length ?? 0); i++) {
    const category = p.popularityCategory?.[i];
    if (category?.url.startsWith("/")) {
      category.url = new URL(category.url, p.url).href;
    }
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

  const domain = extractDomainFromUrl(targetUrls[0]);

  const [crawler, crawlerDefinition] =
    await CrawlerFactory.buildPlaywrightCrawlerForDomain(
      {
        domain,
        customQueueSettings: {
          captureLabels: [],
        },
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

  return await extractProductDetails(crawlerDefinition);
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

    log.info("Persisting in BigQuery");
    await persistProductsToDatabase(detailedProducts);
    log.info("Published to BigQuery");

    result = [...result, ...detailedProducts];
  }

  return result;
}

export async function extractLeafCategories(
  targetUrls: string[]
): Promise<string[]> {
  if (targetUrls.length === 0) {
    return [];
  }

  const domain = extractDomainFromUrl(targetUrls[0]);

  const [crawler, _] = await CrawlerFactory.buildPlaywrightCrawlerForDomain(
    {
      domain,
      customQueueSettings: {
        captureLabels: ["LIST"],
      },
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

    categoryUrls.push(nextRequest.url);
  }

  log.info("Categories found", { nrCategoryUrls: categoryUrls.length });
  return categoryUrls;
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

  const domain = extractDomainFromUrl(detailedPages[0].url);
  let crawler, crawlerDefinition;
  if (useCheerio) {
    [crawler, crawlerDefinition] =
      await CrawlerFactory.buildCheerioCrawlerForRootUrl({
        domain,
        useCustomQueue: false,
      });
  } else {
    [crawler, crawlerDefinition] =
      await CrawlerFactory.buildPlaywrightCrawlerForDomain(
        {
          domain,
          useCustomQueue: false,
        },
        overrides,
        launchOptions
      );
  }

  await crawler.run(detailedPages);

  return await extractProductDetails(crawlerDefinition);
}

async function extractProductDetails(
  crawlerDefinition: CrawlerDefinition<any>
): Promise<DetailedProductInfo[]> {
  const products = (await crawlerDefinition.detailsDataset.getData()).items.map(
    (i) => <DetailedProductInfo>i
  );

  // HACKY SOLUTION for Bygghemma/Ellos products with multiple variants:
  products.forEach((p) => {
    if (
      p.retailerDomain?.includes("bygghemma") &&
      p.variant === 0 &&
      p.variantGroupUrl
    ) {
      p.url = p.variantGroupUrl;
    }
  });

  try {
    postProcessProductDetails(products);
  } catch (e) {
    log.error("Error when post processing product details", { error: e });
  }
  return products;
}

function postProcessProductDetails(products: DetailedProductInfo[]) {
  products.forEach((p) => {
    p.images = p.images
      .filter((imgUrl) => !!imgUrl)
      .map((imgUrl) => {
        if (imgUrl.startsWith("/")) {
          return p.retailerDomain + imgUrl;
        }
        return imgUrl;
      });

    if (p.categoryUrl?.startsWith("/")) {
      p.categoryUrl = p.retailerDomain + p.categoryUrl;
    }
    for (let i = 0; i < (p.categoryTree?.length ?? 0); i++) {
      const category = p.categoryTree?.[i];
      if (category?.url.startsWith("/")) {
        category.url = p.retailerDomain + category.url;
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

    if (!p.popularityIndex) {
      log.error(
        "Cannot find Popularity Index! Set to -1 temporarily to avoid missing data, but need fix asap."
      );
      p.popularityIndex = -1;
    }
  });

  return products;
}

function isValidGTIN(gtin: string) {
  return gtin.length >= 8 && gtin.length <= 14 && /^\d+$/.test(gtin);
}
