import { Locator, Page } from "playwright";
import {
  Availability,
  DetailedProductInfo,
  ListingProductInfo,
  ProductReviews,
  Specification,
} from "../../types/offer";
import { AbstractCrawlerDefinition, CrawlerLaunchOptions } from "../abstract";
import { convertCurrencySymbolToISO, extractNumberFromText } from "../../utils";
import { log, PlaywrightCrawlingContext, playwrightUtils } from "crawlee";

/**
 * NOTE 1: this crawler has only been tested on amazon.de.
 * Toan have seen that other domains (.com, .co.uk, .it, ...) have different layouts
 * and might require different selectors.
 *
 * NOTE 2: a lot of the selection is based on having the text in English.
 * Doesn't work for German. Be sure to feed it with English URLs only.
 * To convert a page to English, add `/-/en/`. For example:
 * https://www.amazon.de/dp/B07XVKG5ZQ -> https://www.amazon.de/-/en/dp/B07XVKG5ZQ
 *
 * NOTE 3: Amazon really don't like page.waitForLoadState("networkidle").
 * It will just time out. So avoid using it whenever possible.
 */
export class AmazonCrawlerDefinition extends AbstractCrawlerDefinition {
  /**
   * Handle infinite scroll.
   * Usually you just need to scroll down and then more products will be loaded,
   * but sometimes it doesn't do that automatically. Then you need to click a button.
   * As of 2023-06-07, this can be replicated in your browser by going to a category page
   * -> scroll down really fast to the bottom -> scroll up a bit.
   */
  override async scrollToBottom(ctx: PlaywrightCrawlingContext): Promise<void> {
    const page = ctx.page;

    let lastScrollHeight = 0;
    let currentScrollHeight = await page.evaluate(
      () => document.body.scrollHeight
    );
    let pageExpanded = false;

    // Scroll until the page doesn't expand anymore
    do {
      log.debug(`Scrolling... ${lastScrollHeight} -> ${currentScrollHeight}`);
      await super.scrollToBottom(ctx);

      // Check if the page expanded after scrolling
      lastScrollHeight = currentScrollHeight;
      currentScrollHeight = await page.evaluate(
        () => document.body.scrollHeight
      );
      pageExpanded = lastScrollHeight < currentScrollHeight;
      if (pageExpanded) {
        log.debug("Page expanded automatically after scrolling");
        continue;
      }

      // Check if there is a "load more" button to expand the page with more products
      const loadMoreButton = page.locator(
        "div#ProductGrid-Ct9ptr3yu4 button.ShowMoreButton__button__gp7D2"
      );
      if ((await loadMoreButton.count()) > 0) {
        await this.handleCookieConsent(page);
        await loadMoreButton.click();

        const startWaitTime = Date.now();
        let timedOut = false;
        do {
          log.debug("Waiting for button click to take effect");
          await new Promise((f) => setTimeout(f, 1000));

          const newScrollHeight = await page.evaluate(
            () => document.body.scrollHeight
          );
          pageExpanded = newScrollHeight > currentScrollHeight;
          timedOut = Date.now() - startWaitTime > 10000;
        } while (!pageExpanded && !timedOut);
      }
    } while (pageExpanded);

    await this.registerProductCards(ctx);
  }

