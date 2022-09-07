import {Dictionary, log, RequestOptions} from "crawlee";
import {PubSub} from "@google-cloud/pubsub";
import {DetailedProductInfo, RequestBatch} from "./types/offer";
import {BigQuery} from "@google-cloud/bigquery";
import {InsertRowsResponse} from "@google-cloud/bigquery/build/src/table";


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

export async function persistProductsToDatabase(savedItems: DetailedProductInfo[]) {
    const bigquery = new BigQuery()
    const preprocessedItems = prepareForBigQuery(savedItems)
    await bigquery
        .dataset("b2b_brand_product_index")
        .table("retailer_listings")
        .insert(preprocessedItems)
        .catch((response: InsertRowsResponse) => {
            log.error(`BigQuery insertion response: ${JSON.stringify(response)}`)
        })
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

    const convertToSnakeCase = (key: string) => {
        const wordBreaks = key.match(/[A-Z]/g)
        if (!wordBreaks) {
            return key
        }

        for (let capitalLetter of wordBreaks) {
            key = key.replace(capitalLetter, `_${capitalLetter.toLocaleLowerCase()}`)
        }

        return key
    }

    const stringifiedSnakeCased = items.map(
        i => {
            const transformed = {}
            for (let key in i) {
                if (Array.isArray(i[key])) {
                    transformed[convertToSnakeCase(key)] = Array.from(i[key]).map(reduceToSimpleTypes)

                    continue
                }
                transformed[convertToSnakeCase(key)] = reduceToSimpleTypes(i[key])
            }

            return transformed
        }
    )
    const bigqueryFields = [
        'name',
        'fetched_at',
        'retailer_domain',
        'url',
        'brand',
        'description',
        'popularity_index',
        'category_tree',
        'images',
        'is_discounted',
        'original_price',
        'price',
        'currency',
        'sku',
        'metadata',
        'specifications',
        'in_stock',
        'reviews'
    ]

    return stringifiedSnakeCased.map(product => {
        const filteredProduct = {}
        for (let f of bigqueryFields) {
            if (f in product) {
                filteredProduct[f] = product[f]
            }
        }
        return filteredProduct
    })
}

