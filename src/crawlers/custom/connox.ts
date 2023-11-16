import { Locator, Page } from "playwright";
import { DetailedProductInfo, Specification } from "../../types/offer";
import {
  AbstractCrawlerDefinition,
  AbstractCrawlerDefinitionWithVariants,
  CrawlerLaunchOptions,
} from "../abstract";
import { Dictionary, PlaywrightCrawlingContext, log } from "crawlee";
import { text } from "body-parser";

export class ConnoxCrawlerDefinition extends AbstractCrawlerDefinitionWithVariants {
  /**
   * This retailer does not use category scraping, it gets the URLs from sitemap
   */
  extractCardProductInfo(): Promise<undefined> {
    return Promise.resolve(undefined);
  }

  override async crawlDetailPage(
    ctx: PlaywrightCrawlingContext
  ): Promise<void> {
    // The group URL is also the first variant so we scrape it
    await this.crawlSingleDetailPage(ctx, ctx.page.url(), 0);

    const hasVariants = (await this.getOptionsCountForParamIndex(ctx, 0)) > 0;
    if (hasVariants) {
      await super.crawlDetailPage(ctx);
    }
  }

  override async selectOptionForParamIndex(
    ctx: PlaywrightCrawlingContext<Dictionary>,
    paramIndex: number,
    optionIndex: number
  ): Promise<void> {
    await ctx.page
      .locator("div.product-variant-selection a")
      .nth(paramIndex)
      .click();

    await ctx.page.waitForSelector("ul.product-variants li:not(.active)", {
      state: "visible",
      timeout: 15000,
    });
    await ctx.page
      .locator("ul.product-variants li:not(.active)")
      .nth(optionIndex)
      .click();
  }
  override async hasSelectedOptionForParamIndex(
    _: PlaywrightCrawlingContext<Dictionary>,
    _paramIndex: number
  ): Promise<boolean> {
    // There is always a selected option on connox.dk
    return true;
  }
  override async getOptionsCountForParamIndex(
    ctx: PlaywrightCrawlingContext<Dictionary>,
    paramIndex: number
  ): Promise<number> {
    // Connox only have one dropdown to choose variants
    if (paramIndex >= 1) {
      return 0;
    }
    return ctx.page.locator("ul.product-variants li:not(.active)").count();
  }
  override async checkInvalidVariant(
    _: PlaywrightCrawlingContext<Dictionary>,
    _currentOption: number[]
  ): Promise<boolean> {
    // Cannot select invalid variants on connox.dk
    return false;
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    // return a Dummy `DetailedProductInfo` object
    const productName = await this.extractProperty(
      page,
      "div.product-details h1",
      (node) => node.textContent(),
      false
    ).then((text) => text?.trim());
    if (!productName) {
      throw new Error("Cannot extract productName");
    }

    const brand = await this.extractProperty(
      page,
      "div.product-details a.product-manufacturer-link",
      (node) => node.getAttribute("title")
    ).then((text) => text?.trim());

    const accordionItemLocators = page.locator(
      "section#product-properties div.accordion__item"
    );
    const accordionItemCount = await accordionItemLocators.count();

    let description;
    let specifications: Specification[] = [];
    for (let i = 0; i < accordionItemCount; i++) {
      const headline = await accordionItemLocators
        .nth(i)
        .locator(".accordion__item__headline")
        .textContent()
        .then((text) => text?.trim());
      const accordionContentLocator = accordionItemLocators
        .nth(i)
        .locator(".accordion__item__content");
      switch (headline) {
        case "Beskrivelse":
          description = await accordionContentLocator
            .textContent()
            .then((text) => text?.trim());
          break;
        case "Egenskaber":
          specifications = await this.extractSpecificationsFromTable(
            accordionContentLocator.locator("table tr td:first-child"),
            accordionContentLocator.locator("table tr td:last-child")
          );
          break;
        default:
          log.debug("Unknown accordion headline", {
            accordionHeadline: headline,
          });
      }
    }

    const priceText = await this.extractProperty(
      page,
      "div.product-details div.product-price span.price-value",
      (node) => node.getAttribute("data-price-value")
    ).then((text) => text?.trim());
    if (!priceText) {
      throw new Error("Cannot extract price");
    }
    const price = parseFloat(priceText);

    const originalPriceText = await this.extractProperty(
      page,
      "div.product-details div.product-price span.price-value > s",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    const isDiscounted = originalPriceText !== undefined;
    // "UVP 2.729,50 DKK" -> 2729.5
    const originalPrice = originalPriceText
      ? parseFloat(
          originalPriceText
            .replace("DKK", "")
            .replace("UVP", "")
            .replace(".", "")
            .replace(",", ".")
            .replace(/\s/g, "")
        )
      : undefined;

    const gtin = specifications.find((spec) => spec.key === "EAN")?.value;
    const sku = specifications.find((spec) => spec.key === "Artikelnr.")?.value;

    const images = await this.extractImagesFromDetailedPage(page);

    const categoryTree = await this.extractCategoryTree(
      page.locator("section.breadcrumb ul#breadcrumb li a"),
      1
    );

    return {
      name: productName,
      url: page.url(),

      brand,
      description,
      price,
      currency: "DKK",
      isDiscounted,
      originalPrice,

      gtin,
      sku,
      mpn: undefined,

      categoryUrl: categoryTree[categoryTree.length - 1].url,
      categoryTree,

      metadata: {},

      availability: "in_stock",

      images, // if not applicable return an empty array
      reviews: "unavailable",
      specifications, // if not applicable return an empty array

      // variantGroupUrl: "",
      // variant: 0, // 0, 1, 2, 3, ...
    };
  }

  async extractImagesFromDetailedPage(page: Page): Promise<string[]> {
    await this.handleCookieConsent(page);

    const imagesSelector = page.locator("div.product-gallery img");
    const imageCount = await imagesSelector.count();

    // Most images are lazy-loaded, so we need to click through them first:
    const nextImageButton = page.locator(
      "div.product-gallery div.swiper-button-next"
    );
    for (let i = 0; i < imageCount; i++) {
      await nextImageButton.click();
      await page.waitForTimeout(1000);
    }

    const images = [];
    for (let i = 0; i < imageCount; i++) {
      const url = await imagesSelector.nth(i).getAttribute("src");
      if (url) {
        images.push(url);
      }
    }
    // Deduplicate:
    return [...new Set(images)];
  }

  static async create(
    launchOptions?: CrawlerLaunchOptions
  ): Promise<ConnoxCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets();

    return new ConnoxCrawlerDefinition({
      detailsDataset,
      listingDataset,
      cookieConsentSelector: "a#savecookiesettings-acceptall",
      launchOptions,
    });
  }
}
