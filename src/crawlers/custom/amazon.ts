import { Locator, Page } from "playwright";
import {
  Availability,
  DetailedProductInfo,
  ListingProductInfo,
  Specification,
} from "../../types/offer";
import { AbstractCrawlerDefinition, CrawlerLaunchOptions } from "../abstract";
import {
  convertCurrencySymbolToISO,
  extractNumberFromText,
  extractDomainFromUrl,
} from "../../utils";
import { log, PlaywrightCrawlingContext } from "crawlee";

/**
 * NOTE 1: this crawler has only been tested on amazon.de.
 * Toan have seen that other domains (.com, .co.uk, .it, ...) have different layouts
 * and might require different selectors.
 *
 * NOTE 2: a lot of the selection is based on having the text in English.
 * Doesn't work for German. Be sure to feed it with English URLs only.
 * To convert a page to English, add `/-/en/`. For example:
 * https://www.amazon.de/dp/B07XVKG5ZQ -> https://www.amazon.de/-/en/dp/B07XVKG5ZQ
 */
export class AmazonCrawlerDefinition extends AbstractCrawlerDefinition {
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
      log.error("Cannot extract currency, default to EUR", {
        url: page.url(),
        currencySymbol,
      });
      currency = "EUR";
    } else {
      currency = convertCurrencySymbolToISO(currencySymbol);
    }

    const specifications = await this.extractSpecifications(page);

    const brand = specifications.find(
      (spec) => spec.key === "Manufacturer"
    )?.value;
    let mpn = specifications.find(
      (spec) => spec.key === "Item model number"
    )?.value;
    if (!mpn) {
      mpn = specifications.find((spec) => spec.key === "Model Number")?.value;
    }

    const asin = specifications.find((spec) => spec.key === "ASIN")?.value;

    const availability = await this.extractAvailability(page);

    const categoryTree = await this.extractCategoryTree(
      page.locator("div#wayfinding-breadcrumbs_container li a")
    );

    const images = await this.extractImagesFromProductPage(page);

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
      reviews: undefined,
      specifications,
    };
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

  async extractPriceFromProductPage(page: Page): Promise<number | undefined> {
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
      return 0;
    }

    const priceText =
      extractNumberFromText(priceWhole) +
      "." +
      extractNumberFromText(priceFraction);
    const price = parseFloat(priceText);
    return price;
  }

  async extractSpecifications(page: Page): Promise<Specification[]> {
    return [
      ...(await this.extractSpecificationTechnicalDetails(page)),
      ...(await this.extractSpecificationAdditionalProductInfo(page)),
    ];
  }

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
    const availabilityText = await page
      .locator("div#availability")
      .textContent();
    if (
      availabilityText?.toLowerCase().includes("unavailable") ||
      availabilityText?.toLowerCase().includes("out of stock")
    ) {
      return Availability.OutOfStock;
    }

    return Availability.InStock;
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
