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

export class GardenStoreCrawlerDefinition extends AbstractCrawlerDefinition {
  override async crawlListPage(ctx: PlaywrightCrawlingContext): Promise<void> {
    await ctx.page.locator(this.productCardSelector).nth(0).waitFor();

    await this.scrollToBottom(ctx);

    if (this.listingUrlSelector) {
      await ctx.enqueueLinks({
        selector: this.listingUrlSelector,
        label: "LIST",
      });
    }
  }

  async extractCardProductInfo(
    categoryUrl: string,
    productCard: Locator
  ): Promise<ListingProductInfo> {
    const productName = await this.extractProperty(
      productCard,
      ".product-item-name",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    if (!productName) throw new Error("Cannot find productName of productCard");

    const url = await this.extractProperty(
      productCard,
      ".product-item-name a",
      (node) => node.getAttribute("href")
    );
    if (!url) throw new Error("Cannot find url of productCard");

    // const previewImageUrl = await this.extractProperty(
    //   productCard,
    //   "img.product-image-photo",
    //   (node) => node.getAttribute("href")
    // );
    // if (!previewImageUrl)
    //   throw new Error("Cannot find previewImageUrl of productCard");

    // const priceString = await this.extractProperty(
    //   productCard,
    //   "span[data-price-type='finalPrice']",
    //   (node) => node.textContent()
    // );
    // if (!priceString) throw new Error("Cannot find price of productCard");
    // const price = extractPriceFromPriceString(priceString);

    // const originalPriceString = await this.extractProperty(
    //   productCard,
    //   "span[data-price-type='oldPrice']",
    //   (node) => node.textContent()
    // );
    // const isDiscounted = originalPriceString === undefined ? false : true;
    // const originalPrice =
    //   originalPriceString == undefined
    //     ? undefined
    //     : extractPriceFromPriceString(originalPriceString);

    const currentProductInfo: ListingProductInfo = {
      name: productName,
      url,
      // previewImageUrl,
      popularityIndex: -1, // will be overwritten later
      categoryUrl,
    };

    return currentProductInfo;
  }
  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    const productName = await this.extractProperty(
      page,
      "h1.page-title",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    if (!productName) throw new Error("Cannot extract productName");

    const description = await this.extractProperty(
      page,
      "div.description",
      (node) => node.textContent()
    ).then((text) => text?.trim());

    const priceString = await this.extractProperty(
      page,
      "div.product-info-price span[data-price-type='finalPrice']",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    if (!priceString) throw new Error("Cannot extract price");

    const price = extractPriceFromPriceString(priceString);

    const originalPriceString = await this.extractProperty(
      page,
      "div.product-info-price span[data-price-type='oldPrice']",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    const isDiscounted = originalPriceString !== undefined ? true : false;
    const originalPrice =
      originalPriceString !== undefined
        ? extractPriceFromPriceString(originalPriceString)
        : undefined;

    const imageLocator = page.locator("div.snapper_nav img");
    const imageCount = await imageLocator.count();
    const imageUrls = [];
    for (let i = 0; i < imageCount; ++i) {
      const imgUrl = await imageLocator.nth(i).getAttribute("src");
      if (imgUrl) {
        imageUrls.push(cleanImageUrl(imgUrl));
      }
    }

    const availableCheckMark = page.locator(
      ".product-points li:first-child .fa"
    );
    const availability =
      (await availableCheckMark.count()) > 0 ? "in_stock" : "out_of_stock";

    const reviewScoreText = await this.extractProperty(
      page,
      "div.yotpo-main-widget span.avg-score",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    const reviewCountText = await this.extractProperty(
      page,
      "div.yotpo-main-widget span.reviews-qa-label",
      (node) => node.textContent()
    );

    let reviews: ProductReviews | "unavailable";
    if (reviewScoreText && reviewCountText) {
      reviews = {
        reviewCount: extractNumberFromText(reviewCountText),
        averageReview: parseFloat(reviewScoreText),
        recentReviews: [],
      };
    } else {
      reviews = "unavailable";
    }

    const specKeys = await page
      .locator("table#product-attribute-specs-table th")
      .allTextContents()
      .then((textContents) => textContents.map((text) => text.trim()));
    const specVals = await page
      .locator("table#product-attribute-specs-table td")
      .allTextContents()
      .then((textContents) => textContents.map((text) => text.trim()));
    if (specKeys.length !== specVals.length) {
      throw new Error("Number of specification keys and vals mismatch");
    }
    const specifications: Specification[] = [];
    for (let i = 0; i < specKeys.length; i++) {
      specifications.push({
        key: specKeys[i],
        value: specVals[i],
      });
    }

    const brand = specifications.find(
      (spec) => spec.key === "Varumärke"
    )?.value;

    const gtin = specifications.find((spec) => spec.key === "EAN")?.value;
    const sku = specifications.find(
      (spec) => spec.key === "Artikelnummer"
    )?.value;
    const articleNumber = sku;

    const categoryTree = await this.extractCategoryTree(
      page.locator("div.breadcrumbs li a"),
      1
    );

    const productInfo = {
      brand,
      name: productName,
      description,
      url: page.url(),
      price: price,
      currency: "SEK",
      isDiscounted,
      originalPrice,

      gtin,
      sku,
      articleNumber,

      availability,
      images: imageUrls,
      reviews,
      specifications,
      categoryTree,
    };

    return productInfo;
  }

  static async create(): Promise<GardenStoreCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets();

    return new GardenStoreCrawlerDefinition({
      detailsDataset,
      listingDataset,
      listingUrlSelector: "ul.pages-items a.next",
      detailsUrlSelector: "li.product-item .product-item-name a",
      productCardSelector: "li.product-item",
      cookieConsentSelector:
        "button#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
      dynamicProductCardLoading: false,
    });
  }
}

function extractPriceFromPriceString(priceString: string): number {
  return parseInt(
    priceString.replace(" ", "").replace("kr", "").replaceAll("\u00A0", "")
  );
}

function cleanImageUrl(imgUrl: string): string {
  return imgUrl.split("?")[0];
}
