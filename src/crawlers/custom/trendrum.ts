import { Locator, Page } from "playwright";
import {
  browserCrawlerEnqueueLinks,
  Dataset,
  log,
  PlaywrightCrawlingContext,
} from "crawlee";
import { v4 as uuidv4 } from "uuid";

import { AbstractCrawlerDefinition } from "../abstract";
import {
  Category,
  DetailedProductInfo,
  IndividualReview,
  ListingProductInfo,
  OfferMetadata,
  ProductReviews,
  SchemaOrg,
  Specification,
} from "../../types/offer";
import { extractNumberFromText } from "../../utils";

export class TrendrumCrawlerDefinition extends AbstractCrawlerDefinition {
  static async create(): Promise<TrendrumCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets();

    return new TrendrumCrawlerDefinition({
      detailsDataset,
      listingDataset,
      productCardSelector: "main div.grid article",
      detailsUrlSelector: "main div.grid article a",
      listingUrlSelector: "div.pagination span.next a",
      // cookieConsentSelector: "",
      dynamicProductCardLoading: false,
    });
  }
}
