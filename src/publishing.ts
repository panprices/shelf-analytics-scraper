import {DatasetContent, Dictionary, log, RequestOptions} from "crawlee";
import {PubSub} from "@google-cloud/pubsub";
import {RequestBatch} from "./types/offer";
import {BigQuery} from "@google-cloud/bigquery";


export async function sendRequestBatch(detailedPages: RequestOptions[]) {
    const pubSubClient = new PubSub();
    log.info(`Sending a request batch with ${detailedPages.length} requests`)
    const batchRequest: RequestBatch = {
        productDetails: detailedPages
    }

    try {
        const messageId = await pubSubClient
            .topic("trigger_schedule_product_scrapes")
            .publishMessage({json: batchRequest});
      log.info(`Message ${messageId} published.`);
    } catch (error) {
      log.error(`Received error while publishing: ${error}`);
    }
}

export async function persistProductsToDatabase(savedItems: DatasetContent<any>) {
    const bigquery = new BigQuery()

    await bigquery
      .dataset("b2b_brand_product_index")
      .table("retailer_offerings")
      .insert(stringifyDeep(savedItems.items), {
          ignoreUnknownValues: true
      });
}

function stringifyDeep(items: Dictionary<any>[]): Dictionary<any>[] {
    const reduceToSimpleTypes = (e: any) => {
        const currentType = typeof e

        switch (currentType) {
            case "boolean":
            case "number":
            case "string":
                return e
            case "object":
                return JSON.stringify(e)
            default:
                return undefined
        }
    }

    return items.map(
        i => {
            for (let key in i) {
                if (Array.isArray(i[key])) {
                    i[key] = Array.from(i[key]).map(reduceToSimpleTypes)

                    continue
                }
                i[key] = reduceToSimpleTypes(i[key])
            }

            return i
        }
    )
}