  async extractCardProductInfo(
    categoryUrl: string,
    productCard: Locator
  ): Promise<ListingProductInfo> {
    const name = await this.extractProperty(
      productCard,
      "a.Title__title__z5HRm",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    if (!name) {
      throw new Error("Cannot extract productName");
    }

    const url = await this.extractProperty(
      productCard,
      "a.Title__title__z5HRm",
      (node) => node.getAttribute("href")
    );
    if (!url) throw new Error("Cannot find url of productCard");

    return {
      name,
      url,
      categoryUrl,
    };
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    const productNameSelector = "h1#title";
    await page.waitForSelector(productNameSelector);

    const productName = await this.extractProperty(
      page,
      productNameSelector,
      (node) => node.textContent()
    ).then((text) => text?.trim());
    if (!productName) {
      throw new Error("Cannot extract productName");
    }

    const description = await this.extractProperty(
      page,
      "div#featurebullets_feature_div ul",
      (node) => node.first().textContent()
    ).then((text) => text?.trim());

    const [price, currency] = await this.extractPriceAndCurrencyFromProductPage(
      page
    );
    const availability = await this.extractAvailability(page);
    if (availability !== Availability.OutOfStock && (!price || price === 0)) {
      log.error("Cannot extract price and currency from product page", {
        url: page.url(),
      });
    }

    const specifications = await this.extractSpecifications(page);

    const brand = specifications.find(
      (spec) => spec.key === "Manufacturer"
    )?.value;

    const mpn = specifications.find(
      (spec) => spec.key === "Item model number" || spec.key === "Model Number"
    )?.value;

    const asin = extractASINFromUrl(page.url());

    const categoryTree = await this.extractCategoryTree(
      page.locator("div#wayfinding-breadcrumbs_container li a")
    );

    const images = await this.extractImagesFromProductPage(page);

    const reviews = await this.extractReviews(page);

    return {
      name: productName,
      url: page.url(),

      brand,
      description,
      price,
      currency,
      isDiscounted: false,
      originalPrice: 0,

      gtin: undefined,
      sku: asin,
      mpn: mpn,

      categoryTree,

      metadata: {},

      availability,

      images,
      reviews,
      specifications,
    };
  }
  async extractReviews(page: Page): Promise<ProductReviews | undefined> {
    const reviewCountText = await this.extractProperty(
      page,
      "#averageCustomerReviews #acrCustomerReviewText",
      (node) => node.first().textContent()
    ).then((text) => text?.trim());
    if (!reviewCountText) {
      return undefined;
    }

    const reviewRatingText = await this.extractProperty(
      page,
      "#averageCustomerReviews #acrPopover a > span",
      (node) => node.first().textContent()
    ).then((text) => text?.trim());
    if (!reviewRatingText) {
      return undefined;
    }

    const reviews: ProductReviews = {
      reviewCount: parseInt(
        reviewCountText.replace(/,/g, "").replace(/./g, "")
      ),
      averageReview: parseFloat(reviewRatingText.trim()),
      recentReviews: [],
    };
    return reviews;
  }

  async extractImagesFromProductPage(page: Page) {
    // Hover over the thumbnail to load the full size images
    const thumbnailLocator = await page.locator(
      "div#altImages .imageThumbnail"
    );
    const thumbnailCount = await thumbnailLocator.count();
    for (let i = 0; i < thumbnailCount; i++) {
      await thumbnailLocator.nth(i).hover();
      await new Promise((f) => setTimeout(f, 200));
    }

    // Extract the full size images
    const imageLocator = await page.locator("div.imgTagWrapper img");
    const imagesCount = await imageLocator.count();
    const images = [];
    for (let i = 0; i < imagesCount; i++) {
      const imgUrl = await imageLocator.nth(i).getAttribute("src");
      if (imgUrl) {
        images.push(imgUrl);
      }
    }

    return images;
  }

  async extractPriceAndCurrencyFromProductPage(
    page: Page
  ): Promise<[number, string]> {
    let priceText;
    let currency;

    // Buybox price type 1
    const priceWhole = await this.extractProperty(
      page,
      "div#buybox #corePrice_feature_div .a-price-whole",
      (node) => node.textContent()
    ).then((text) => text?.trim());

    const priceFraction = await this.extractProperty(
      page,
      "div#buybox #corePrice_feature_div .a-price-fraction",
      (node) => node.textContent()
    ).then((text) => text?.trim());

    if (priceWhole && priceFraction) {
      priceText =
        extractNumberFromText(priceWhole) +
        "." +
        extractNumberFromText(priceFraction);
      const price = parseFloat(priceText);

      const currencySymbol = await this.extractProperty(
        page,
        "div#buybox #corePrice_feature_div .a-price-symbol",
        (node) => node.textContent()
      ).then((text) => text?.trim());

      if (!currencySymbol) {
        log.error("Cannot extract currency, default to EUR", {
          url: page.url(),
          currencySymbol,
        });
        currency = "EUR";
      } else {
        currency = convertCurrencySymbolToISO(currencySymbol);
      }

      return [price, currency];
    }

    // Buybox price type 2
    priceText = await this.extractProperty(
      page,
      "div#buybox #price_inside_buybox",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    if (priceText && priceText.startsWith("€")) {
      priceText = priceText.substring(1);
      const price = parseFloat(priceText);
      return [price, "EUR"];
    }

    // Buybox price type 3 - buybox is used product
    priceText = await this.extractProperty(
      page,
      "div#buybox #usedBuySection .offer-price",
      (node) => node.first().textContent()
    ).then((text) => text?.trim());
    if (priceText && priceText.startsWith("€")) {
      priceText = priceText.substring(1);
      const price = parseFloat(priceText);
      return [price, "EUR"];
    }

    // No price and currency data found. Potentially out of stock.
    return [0, "EUR"];
  }

  async extractSpecifications(page: Page): Promise<Specification[]> {
    // Info on the AdditionalProductInfo table is not really
    // "product specification", but rather additional "metadata" of the product.
    // Thus we do not include it anymore.
    // return [
    //   ...(await this.extractSpecificationTechnicalDetails(page)),
    //   ...(await this.extractSpecificationAdditionalProductInfo(page)),
    // ];

    return await this.extractSpecificationTechnicalDetails(page);
  }

  /** A.k.a. the left table  */
  async extractSpecificationTechnicalDetails(
    page: Page
  ): Promise<Specification[]> {
    const specifications: Specification[] = [];
    const specKeys = await page
      .locator("div#prodDetails table#productDetails_techSpec_section_1 tr th")
      .allTextContents()
      .then(
        (textContents) =>
          textContents.map((text) => text.replace("\u200E", "").trim())
        // \u200E is the special &lrm; character from Amazon website
      );
    const specVals = await page
      .locator("div#prodDetails table#productDetails_techSpec_section_1 tr td")
      .allTextContents()
      .then(
        (textContents) =>
          textContents.map((text) => text.replace("\u200E", "").trim())
        // \u200E is the special &lrm; character from Amazon website
      );
    if (specKeys.length === specVals.length) {
      for (let i = 0; i < specKeys.length; i++) {
        specifications.push({
          key: specKeys[i],
          value: specVals[i],
        });
      }
    } else {
      log.error("Number of specification keys and vals mismatch", {
        nrKeys: specKeys.length,
        nrVals: specVals.length,
      });
    }
    return specifications;
  }

  /** A.k.a. the right table  */
  async extractSpecificationAdditionalProductInfo(
    page: Page
  ): Promise<Specification[]> {
    const additionalInfo: Specification[] = [];
    const infoKeys = await page
      .locator(
        "div#prodDetails table#productDetails_detailBullets_sections1 tr th"
      )
      .allTextContents()
      .then(
        (textContents) =>
          textContents.map((text) => text.replace("\u200E", "").trim())
        // \u200E is the special &lrm; character from Amazon website
      );
    const infoVals = await page
      .locator(
        "div#prodDetails table#productDetails_detailBullets_sections1 tr td"
      )
      .allTextContents()
      .then(
        (textContents) =>
          textContents.map((text) => text.replace("\u200E", "").trim())
        // \u200E is the special &lrm; character from Amazon website
      );
    if (infoKeys.length === infoVals.length) {
      for (let i = 0; i < infoKeys.length; i++) {
        additionalInfo.push({
          key: infoKeys[i],
          value: infoVals[i],
        });
      }
    } else {
      log.error("Number of additional info keys and vals mismatch", {
        nrKeys: infoKeys.length,
        nrVals: infoVals.length,
      });
    }
    return additionalInfo;
  }

  async extractAvailability(page: Page): Promise<Availability> {
    // Method 1: identify using the availability text
    const availabilityText = await this.extractProperty(
      page,
      "div#availability",
      (node) => node.textContent()
    );
    if (!availabilityText) {
      log.debug("No availability text found");
      return Availability.OutOfStock;
    }
    if (
      availabilityText?.toLowerCase().includes("unavailable") ||
      availabilityText?.toLowerCase().includes("out of stock")
    ) {
      return Availability.OutOfStock;
    }

    // Method 2: identify using the "Add to Cart/Basket" button
    const addToCartButtonText = await this.extractProperty(
      page,
      "div#buybox #add-to-cart-button-ubb",
      (node) => node.textContent()
    );
    if (!addToCartButtonText) {
      log.debug(
        "No add to cart button text found - product is probably out of stock"
      );
      return Availability.OutOfStock;
    }

    return Availability.InStock;
  }

  override getSearchUrl(
    query: string,
    retailerDomain: string = "amazon.de"
  ): string {
    return `https://www.${retailerDomain}/s?k=${query}`;
  }

  override async isEmptySearchResultPage(page: Page): Promise<boolean> {
    const resultText = await page
      .locator(".s-result-list .s-result-item:first-child")
      .textContent();
    if (resultText?.includes("No results")) {
      return true;
    }

    return false;
  }

  override async crawlIntermediateCategoryPage(
    ctx: PlaywrightCrawlingContext
  ): Promise<void> {
    // Entry point: https://www.amazon.de/-/en/stores/VentureHome/page/E5D1A8C2-2630-4D5F-80DF-8EC90CEA6CC0?ref_=ast_bln

    await ctx.enqueueLinks({
      selector: "nav div.level2  li:not(.Navigation__isHeading__ArXQd) a",
      label: "LIST",
    });
  }

  override normalizeProductUrl(url: string): string {
    return normalizeAmazonUrl(url);
  }

  static async create(
    launchOptions?: CrawlerLaunchOptions
  ): Promise<AmazonCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets();

    return new AmazonCrawlerDefinition({
      detailsDataset,
      listingDataset,
      productCardSelector: "ul li.ProductGridItem__itemOuter__KUtvv",
      detailsUrlSelector: "main div.grid article a",
      // listingUrlSelector: "",
      searchUrlSelector: "div.s-card-container h2 a",
      searchMaxUrls: 8,
      // cookieConsentSelector: "",
      dynamicProductCardLoading: false,
      launchOptions,
    });
  }
}

export function extractASINFromUrl(url: string): string {
  // /dp/{ASIN} or /gp/{ASIN}
  const asinMatch = url.match(/\/[dg]p\/([^\/?]+)/);
  if (asinMatch) {
    return asinMatch[1];
  }
  throw new Error("Could not extract ASIN from URL");
}

export function normalizeAmazonUrl(url: string): string {
  const asin = extractASINFromUrl(url);
  const rootUrl = new URL(url).origin;
  return `${rootUrl}/-/en/dp/${asin}`;
}
