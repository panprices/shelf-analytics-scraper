import { Locator, Page } from "playwright";
import { Dictionary, log, PlaywrightCrawlingContext } from "crawlee";

import { AbstractCrawlerDefinition, CrawlerLaunchOptions } from "../abstract";
import {
  DetailedProductInfo,
  ListingProductInfo,
  ProductReviews,
  Specification,
} from "../../types/offer";
import { extractNumberFromText } from "../../utils";
import { CaptchaEncounteredError } from "../../types/errors";
import { getFirestore } from "firebase-admin/firestore";

export class Furniture1CrawlerDefinition extends AbstractCrawlerDefinition {
  /**
   * TODO: Dirty copy paste from Wayfair to scrape overnight, should fix next day
   * @param ctx
   */
  override async assertCorrectProductPage(
    ctx: PlaywrightCrawlingContext<Dictionary>
  ): Promise<void> {
    await super.assertCorrectProductPage(ctx);

    const responseStatus = ctx.response?.status();

    if (responseStatus == 429) {
      throw new CaptchaEncounteredError("Captcha encountered");
    }
  }

  override handleCrawlDetailPageError(
    error: any,
    ctx: PlaywrightCrawlingContext
  ) {
    // For now Captcha logic is wayfair specific
    if (error instanceof CaptchaEncounteredError) {
      log.error(`Captcha encountered`, {
        url: ctx.page.url(),
        requestUrl: ctx.request.url,
        errorType: error.name,
        errorMessage: error.message,
      });

      ctx.session?.retire();
      const firestoreDB = getFirestore();
      const proxyUrl = ctx.proxyInfo?.url;

      // Proxy URL is has the following format: `http://panprices:BB4NC4WQmx@${ip}:60000`
      if (proxyUrl) {
        const proxyIp = proxyUrl.split("@")[1].split(":")[0];
        firestoreDB
          .collection("proxy_status")
          .where("ip", "==", proxyIp)
          .get()
          .then((snapshot) => {
            snapshot.forEach((doc) => {
              firestoreDB
                .collection("proxy_status")
                .doc(doc.id)
                .update({
                  last_burned: new Date(),
                })
                .then(() => log.warning(`IP ${proxyIp} blocked`));
            });
          });
      }

      throw error;
    }
    super.handleCrawlDetailPageError(error, ctx);
  }

  override async crawlDetailPage(
    ctx: PlaywrightCrawlingContext
  ): Promise<void> {
    // Always scrape at least once:
    await super.crawlDetailPage(ctx);

    // Enqueue the variants:
    await ctx.enqueueLinks({
      selector: "div.pdp-bs-variationsItemContent a",
      label: "DETAIL",
      userData: ctx.request.userData,
    });
  }

