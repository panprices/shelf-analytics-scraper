import { Locator, Page } from "playwright";
import { log, PlaywrightCrawlingContext } from "crawlee";

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

export class UnolivingCrawlerDefinition extends AbstractCrawlerDefinition {
  override async scrollToBottom(ctx: PlaywrightCrawlingContext): Promise<void> {
    const page = ctx.page;

    while (true) {
      await this.handleCookieConsent(page);
      await super.scrollToBottom(ctx);

      // wait for consistency
      await new Promise((f) => setTimeout(f, 500));
      const loadMoreButton = page.locator("button.ais-InfiniteHits-loadMore");

      try {
        await loadMoreButton.click({ timeout: 5000 });
      } catch (error) {
        // No more expand button to click => break
        break;
      }
    }
  }

  async extractCardProductInfo(
    categoryUrl: string,
    productCard: Locator
  ): Promise<ListingProductInfo> {
    const productName = await this.extractProperty(
      productCard,
      "div.product-item-name",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    if (!productName) throw new Error("Cannot find productName of productCard");

    const url = await this.extractProperty(
      productCard,
      "div.product-item-name a",
      (node) => node.getAttribute("href")
    );
    if (!url) throw new Error("Cannot find url of productCard");

    const currentProductInfo: ListingProductInfo = {
      name: productName,
      url,
      popularityIndex: -1, // will be overwritten later
      categoryUrl,
    };

    return currentProductInfo;
  }

  async extractProductDetails(page: Page): Promise<UnolivingCrawlerDefinition> {
    throw new Error("Not Implemented");
  }

  static async create(): Promise<UnolivingCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets();

    return new UnolivingCrawlerDefinition({
      detailsDataset,
      listingDataset,
      // listingUrlSelector: "button.ais-InfiniteHits-loadMore",
      detailsUrlSelector: "ol li.plp__grid-item div.product-item-name a",
      productCardSelector: "ol li.plp__grid-item",
      cookieConsentSelector: "button.coi-banner__accept",
      dynamicProductCardLoading: false,
    });
  }
}

async function extractImagesFromProductDetailsPage(page: Page) {}
