import { Locator, Page } from "playwright";
import {
  DetailedProductInfo,
  ListingProductInfo,
  Specification,
} from "../../types/offer";
import { AbstractCrawlerDefinition, CrawlerLaunchOptions } from "../abstract";
import {
  convertCurrencySymbolToISO,
  extractNumberFromText,
  extractRootUrl,
} from "../../utils";
import { log } from "crawlee";

export class AmazonCrawlerDefinition extends AbstractCrawlerDefinition {
  /**
   * This retailer does not use category scraping, it gets the URLs from sitemap
   */
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
      popularityIndex: -1, // will be overwritten later
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

    const price = await this.extractPriceFromProductPage(page);
    const currencySymbol = await this.extractProperty(
      page,
      "div#buybox #corePrice_feature_div .a-price-symbol",
      (node) => node.textContent()
    ).then((text) => text?.trim());

    let currency;
    if (!currencySymbol) {
      log.error("Cannot extract currency, default to EUR", { url: page.url() });
      currency = "EUR";
    } else {
      currency = convertCurrencySymbolToISO(currencySymbol);
    }

    const specifications = await this.extractSpecifications(page);

    const brand = specifications.find(
      (spec) => spec.key === "Manufacturer"
    )?.value;
    const mpn = specifications.find(
      (spec) => spec.key === "Item model number"
    )?.value;

    const additionalInfo = await this.extractAdditionalProductInfo(page);
    const asin = additionalInfo.find((spec) => spec.key === "ASIN")?.value;

    const categoryTree = await this.extractCategoryTree(
      page.locator("div#wayfinding-breadcrumbs_container li a")
    );

    const imageLocator = await page.locator("div#main-image-container img");
    const imagesCount = await imageLocator.count();
    const images = [];
    for (let i = 0; i < imagesCount; i++) {
      const imgUrl = await imageLocator.nth(i).getAttribute("src");
      if (imgUrl) {
        images.push(imgUrl);
      }
    }

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

      availability: "in_stock",

      images,
      reviews: undefined,
      specifications,
    };
  }

  async extractPriceFromProductPage(page: Page): Promise<number> {
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

    if (!priceWhole || !priceFraction) {
      throw new Error("Cannot extract price");
    }

    const priceText =
      extractNumberFromText(priceWhole) +
      "." +
      extractNumberFromText(priceFraction);
    const price = parseFloat(priceText);
    return price;
  }

  async extractSpecifications(page: Page): Promise<Specification[]> {
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

  async extractAdditionalProductInfo(page: Page): Promise<Specification[]> {
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

  static async create(
    launchOptions?: CrawlerLaunchOptions
  ): Promise<AmazonCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets();

    return new AmazonCrawlerDefinition({
      detailsDataset,
      listingDataset,
      productCardSelector:
        "div#ProductGrid-Ct9ptr3yu4 ul li.ProductGridItem__itemOuter__KUtvv",
      detailsUrlSelector: "main div.grid article a",
      // listingUrlSelector: "",
      // cookieConsentSelector: "",
      dynamicProductCardLoading: true,
      launchOptions,
    });
  }
}
