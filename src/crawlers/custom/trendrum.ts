import { chromium, Locator, Page } from "playwright";
import {
  browserCrawlerEnqueueLinks,
  Dataset,
  Dictionary,
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
      1
    );
    categoryTree.pop(); // remove last element, which is this product page

    const specifications: Specification[] = [];
    const specKeys = await page
      .locator("table td.attribName")
      .allTextContents()
      .then((textContents) => textContents.map((text) => text.trim()));
    const specVals = await page
      .locator("table td.attribValue")
      .allTextContents()
      .then((textContents) => textContents.map((text) => text.trim()));
    if (specKeys.length !== specVals.length) {
      throw new Error("Number of specification keys and vals mismatch");
    }
    for (let i = 0; i < specKeys.length; i++) {
      specifications.push({
        key: specKeys[i],
        value: specVals[i],
      });
    }

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
      specifications,
      categoryTree,
      metadata: { schemaOrg },
    };

    return productInfo;
  }

  override async crawlIntermediateCategoryPage(
    ctx: PlaywrightCrawlingContext
  ): Promise<void> {
    // Entry point: https://www.trendrum.se/
    const page = ctx.page;

    await this.handleCookieConsent(page);

    const topLevelCategoryButtons = await page.locator("ul.nav > li");
    const topLevelCategoryButtonsCount = await topLevelCategoryButtons.count();
    // Hover over each top level category button to dynamic-load the subcategories
    for (let i = 0; i < topLevelCategoryButtonsCount; i++) {
      const button = await topLevelCategoryButtons.nth(i);
      await button.hover();
      await page.waitForTimeout(1000);
    }

    // Get hrefs of all subcategories:
    await ctx.enqueueLinks({
      selector: "ul.nav ul li a",
      label: "LIST",
    });

    // Get hrefs of all main categories without subcategories:
    await ctx.enqueueLinks({
      selector: "ul.nav > li div > a:last-child",
      label: "LIST",
    });
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
      cookieConsentSelector: "div.cookieTextHolderExtended span.cookieButton",
      dynamicProductCardLoading: false,
    });
  }
}