  async extractCardProductInfo(
    categoryUrl: string,
    productCard: Locator
  ): Promise<ListingProductInfo> {
    const name = await this.extractProperty(
      productCard,
      ".ty-grid-list__item-name > a",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    if (!name) {
      throw new Error("Cannot extract productName");
    }

    const url = await this.extractProperty(
      productCard,
      ".ty-grid-list__item-name > a",
      (node) => node.getAttribute("href")
    );
    if (!url) throw new Error("Cannot find url of productCard");

    const categoryTree = await this.extractCategoryTreeFromCategoryPage(
      productCard.page().locator("main a.ty-breadcrumbs__a"),
      1,
      productCard.page().locator("main span.ty-breadcrumbs__current").first()
    );

    return {
      name,
      url,
      categoryUrl,
      popularityCategory: categoryTree,
    };
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    const productNameSelector = "h1.pdp-buySection-title";
    await page.waitForSelector(productNameSelector);

    const productName = await this.extractProperty(
      page,
      productNameSelector,
      (node) => node.textContent()
    ).then((text) => text?.trim());
    if (!productName) {
      throw new Error("Cannot extract productName");
    }

    // Furniture1 doesn't really have descriptions. Only specifications.
    // There's an "ADDITIONAL INFORMATION" section, but it's generic information
    // for all products of that type.
    const description = undefined;

    const schemaOrgString = await page
      .locator(
        "//script[@type='application/ld+json' and contains(text(), 'schema.org') and contains(text(), 'Product')]"
      )
      .textContent();
    if (!schemaOrgString) {
      throw new Error("Cannot extract schema.org data");
    }
    const schemaOrg = JSON.parse(schemaOrgString);

    let imageUrls = await this.extractImagesFromProductPage(page);
    if (imageUrls.length === 0) {
      imageUrls = schemaOrg?.image;
    }

    const priceText = await this.extractProperty(
      page,
      ".pdp-buySection .ty-price .ty-price-num",
      (node) => node.first().textContent()
    ).then((text) => text?.trim());
    if (!priceText) {
      throw new Error("Cannot extract price of product");
    }
    const price = parseInt(priceText);

    let availability;
    try {
      availability = schemaOrg.offers[0].availability.includes("InStock")
        ? "in_stock"
        : "out_of_stock";
    } catch (error) {
      log.warning("Cannot extract availability of product");
      availability = "in_stock";
    }

    let sku = schemaOrg?.sku;

    const specifications: Specification[] = [];
    const specKeys = await page
      .locator("div#product_tab_features .ty-product-feature_label")
      .allTextContents()
      .then((textContents) => textContents.map((text) => text.trim()));
    const specVals = await page
      .locator("div#product_tab_features .ty-product-feature_value")
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

    const reviews = await this.extractReviews(page);

    const categoryTree = await this.extractCategoryTree(
      page.locator("div.ty-breadcrumbs a"),
      1
    );

    const productInfo: DetailedProductInfo = {
      name: productName,
      description,
      url: page.url().replace("/?redirect=301", ""),
      price,
      currency: "EUR",
      isDiscounted: false, // cannot find any info about discounts
      originalPrice: undefined, // cannot find any info about discounts

      gtin: undefined,
      sku,
      mpn: undefined,

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
        .locator(".owl-item > a > img.ty-pict")
        .evaluateAll((list: HTMLElement[]) =>
          list.map((element) => <string>element.getAttribute("src"))
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

  async extractReviews(page: Page): Promise<ProductReviews | undefined> {
    const averageReviewString = await this.extractProperty(
      page,
      "div.reviews-section .tf-rating",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    if (!averageReviewString) {
      return undefined;
    }

    const reviewCountString = await this.extractProperty(
      page,
      "div.reviews-section .tf-based",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    if (!reviewCountString) {
      return undefined;
    }

    const averageReview = parseFloat(averageReviewString);
    const reviewCount = extractNumberFromText(reviewCountString);

    const reviews: ProductReviews = {
      averageReview,
      reviewCount,
      recentReviews: [],
    };
    return reviews;
  }

  override async crawlIntermediateCategoryPage(
    ctx: PlaywrightCrawlingContext
  ): Promise<void> {
    // Entry point: https://www.baldai1.lt

    await ctx.page.waitForTimeout(5000);

    // Get hrefs of all subcategories:
    await ctx.enqueueLinks({
      selector: "ul.ty-menu_items li.ty-menu_submenu-item a",
      label: "LIST",
    });
  }

  static async create(
    launchOptions: CrawlerLaunchOptions
  ): Promise<Furniture1CrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets(
        launchOptions?.uniqueCrawlerKey
      );

    return new Furniture1CrawlerDefinition({
      detailsDataset,
      listingDataset,
      productCardSelector: "div.grid-list .ty-column3",
      detailsUrlSelector:
        "div.grid-list .ty-column3 .ty-grid-list__item-name > a",
      listingUrlSelector: "a.ty-pagination__next",
      // cookieConsentSelector: "",
      dynamicProductCardLoading: false,
      launchOptions,
    });
  }
}
