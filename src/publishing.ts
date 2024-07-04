import _ from "lodash";
import { Dictionary, log, RequestOptions } from "crawlee";
import { PubSub } from "@google-cloud/pubsub";
import {
  DetailedProductInfo,
  JobContext,
  ListingProductInfo,
  RequestBatch,
  ScraperSchedule,
} from "./types/offer";
import { BigQuery } from "@google-cloud/bigquery";

/** Publish products found through category indexing or searching, so that
 * new products can be found and scraped.
 */
export async function publishListingProductsInBatch(
  listingProducts: ListingProductInfo[],
  jobContext: JobContext
) {
  const maxBatchSize = 1000;
  const pubSubClient = new PubSub();
  if (!process.env.SHELF_ANALYTICS_PERSIST_NEW_URLS_TOPIC) {
    throw new Error(
      "Cannot find env variable 'SHELF_ANALYTICS_PERSIST_NEW_URLS_TOPIC'"
    );
  }
  const topic = process.env.SHELF_ANALYTICS_PERSIST_NEW_URLS_TOPIC;

  const requestPromises = _.chunk(listingProducts, maxBatchSize).map(
    async (pages) => {
      log.info(`Sending a request batch with ${pages.length} requests`);
      const batchRequest = {
        productDetails: pages,
        jobContext: jobContext,
      };

      try {
        const messageId = await pubSubClient
          .topic(topic)
          .publishMessage({ json: batchRequest });
        log.info(`Message ${messageId} published.`);
      } catch (error) {
        log.error(`Received error while publishing to PubSub`, { error });
      }
    }
  );

  await Promise.all(requestPromises);
}

export async function triggerJobWithNewCategories(
  schedule: ScraperSchedule,
  newCategoryUrls: string[]
) {
  const pubSubClient = new PubSub();

  // We don't need to pass the topic as env variable. There is only one topic for all the jobs that start.
  // The schedule itself contains a field that will decide wether this will be a production or sandbox job
  const topic = "trigger_shelf_analytics_schedule_job";
  try {
    const messageId = await pubSubClient.topic(topic).publishMessage({
      json: {
        ...schedule,
        intermediate_categories: undefined,
        category_urls: [
          ...new Set([...(schedule.category_urls ?? []), ...newCategoryUrls]),
        ],
      },
    });
    log.info(`Message ${messageId} published.`);
  } catch (error) {
    log.error(`Received error while publishing to PubSub`, { error });
  }
}

export async function persistProductsToDatabase(
  products: DetailedProductInfo[],
  jobId: string
) {
  if (products.length === 0) {
    log.warning("No products to publish to BigQuery");
    return;
  }

  // Add jobId to each product
  const itemsToPersist = products.map((item) => {
    return { ...item, jobId: jobId };
  });

  const preprocessedItems = prepareForBigQuery(itemsToPersist);
  await new BigQuery()
    .dataset("b2b_brand_product_index")
    .table("retailer_listings")
    .insert(preprocessedItems, {
      ignoreUnknownValues: true,
    })
    .catch((error) => {
      log.error(`BigQuery insertion error`, { error: error });
      throw error;
    });
}

/**
 * We transform objects held deeper in the structure to their JSON version.
 *
 * Arrays will be transformed to arrays of JSON strings.
 *
 * Field names are converted to camel_case to keep consistency with the analysis in python
 *
 * @param items
 */
export function prepareForBigQuery(items: any[]): Dictionary<any>[] {
  const stringifiedSnakeCased = items.map((i) => {
    const transformed = {};
    for (let key in i) {
      // Ignore null/undefined properties.
      // Important so that we don't try to insert the value "undefined" or "null"
      // to columns of type "REPEATED" on BigQuery.
      // This works since in case the column is NULLABLE and we do not explicitly input "null",
      // BigQuery will auto put NULL there. So there's no different between
      // explicitly passing null and omit the field.
      if (i[key] === undefined || i[key] === null) {
        continue;
      }

      if (Array.isArray(i[key])) {
        // @ts-ignore
        transformed[convertToSnakeCase(key)] = Array.from(i[key]).map(
          reduceToSimpleTypes
        );
        continue;
      }
      // @ts-ignore
      transformed[convertToSnakeCase(key)] = reduceToSimpleTypes(i[key]);
    }

    return transformed;
  });

  return stringifiedSnakeCased;
}

function reduceToSimpleTypes(value: any): any {
  // null is an object, so we need to check for it first. Else it will be stringified.
  if (value === null || value === undefined) {
    return undefined;
  }

  switch (typeof value) {
    case "boolean":
    case "number":
    case "string":
      return value;
    case "object":
      return JSON.stringify(value);
    default:
      return undefined;
  }
}

function convertToSnakeCase(key: string) {
  const wordBreaks = key.match(/[A-Z]/g);
  if (!wordBreaks) {
    return key;
  }
  for (let capitalLetter of wordBreaks) {
    key = key.replace(capitalLetter, `_${capitalLetter.toLocaleLowerCase()}`);
  }
  return key;
}

export async function updateProductsPopularity(
  productListings: ListingProductInfo[],
  jobContext: JobContext
) {
  const pubSubClient = new PubSub();
  if (!process.env.SHELF_ANALYTICS_UPDATE_POPULARITY_TOPIC) {
    throw new Error(
      "Cannot find env variable 'SHELF_ANALYTICS_UPDATE_POPULARITY_TOPIC'"
    );
  }
  const topic = process.env.SHELF_ANALYTICS_UPDATE_POPULARITY_TOPIC;

  log.info(`Publishing popularity info`, {
    nrProducts: productListings.length,
  });

  const payload = {
    productListings: productListings,
    jobContext: jobContext,
  };
  try {
    const messageId = await pubSubClient
      .topic(topic)
      .publishMessage({ json: payload });
    log.info(`Message ${messageId} published.`);
  } catch (error) {
    log.error(`Received error while publishing`, { error });
  }
}

export async function publishProductsToUpdate(
  products: DetailedProductInfo[],
  jobContext: JobContext
) {
  const pubSubClient = new PubSub();
  if (!process.env.SHELF_ANALYTICS_UPDATE_PRODUCTS_TOPIC) {
    throw new Error(
      "Cannot find env variable 'SHELF_ANALYTICS_UPDATE_PRODUCTS_TOPIC'"
    );
  }
  const topic = process.env.SHELF_ANALYTICS_UPDATE_PRODUCTS_TOPIC;

  log.info(`Publishing products to be updated.`, {
    nrProducts: products.length,
  });

  const payload = {
    productDetails: products,
    jobContext: jobContext,
  };

  try {
    const messageId = await pubSubClient
      .topic(topic)
      .publishMessage({ json: payload });
    log.info(`Message ${messageId} published.`);
  } catch (error) {
    log.error(`Received error while publishing`, { error });
  }
}
