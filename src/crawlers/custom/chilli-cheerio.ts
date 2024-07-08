import { v4 as uuidv4 } from "uuid";
import fs from "fs";

import {
  RequestQueue,
  CheerioCrawler,
  RequestOptions,
  PlaywrightCrawlerOptions,
  Dataset,
  CheerioCrawlingContext,
} from "crawlee";
import { DetailedProductInfo } from "../../types/offer.js";
import { extractDomainFromUrl } from "../../utils.js";
import { AbstractCheerioCrawlerDefinition } from "../abstract.js";

export class ChilliCheerioCrawlerDefinition extends AbstractCheerioCrawlerDefinition {
  extractProductDetails(ctx: CheerioCrawlingContext): DetailedProductInfo {
    const $ = ctx.$;

    const schemaOrgString = $("script[type='application/ld+json']")
      .filter(
        (_, element) =>
          $(element).text().includes("schema.org") &&
          $(element).text().includes("Product")
      )
      .text();
    const schemaOrg = JSON.parse(schemaOrgString);

    const metadata = {
      schemaOrg,
    };

    const schemaOrgBreadcrumbString = $("script[type='application/ld+json']")
      .filter(
        (_, element) =>
          $(element).text().includes("schema.org") &&
          $(element).text().includes("BreadcrumbList")
      )
      .text();
    const schemaOrgBreadcrumb = JSON.parse(schemaOrgBreadcrumbString);

    const categoryTree = schemaOrgBreadcrumb.itemListElement
      // @ts-ignore
      .map((listItem) => {
        return {
          name: listItem.item.name,
          url: listItem.item["@id"],
        };
      })
      .slice(1); // remove the first breadcrumb is the homepage

    const productDetails: DetailedProductInfo = {
      name: schemaOrg.name,
      url: ctx.request.url,
      brand: schemaOrg.brand?.name,
      description: schemaOrg.description,

      gtin: schemaOrg.gtin,
      sku: schemaOrg.mpn,
      categoryTree,
      images: [],
      price: 0,
      currency: "SEK",
      isDiscounted: false,
      availability: "in_stock",
      reviews: undefined,
      specifications: [],

      metadata,
    };

    return productDetails;
  }

  static async create(
    uniqueCrawlerKey: string
  ): Promise<ChilliCheerioCrawlerDefinition> {
    const detailsDataset = await Dataset.open(
      "__CRAWLEE_PANPRICES_detailsDataset_" + uniqueCrawlerKey
    );

    return new ChilliCheerioCrawlerDefinition({
      detailsDataset,
    });
  }
}
