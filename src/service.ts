import { CrawlerFactory } from "./crawlers/factory";
import { CustomRequestQueue } from "./custom_crawlee/custom_request_queue";
import { log, PlaywrightCrawlerOptions, RequestOptions } from "crawlee";
import { extractRootUrl } from "./utils";
import { DetailedProductInfo } from "./types/offer";
import { persistProductsToDatabase, sendRequestBatch } from "./publishing";
import {
  AbstractCrawlerDefinition,
  CrawlerDefinition,
} from "./crawlers/abstract";

export async function exploreCategory(
  targetUrl: string,
  jobId: string,
  overrides?: PlaywrightCrawlerOptions
): Promise<RequestOptions[]> {
  const rootUrl = extractRootUrl(targetUrl);

  const [crawler, _] = await CrawlerFactory.buildPlaywrightCrawlerForRootUrl(
    { url: rootUrl },
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
    if (request === null) {
      break;
    }

    detailedPages.push({
      url: request.url,
      userData: {
        jobId: jobId,
        ...request.userData,
      },
    });
    await inWaitQueue.markRequestHandled(request);
  }

  return detailedPages;
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

  const rootUrl = extractRootUrl(targetUrls[0]);

  const [crawler, crawlerDefinition] =
    await CrawlerFactory.buildPlaywrightCrawlerForRootUrl(
      {
        url: rootUrl,
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

  const rootUrl = extractRootUrl(targetUrls[0]);

  const [crawler, _] = await CrawlerFactory.buildPlaywrightCrawlerForRootUrl(
    {
      url: rootUrl,
      customQueueSettings: {
        captureLabels: ["LIST"],
      },
    },
    {
      headless: true,
      maxConcurrency: 4,
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
  useCheerio: boolean = false
): Promise<DetailedProductInfo[]> {
  if (detailedPages.length === 0) {
    return [];
  }

  const rootUrl = extractRootUrl(detailedPages[0].url);
  let crawler, crawlerDefinition;
  if (useCheerio) {
    [crawler, crawlerDefinition] =
      await CrawlerFactory.buildCheerioCrawlerForRootUrl({
        url: rootUrl,
        useCustomQueue: false,
      });
  } else {
    [crawler, crawlerDefinition] =
      await CrawlerFactory.buildPlaywrightCrawlerForRootUrl(
        {
          url: rootUrl,
          useCustomQueue: false,
        },
        overrides
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

  // HACKY SOLUTION for Bygghemma products with multiple variants:
  products.forEach((p) => {
    if (
      p.retailerDomain?.includes("bygghemma") &&
      p.variant === 0 &&
      p.productGroupUrl
    ) {
      p.url = p.productGroupUrl;
    }
  });

  postProcessProductDetails(products);
  return products;
}

function postProcessProductDetails(products: DetailedProductInfo[]) {
  products.forEach((p) => {
    if (p.gtin) {
      if (!isValidGTIN(p.gtin)) {
        log.warning(`GTIN is not valid`, { gtin: p.gtin });
        p.gtin = undefined;
      } else {
        p.gtin = p.gtin?.padStart(14, "0");
      }
    }

    p.currency = p.currency.toUpperCase();
    if (p.currency.length !== 3 && p.currency !== "UNKNOWN") {
      throw Error(`Unknown currency '${p.currency}'`);
    }
    switch (p.currency) {
      // SEK, USD, EUR
      default: {
        p.price = p.price * 100;
        if (p.originalPrice) {
          p.originalPrice = p.originalPrice * 100;
        }
      }
    }

    if (!p.popularityIndex) {
      p.popularityIndex = -1;
    }
  });

  return products;
}

function isValidGTIN(gtin: string) {
  return gtin.length >= 8 && gtin.length <= 14 && /^\d+$/.test(gtin);
}
