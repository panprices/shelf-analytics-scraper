import { CrawlerFactory } from "./crawlers/factory";
import { CustomRequestQueue } from "./custom_crawlee/custom_request_queue";
import { log, PlaywrightCrawlerOptions, RequestOptions } from "crawlee";
import { extractRootUrl } from "./utils";
import { sendRequestBatch } from "./publishing";
import { DetailedProductInfo } from "./types/offer";
import {AbstractCrawlerDefinition} from "./crawlers/abstract";
import {writeFileSync} from "fs";
import {join} from 'path';

export async function exploreCategory(
  targetUrl: string,
  jobId: string,
  overrides?: PlaywrightCrawlerOptions
): Promise<RequestOptions[]> {
  const rootUrl = extractRootUrl(targetUrl);

  const [crawler, _] = await CrawlerFactory.buildCrawlerForRootUrl(
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

  log.info(`Category explored`, {
    url: targetUrl,
    nrProductsFound: detailedPages.length,
  });
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

  const [crawler, crawlerDefinition] = await CrawlerFactory.buildCrawlerForRootUrl(
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
  await crawler.run(targetUrls.map(t => {
    return {
      url: t,
        label:"LIST",
    }
  }));

  return await extractProductDetails(crawlerDefinition)
}

export async function exploreCategoryEndToEnd(categoryUrls: string[]): Promise<DetailedProductInfo[]> {
  let result: DetailedProductInfo[] = []
  for (const u of categoryUrls) {
    console.log(u)
    const detailedProducts = await exploreCategory(u, 'end_to_end').then(detailRequests => {
      console.log(`Found ${detailRequests.length} detailed urls`)

      return scrapeDetails(detailRequests).then(detailedProducts => {
        console.log(`Category ${u} obtained ${detailedProducts.length} product details`)

        if (detailedProducts.length < detailRequests.length) {
          throw 'Missing detailed products'
        }
        return detailedProducts
      })
    })

    result = [...result, ...detailedProducts]
  }

  return result
}

export async function extractLeafCategories(targetUrls: string[]) {
  if (targetUrls.length === 0) {
    return ;
  }

  const rootUrl = extractRootUrl(targetUrls[0]);

  const [crawler, _] = await CrawlerFactory.buildCrawlerForRootUrl(
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
  await crawler.run(targetUrls.map(t => {
    return {
      url: t,
      label:"INTERMEDIATE_CATEGORY",
    }
  }));

  const inWaitQueue = (<CustomRequestQueue>crawler.requestQueue).inWaitQueue;
  const categoryUrls = [];
  while (true) {
    const nextRequest = await inWaitQueue.fetchNextRequest();
    if (!nextRequest) {
      break;
    }

    categoryUrls.push(nextRequest.url);
  }

  categoryUrls.forEach((u) => log.info(u));
}

export async function scrapeDetails(
  detailedPages: RequestOptions[],
  overrides?: PlaywrightCrawlerOptions
): Promise<DetailedProductInfo[]> {
  if (detailedPages.length === 0) {
    return [];
  }

  const sampleUrl = detailedPages[0].url;
  const rootUrl = extractRootUrl(sampleUrl);
  const [crawler, crawlerDefinition] =
    await CrawlerFactory.buildCrawlerForRootUrl(
      {
        url: rootUrl,
        useCustomQueue: false,
      },
      overrides
    );

  await crawler.run(detailedPages);

  return await extractProductDetails(crawlerDefinition)
}

async function extractProductDetails(crawlerDefinition: AbstractCrawlerDefinition): Promise<DetailedProductInfo[]> {
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
      if (!isValidGTIN) {
        throw Error(`GTIN not valid: '${p.gtin}'`);
      }
      p.gtin = p.gtin?.padStart(14, "0");
    }

    p.currency = p.currency.toUpperCase();
    if (p.currency.length !== 3 && p.currency !== 'UNKNOWN') {
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
  });

  return products;
}

function isValidGTIN(gtin: string) {
  return gtin.length >= 8 && gtin.length <= 14 && /^\d+$/.test(gtin);
}
