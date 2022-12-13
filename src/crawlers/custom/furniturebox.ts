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
import {
  createCrawlerDefinitionOption,
  extractCardProductInfo as baseExtractCardProductInfo,
  extractProductDetails as baseExtractProductDetails,
} from "./base-chill";

export class FurnitureboxCrawlerDefinition extends AbstractCrawlerDefinition {
  async extractCardProductInfo(
    categoryUrl: string,
    productCard: Locator
  ): Promise<ListingProductInfo> {
    return baseExtractCardProductInfo(this, categoryUrl, productCard);
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    const productInfo = await baseExtractProductDetails(this, page);

    const productName = await this.extractProperty(
      page,
      "h1[data-cy='product_title'] span",
      (node) =>
        node.allTextContents().then((textContents) => textContents.join(" "))
    ).then((text) => text?.trim());
    if (!productName) {
      throw new Error("Cannot extract productName");
    }

    const description = await this.extractProperty(
      page,
      "div#ProductHighlightsDescription",
      (node) => node.innerText()
    ).then((text) => text?.trim());

    let articleNumber = undefined;
    let specifications = [];
    try {
      const specificationsExpander = page.locator("button#Overiew_SpecsClick");
      await specificationsExpander.click({ timeout: 5000 });
      articleNumber = await this.extractProperty(
        page,
        "//div[contains(@class, 'articleNumber')]/span",
        (node) => node.textContent()
      ).then((text) => text?.trim());

      const specificationRowLocator = page.locator("div.g1SBP tr");
      const specificationsCount = await specificationRowLocator.count();
      for (let i = 0; i < specificationsCount; i++) {
        const specLocator = specificationRowLocator.nth(i);
        const specKey = await specLocator
          .locator("xpath=.//td[1]")
          .textContent()
          .then((text) => text?.trim());
        const specValue = await specLocator
          .locator("xpath=.//td[2]//span")
          .allTextContents()
          .then((textContents) => textContents.join(" ").trim());

        if (specKey && specValue) {
          specifications.push({
            key: specKey,
            value: specValue,
          });
        }
      }
    } catch (e) {
      log.info(`Specification not found for product with url: ${page.url()}`);
    }

    return {
      ...productInfo,
      name: productName,
      description,
      specifications,
    };
  }

  static async create(): Promise<FurnitureboxCrawlerDefinition> {
    const options = await createCrawlerDefinitionOption();

    return new FurnitureboxCrawlerDefinition(options);
  }
}
