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

export class BernoMoblerCrawlerDefinition extends AbstractCrawlerDefinition {
  async extractCardProductInfo(
    categoryUrl: string,
    productCard: Locator
  ): Promise<ListingProductInfo> {
    const productName = await this.extractProperty(productCard, "h3", (node) =>
      node.textContent()
    ).then((text) => text?.trim());
    if (!productName) throw new Error("Cannot find productName of productCard");

    const url = await this.extractProperty(productCard, "a", (node) =>
      node.getAttribute("href")
    );
    if (!url) throw new Error("Cannot find url of productCard");

    return {
      name: productName,
      url,
      popularityIndex: -1, // will be overwritten later
      categoryUrl,
    };
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    const productNameSelector =
      "div.product-grid__content .product-single__title";
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
      "div.product-grid__content .rte p",
      (node) => node.first().textContent()
    ).then((text) => text?.trim());

    const prices = await extractPricesFromProductDetailsPage(page);
    const price = prices[0];
    const originalPrice = prices[1];

    const isDiscounted =
      originalPrice === null || originalPrice === undefined ? false : true;

    const metadata: OfferMetadata = {};
    const schemaOrgString = await page
      .locator(
        "//script[@type='application/ld+json' and contains(text(), 'schema.org') and contains(text(), 'Product')]"
      )
      .textContent();
    if (!schemaOrgString) {
      throw new Error("Cannot extract schema.org data");
    }
    const schemaOrg = JSON.parse(schemaOrgString);
    metadata.schemaOrg = schemaOrg;

    const brand = metadata.schemaOrg?.brand;
    const gtin = metadata.schemaOrg?.gtin;
    const sku = metadata.schemaOrg?.sku;
    let availability;
    try {
      availability = schemaOrg.offers[0].availability.includes("InStock")
        ? "in_stock"
        : "out_of_stock";
    } catch (error) {
      throw new Error("Cannot extract availability of product");
    }

    const imageUrls = await extractImagesFromProductDetailsPage(page);
    const reviews: "unavailable" | ProductReviews = "unavailable";
    // TODO: implement scraping specs
    const specifications: Specification[] = [];

    const productInfo = {
      brand,
      name: productName,
      description,
      url: page.url(),
      price: <number>price,
      currency: "SEK",
      isDiscounted,
      originalPrice,

      gtin,
      sku,

      availability,
      images: imageUrls,
      reviews,
      specifications,
      // categoryTree: [], // this will be replaced later by value from when we scrape category
      metadata,
    };

    return productInfo;
  }

  static async create(): Promise<BernoMoblerCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets();

    return new BernoMoblerCrawlerDefinition({
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
async function extractPricesFromProductDetailsPage(page: Page) {
  const allPriceTexts = await page
    .locator("div.product-block--price span")
    .allTextContents();
  if (!allPriceTexts || allPriceTexts.length === 0) {
    throw new Error("Cannot extract price");
  }
  if (allPriceTexts.length >= 3) {
    throw new Error("Cannot extract price: found too many priceTexts");
  }

  if (allPriceTexts.length === 1) {
    const price = extractPriceFromPriceText(allPriceTexts[0]);
    const originalPrice = undefined;
    return [price, originalPrice];
  } else {
    // allPriceTexts.length === 2
    const prices = allPriceTexts.map((text) => extractPriceFromPriceText(text));
    const price = Math.max(...prices);
    const originalPrice = Math.min(...prices);

    return [price, originalPrice];
  }
}

function extractPriceFromPriceText(priceText: string): number {
  return parseInt(priceText.replace(" ", "").replace("SEK", ""));
}

async function extractImagesFromProductDetailsPage(
  page: Page
): Promise<string[]> {
  const imageUrls: string[] = [];
  const imageLocator = page.locator(
    "div.product__photos div.product-main-slide img"
  );
  const imagesCount = await imageLocator.count();
  for (let i = 0; i < imagesCount; i++) {
    const imgUrl = await imageLocator
      .nth(i)
      .getAttribute("data-photoswipe-src");
    if (!imgUrl) continue;
    if (imgUrl.startsWith("//")) {
      imageUrls.push("https:" + imgUrl);
    }
  }

  return imageUrls;
}
