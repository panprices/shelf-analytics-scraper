import _ from "lodash";
import { Dictionary, log, RequestOptions } from "crawlee";
import { PubSub } from "@google-cloud/pubsub";
import { DetailedProductInfo, JobContext, RequestBatch } from "./types/offer";
import { BigQuery } from "@google-cloud/bigquery";
import { InsertRowsResponse } from "@google-cloud/bigquery/build/src/table";

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
  savedItems: DetailedProductInfo[]
) {
  if (savedItems.length === 0) {
    log.warning("No products to publish to BigQuery");
    return;
  }

  const bigquery = new BigQuery();
  const preprocessedItems = prepareForBigQuery(savedItems);
  await bigquery
    .dataset("b2b_brand_product_index")
    .table("retailer_listings")
    .insert(preprocessedItems)
    .catch((reason) => {
      log.error(`BigQuery insertion error`, { reason: reason });
    });

  log.info("Published products to BigQuery", {
    nrProducts: savedItems.length,
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
  const reduceToSimpleTypes = (e: any) => {
    // null is an object, so we need to check for it first
    if (e === null || e === undefined) {
      return null;
    }

    const currentType = typeof e;

    switch (currentType) {
      case "boolean":
      case "number":
      case "string":
        return e;
      case "object":
        return JSON.stringify(e);
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
    log.error(`Received error while publishing: ${error}`);
  }
}
