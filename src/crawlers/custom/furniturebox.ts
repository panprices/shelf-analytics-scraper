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

  override async crawlDetailPage(
    ctx: PlaywrightCrawlingContext
  ): Promise<void> {
    // NOTE: beware of performance issues with this. Since we have to click
    // buttons to open variant groups to know the url, we have to click a lot.
    // For example if there are 4 variants -> have to click
    // 4 variant pages * 3 choose-other-variant-buttons  = 12 times

    // Always scrape at least once:
    await super.crawlDetailPage(ctx);

    // Enqueue the variant groups where you have a.href:
    await ctx.enqueueLinks({
      selector: "div#possibleVariants a",
      label: "DETAIL",
    });
    await ctx.enqueueLinks({
      selector: "div#variantPropertySelectors a",
      label: "DETAIL",
    });

    // Check for secondary variant group where you don't have a.href.
    const secondaryVariantOpenMenuButton = ctx.page.locator(
      "div#productIncludedAddonsBlock div[role='button']"
    );
    const secondaryVariantButtons = ctx.page.locator(
      "div.PJfd6 button[data-cy='selector_option_button']"
    );
    if ((await secondaryVariantOpenMenuButton.count()) >= 0) {
      // Click the menu button to open the menu:
      await secondaryVariantOpenMenuButton.first().click();
      await ctx.page.waitForTimeout(1500);

      const secondaryVariantButtonsCount =
        await secondaryVariantButtons.count();
      console.log("Count: " + secondaryVariantButtonsCount);
      for (let i = 0; i < secondaryVariantButtonsCount; i++) {
        if (i > 0) {
          // Click the menu button to open the menu again:
          await secondaryVariantOpenMenuButton.first().click();
          await ctx.page.waitForTimeout(1500);
        }
        await secondaryVariantButtons.nth(i).click();
        await ctx.page.waitForTimeout(1500);

        await ctx.enqueueLinks({
          urls: [ctx.page.url()],
          label: "DETAIL",
        });
        // await super.crawlDetailPage(ctx);
      }
    }

    // Check for secondary variant group where you don't have a.href.
    // Try to click buttons and enqueue new links:
    // const secondaryVariantButtons = ctx.page.locator(
    //   "div[data-cy='product_variant_link']"
    // );
    // const secondaryVariantButtonsCount = await secondaryVariantButton.count();
    // console.log("Variant counts: " + secondaryVariantButtonsCount);

    // Always have one button grayed out which is the current selected variant,
    // so we only try to enqueue more if there are at least 1 more.

    // const variantUrls = [];
    // if (secondaryVariantButtonsCount >= 2) {
    //   for (let i = 0; i < secondaryVariantButtonsCount; i++) {
    //     await secondaryVariantOpenMenuButton.nth(i).click();
    //     await ctx.page.waitForTimeout(1500);

    //     variantUrls.push(ctx.page.url());
    //     // await ctx.enqueueLinks({
    //     //   urls: [ctx.page.url()],
    //     //   label: "DETAIL",
    //     // });
    //   }
    // }
    // await ctx.enqueueLinks({
    //   urls: variantUrls,
    //   label: "DETAIL",
    // });
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
