import { Page } from "playwright";
import {
  Availability,
  DetailedProductInfo,
  ProductReviews,
} from "../../types/offer";
import { AbstractCrawlerDefinition, CrawlerLaunchOptions } from "../abstract";
import {
  convertCurrencySymbolToISO,
  extractDomainFromUrl,
  extractNumberFromText,
} from "../../utils";
import { log } from "crawlee";

export class WayfairCrawlerDefinition extends AbstractCrawlerDefinition {
  /**
   * This retailer does not use category scraping, it gets the URLs from sitemap
   */
  extractCardProductInfo(): Promise<undefined> {
    return Promise.resolve(undefined);
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    const name = await this.extractProperty(
      page,
      "div[data-enzyme-id='PdpLayout-infoBlock'] header h1",
      (node) => node.textContent(),
      false
    ).then((text) => text?.trim());
    if (!name) {
      throw new Error("Could not extract product name");
    }

    const brand = await this.extractProperty(
      page,
      "div[data-enzyme-id='PdpLayout-infoBlock'] a[data-enzyme-id='pdp-title-block-manufacturer-name']",
      (node) => node.textContent()
    ).then((text) => text?.trim());

    const description = await this.extractProperty(
      page,
      "div.ProductOverviewItem .ProductOverviewInformation-content",
      (node) => node.textContent()
    ).then((text) => text?.trim());

    const [price, currency] = await this.extractPriceAndCurrency(page);

    let originalPrice = undefined;
    const originalPriceText = await this.extractProperty(
      page,
      "div[data-enzyme-id='PdpLayout-infoBlock'] .SFPrice s",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    if (!originalPriceText) {
      log.debug("Cannot extract original price of product");
      originalPrice = undefined;
    } else {
      originalPrice = extractPriceAndCurrencyFromText(originalPriceText)[0];
    }

    const onSaleText = await this.extractProperty(
      page,
      "div[data-enzyme-id='PdpLayout-infoBlock'] .SFPrice span:first-child",
      (node) => node.last().textContent()
    );
    const isDiscounted =
      originalPrice !== undefined ||
      (onSaleText !== undefined && onSaleText.includes("Im Angebot"));

    const outOfStockOverlayExist =
      (await page.locator(".OutOfStockOverlay").count()) > 0;
    const availability = outOfStockOverlayExist
      ? Availability.OutOfStock
      : Availability.InStock;

    const skuText = await this.extractProperty(
      page,
      ".PdpLayoutResponsive-breadcrumbWrap nav li:last-child",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    const sku = skuText?.replace("SKU:", "").trim();

    const mpn = await this.extractMPN(page);

    const reviews = await this.extractReviews(page);

    const categoryTree = await this.extractCategoryTree(
      page.locator(".PdpLayoutResponsive-breadcrumbWrap nav li a"),
      0
    );

    const images = (await page
      .locator("li.ProductDetailImageCarousel-carouselItem img")
      .evaluateAll((nodes) => {
        return nodes.map((node) => node.getAttribute("src"));
      })
      .then((url) => url.filter((url) => url !== null))) as string[];

    const specifications = await this.extractSpecificationsFromTable(
      page.locator("div.ProductOverviewItem  dl dt.kwjygg5_6101"),
      page.locator("div.ProductOverviewItem  dl dd.kwjygg6_6101")
    );

    return {
      name,
      url: page.url(),

      brand,
      description,
      price,
      currency,
      isDiscounted,
      originalPrice,

      gtin: undefined,
      sku,
      mpn,

      categoryTree, //categoryTree is only optional if we already scraped it in the category page.

      availability,

      images, // if not applicable return an empty array
      reviews,
      specifications, // if not applicable return an empty array

      variantGroupUrl: undefined,
      variant: 0, // 0, 1, 2, 3, ...

      metadata: {},
    };
  }

  async extractReviews(page: Page): Promise<ProductReviews> {
    const averageReviewText = await this.extractProperty(
      page,
      "div[data-enzyme-id='PdpLayout-infoBlock'] .ProductRatingNumberWithCount-rating",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    const averageReview = averageReviewText ? parseFloat(averageReviewText) : 0;

    const reviewCountText = await this.extractProperty(
      page,
      "div[data-enzyme-id='PdpLayout-infoBlock'] .ProductRatingNumberWithCount-count",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    const reviewCount = extractNumberFromText(reviewCountText || "0");

    const reviews: ProductReviews = {
      reviewCount,
      averageReview,
      recentReviews: [],
    };

    return reviews;
  }

  async extractPriceAndCurrency(page: Page): Promise<[number, string]> {
    const priceAndCurrencyText = await this.extractProperty(
      page,
      "div[data-enzyme-id='PdpLayout-infoBlock'] .SFPrice span:first-child",
      (node) => node.first().textContent(),
      false
    ).then((text) => text?.trim());
    if (!priceAndCurrencyText) {
      throw new Error("Cannot extract price of product");
    }

    return extractPriceAndCurrencyFromText(priceAndCurrencyText);
  }

  async extractMPN(page: Page): Promise<string | undefined> {
    const candidateScriptTexts = await page
      .locator("script[type='text/javascript']:not([src])")
      .allTextContents();

    for (const scriptText of candidateScriptTexts) {
      if (scriptText.startsWith('window["WEBPACK_ENTRY_DATA"]')) {
        const mpnMatch = scriptText.match(/"partNumber":"(.+?)"/);
        if (mpnMatch) {
          return mpnMatch[1];
        }
      }
    }

    return undefined;
  }

  static async create(
    launchOptions?: CrawlerLaunchOptions
  ): Promise<WayfairCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets();

    return new WayfairCrawlerDefinition({
      detailsDataset,
      listingDataset,
      launchOptions,
    });
  }
}
/** "1.519,99 €" -> [1519.99, "EUR"] */
export function extractPriceAndCurrencyFromText(
  text: string
): [number, string] {
  text = text
    .trim()
    .replaceAll(".", "")
    .replaceAll(",", ".")
    .replaceAll("\u00A0", " "); // replace non-breaking space with normal space
  const price = parseFloat(text.split(" ")[0]);
  const currencySymbol = text.trim().split(" ")[1];
  const currency = convertCurrencySymbolToISO(currencySymbol);

  return [price, currency];
}
