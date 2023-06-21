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
import { extractNumberFromText, extractDomainFromUrl } from "../../utils";
import { count } from "console";

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
      categoryUrl,
    };
  }

  override async crawlDetailPage(
    ctx: PlaywrightCrawlingContext
  ): Promise<void> {
    if (await this.hasVariant(ctx.page)) {
      await this.crawlVariantPage(ctx);
    } else {
      await super.crawlDetailPage(ctx);
    }
  }

  async hasVariant(page: Page): Promise<boolean> {
    // If there is a normal price, it means that the product has no variants.
    // Otherwise it has variants.
    try {
      await page
        .locator("div.productPrices span.currentprice")
        .waitFor({ timeout: 5000 });
      return false;
    } catch (e) {
      return true;
    }
  }

  async crawlVariantPage(ctx: PlaywrightCrawlingContext): Promise<void> {
    const page = ctx.page;

    const names = await page.locator(".ProductVariantName").allTextContents();
    const nrProducts = names.length;
    const prices = await page
      .locator(".ProductVariantPrice")
      .allTextContents()
      .then((prices) => prices.map((price) => extractNumberFromText(price)));
    const skus = await this.extractVariantSKUs(page);

    const variantSpecifications: Specification[][] = Array.from(
      { length: nrProducts },
      () => [] as Specification[]
    );

    const specKeys = await page
      .locator(".CompareBoxHolder table td.attribName")
      .allTextContents()
      .then((textContents) => textContents.slice(1).map((text) => text.trim()));
    const specVals = await page
      .locator(".CompareBoxHolder table td.attribValue")
      .allTextContents()
      .then((textContents) =>
        textContents.slice(nrProducts).map((text) => text.trim())
      );
    if (specKeys.length * nrProducts !== specVals.length) {
      throw new Error("Number of specification keys and vals mismatch");
    }
    for (let i = 0; i < specKeys.length; i++) {
      for (let variantIndex = 0; variantIndex < nrProducts; variantIndex++) {
        variantSpecifications[variantIndex].push({
          key: specKeys[i],
          value: specVals[i * nrProducts + variantIndex],
        });
      }
    }

    const baseProductDetails = await this.extractBaseProductDetails(page);
    const products: DetailedProductInfo[] = names.map((name, i) => ({
      ...baseProductDetails,
      name,
      price: prices[i],
      sku: skus[i],
      url: `${baseProductDetails.url}#${skus[i]}`,
      specifications: baseProductDetails.specifications.concat(
        variantSpecifications[i]
      ),
      variant: i,
      variantGroupUrl: baseProductDetails.url,
    }));

    const request = ctx.request;

    for (const productDetails of products) {
      await this._detailsDataset.pushData(<DetailedProductInfo>{
        ...request.userData,
        ...productDetails,
        fetchedAt: new Date().toISOString(),
        retailerDomain: extractDomainFromUrl(ctx.page.url()),
      });
    }
  }

  async extractVariantSKUs(page: Page): Promise<string[]> {
    const skuTexts = await page
      .locator(".ProductVariantModel")
      .allTextContents();
    if (!skuTexts) throw new Error("Cannot extract SKU of variants");

    // "Artikel: 54271.  PG: M53" -> "54271"
    const skus = skuTexts.map((text) =>
      extractNumberFromText(text.split(".")[0]).toString()
    );

    return skus;
  }

  async extractBaseProductDetails(page: Page) {
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
      (node) => node.first().textContent()
    ).then((text) => text?.trim());

    const schemaOrgString = await this.extractProperty(
      page,
      "//script[@type='application/ld+json' and contains(text(), 'schema.org') and contains(text(), 'Product')]",
      (node) => node.textContent()
    );
    if (!schemaOrgString) {
      throw new Error("Cannot extract schema.org data");
    }
    const schemaOrg = JSON.parse(schemaOrgString);

    const brand = schemaOrg?.brand.name;
    const gtin = schemaOrg?.gtin;
    const sku = schemaOrg?.sku;

    let mpn: string = schemaOrg?.mpn;
    if (mpn && mpn.match(/^M[\d]+-/)) {
      mpn = mpn.replace(/^M[\d]+-/, "");
    }

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
      .locator(".FactsBox table td.attribName")
      .allTextContents()
      .then((textContents) => textContents.map((text) => text.trim()));
    const specVals = await page
      .locator(".FactsBox table td.attribValue")
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

    let imageUrls = await this.extractImagesFromProductPage(page);
    if (imageUrls.length === 0) {
      imageUrls = schemaOrg.image;
    }

    const productInfo = {
      brand,
      name: productName,
      description,
      url: page.url(),
      // price,
      currency: "SEK",
      isDiscounted: false, // cannot find originalPrice in page
      originalPrice: undefined, // cannot find originalPrice in page

      gtin,
      sku,
      mpn,

      availability,
      images: imageUrls,
      reviews,
      specifications,
      categoryTree,
      metadata: { schemaOrg },
    };

    return productInfo;
  }

  async extractImagesFromProductPage(page: Page): Promise<string[]> {
    try {
      const images = await page
        .locator(".infodisplay_left span.modal_image")
        .evaluateAll((list: HTMLElement[]) =>
          list.map((element) => <string>element.getAttribute("href"))
        );

      if (images.length !== 0) {
        // remove duplicates
        return [...new Set(images)];
      }
    } catch (error) {
      log.warning("No image found", { url: page.url(), error });
    }

    return [];
  }

  override async extractProductDetails(
    page: Page
  ): Promise<DetailedProductInfo> {
    const priceText = await this.extractProperty(
      page,
      "div.productPrices span.currentprice",
      (node) => node.textContent()
    );
    if (!priceText) {
      throw new Error("Cannot extract price");
    }
    const price = extractNumberFromText(priceText);

    const productInfo = {
      ...(await this.extractBaseProductDetails(page)),
      price,
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
      cookieConsentSelector: ".cookieTextHolderExtended  .cookieButton.all",
      dynamicProductCardLoading: false,
    });
  }
}
