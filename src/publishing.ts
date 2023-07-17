import _ from "lodash";
import { Dictionary, log, RequestOptions } from "crawlee";
import { PubSub } from "@google-cloud/pubsub";
import {
  DetailedProductInfo,
  JobContext,
  ListingProductInfo,
  RequestBatch,
} from "./types/offer";
import { BigQuery } from "@google-cloud/bigquery";

export async function sendRequestBatch(
  detailedPages: RequestOptions[],
  jobContext: JobContext
) {
  const maxBatchSize = 1000;
  const pubSubClient = new PubSub();
  if (!process.env.SHELF_ANALYTICS_SCHEDULE_PRODUCT_SCRAPE_TOPIC) {
    throw new Error(
      "Cannot find env variable 'SHELF_ANALYTICS_SCHEDULE_PRODUCT_SCRAPE_TOPIC'"
    );
  }
  const topic = process.env.SHELF_ANALYTICS_SCHEDULE_PRODUCT_SCRAPE_TOPIC;

  const requestPromises = _.chunk(detailedPages, maxBatchSize).map(
    async (pages) => {
      log.info(`Sending a request batch with ${pages.length} requests`);
      const batchRequest: RequestBatch = {
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
    .insert(preprocessedItems)
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
  const reduceToSimpleTypes = (value: any) => {
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
  };

  const convertToSnakeCase = (key: string) => {
    const wordBreaks = key.match(/[A-Z]/g);
    if (!wordBreaks) {
      return key;
    }

    for (let capitalLetter of wordBreaks) {
      key = key.replace(capitalLetter, `_${capitalLetter.toLocaleLowerCase()}`);
    }

    return key;
  };

  const stringifiedSnakeCased = items.map((i) => {
    const transformed = {};
    for (let key in i) {
      // Ignore undefined properties. Important so that we don't try to insert
      // the value "undefined" to columns of type "REPEATED" on BigQuery.
      if (i[key] === undefined) {
        continue;
      }

      if (Array.isArray(i[key])) {
        transformed[convertToSnakeCase(key)] = Array.from(i[key]).map(
          reduceToSimpleTypes
        );
        continue;
      }

      transformed[convertToSnakeCase(key)] = reduceToSimpleTypes(i[key]);
    }

    return transformed;
  });

  const bigqueryFields = [
    "name",
    "fetched_at",
    "retailer_domain",
    "url",
    "brand",
    "description",
    "popularity_index",
    "popularity_category",
    "category_tree",
    "images",
    "is_discounted",
    "original_price",
    "price",
    "currency",
    "gtin",
    "sku",
    "mpn",
    "specifications",
    "availability",
    "reviews",
    "variant_group_url",
    "metadata",
    "job_id",
  ];

  return stringifiedSnakeCased.map((product) => {
    const filteredProduct = {};
    for (let f of bigqueryFields) {
      if (f in product) {
        filteredProduct[f] = product[f];
      }
    }
    return filteredProduct;
  });
}

export async function updateProductsPopularity(
  products: ListingProductInfo[],
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
    nrProducts: products.length,
  });

  const payload = {
    products: products,
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

export async function publishMatchingProducts(
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

  log.info(`Publishing matching products to be updated.`, {
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
