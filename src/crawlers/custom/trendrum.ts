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

export class TrendrumCrawlerDefinition extends AbstractCrawlerDefinition {
  override async extractCardProductInfo(
    categoryUrl: string,
    productCard: Locator
  ): Promise<ListingProductInfo> {
    const productName = await this.extractProperty(
      productCard,
      "a.itemTitle",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    if (!productName) throw new Error("Cannot find productName of productCard");

    const url = await this.extractProperty(productCard, "a.itemTitle", (node) =>
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

  override async extractProductDetails(
    page: Page
  ): Promise<DetailedProductInfo> {
    const productNameSelector = "div.infodisplay_headerbox h1";
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
      "div.products_description span",
      (node) => node.textContent()
    ).then((text) => text?.trim());

    const priceText = await this.extractProperty(
      page,
      "div.productPrices span.currentprice",
      (node) => node.textContent()
    );
    if (!priceText) {
      throw new Error("Cannot extract price");
    }
    const price = extractNumberFromText(priceText);

    const schemaOrgString = await page
      .locator(
        "//script[@type='application/ld+json' and contains(text(), 'schema.org') and contains(text(), 'Product')]"
      )
      .textContent();
    if (!schemaOrgString) {
      throw new Error("Cannot extract schema.org data");
    }
    const schemaOrg = JSON.parse(schemaOrgString);

    const brand = schemaOrg?.brand.name;
    const imageUrls = schemaOrg?.image;
    let availability;
    try {
      availability = schemaOrg.offers[0].availability.includes("InStock")
        ? "in_stock"
        : "out_of_stock";
    } catch (error) {
      throw new Error("Cannot extract availability of product");
    }

    const reviews: ProductReviews | "unavailable" =
      "aggregateRating" in schemaOrg
        ? {
            averageReview: schemaOrg.aggregateRating.ratingValue,
            reviewCount: schemaOrg.aggregateRating.reviewCount,
            recentReviews: [],
          }
        : "unavailable";

    const categoryTree = await this.extractCategoryTree(
      page.locator("div#navBreadCrumb a"),
      1,
      true
    );

    const productInfo: DetailedProductInfo = {
      brand,
      name: productName,
      description,
      url: page.url(),
      price: price,
      currency: "SEK",
      isDiscounted: false, // cannot find originalPrice in page
      originalPrice: undefined, // cannot find originalPrice in page

      gtin: undefined,
      sku: undefined,

      availability,
      images: imageUrls,
      reviews,
      specifications: [], // TODO
      categoryTree,
      metadata: { schemaOrg },
    };

    return productInfo;
  }

  static async create(): Promise<TrendrumCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets();

    return new TrendrumCrawlerDefinition({
      detailsDataset,
      listingDataset,
      productCardSelector: "div.productListingOuterBox",
      detailsUrlSelector: "div.productListingOuterBox a.itemTitle",
      listingUrlSelector: "div.navSplitPagesLinks a",
      // cookieConsentSelector: "",
      dynamicProductCardLoading: false,
    });
  }
}
