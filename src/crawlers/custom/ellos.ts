import { Locator, Page } from "playwright";
import { Dataset, log, PlaywrightCrawlingContext } from "crawlee";
import { AbstractCrawlerDefinition } from "../abstract";
import {
  DetailedProductInfo,
  IndividualReview,
  ListingProductInfo,
  OfferMetadata,
  ProductReviews,
  SchemaOrg,
} from "../../types/offer";
import { v4 as uuidv4 } from "uuid";
import { extractRootUrl } from "../../utils";
import { extractCardProductInfo } from "./base-chill";

export class EllosCrawlerDefinition extends AbstractCrawlerDefinition {
  override async scrollToBottom(ctx: PlaywrightCrawlingContext): Promise<void> {
    const page = ctx.page;
    const loadMoreButton = page.locator("div.load-more-button");

    while (true) {
      await super.scrollToBottom(ctx);
      await this.handleCookieConsent(page);

      try {
        await loadMoreButton.click({ timeout: 5000 });
        // wait for consistency
        await new Promise((f) => setTimeout(f, 500));
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
      "h2.ellos-full-product-name",
      (node) => node.textContent()
    ).then((text) => {
      // Trim and replace multiple whitespaces/endlines with single white spaces
      return text?.trim().replaceAll(/\s+/g, " ");
    });
    if (!productName) throw new Error("Cannot find productName of productCard");

    const url = await this.extractProperty(
      productCard,
      "xpath=./a[1]",
      (node) => node.getAttribute("href")
    );
    if (!url) throw new Error("Cannot find url of productCard");

    const previewImageUrl = await this.extractProperty(
      productCard,
      "xpath=(..//picture/source)[1]",
      this.extractImageFromSrcSet
    );

    const currentProductInfo: ListingProductInfo = {
      name: productName,
      url,
      previewImageUrl,
      categoryUrl,
      popularityIndex: -1,
    };

    return currentProductInfo;
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    throw new Error("Method not implemented.");
  }

  static async create(): Promise<EllosCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets();

    return new EllosCrawlerDefinition({
      detailsDataset,
      listingDataset,
      detailsUrlSelector: "//article[contains(@class, 'product-card')]//a",
      productCardSelector: "//article[contains(@class, 'product-card')]",
      cookieConsentSelector: "a.cta-ok",
      dynamicProductCardLoading: true,
    });
  }
}
