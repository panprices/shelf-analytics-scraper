import { Locator, Page } from "playwright";
import {
  browserCrawlerEnqueueLinks,
  Dataset,
  log,
  PlaywrightCrawlingContext,
} from "crawlee";
import { v4 as uuidv4 } from "uuid";

import { AbstractCrawlerDefinition, CrawlerLaunchOptions } from "../abstract";
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
  // No need to override this, potentially remove it?
  override async crawlListPage(ctx: PlaywrightCrawlingContext): Promise<void> {
    if (!this.productCardSelector) {
      throw new Error("productCardSelector not defined");
    }
    await ctx.page.locator(this.productCardSelector).nth(0).waitFor();

    await this.scrollToBottom(ctx);
    await this.registerProductCards(ctx);

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

    const categoryTree = await this.extractCategoryTreeFromCategoryPage(
      productCard.page().locator("div.breadcrumbs li a"),
      1,
      productCard.page().locator("div.breadcrumbs li strong")
    );

    const currentProductInfo: ListingProductInfo = {
      name: productName,
      url,
      // previewImageUrl,
      categoryUrl,
      popularityCategory: categoryTree,
    };

    return currentProductInfo;
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    const productNameSelector = "div.product-info-main h1.page-title";
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
      "div.description",
      (node) => node.first().textContent()
    ).then((text) => text?.trim());

    const outOfStockLocator = page.locator(".stock.unavailable");
    const availability =
      (await outOfStockLocator.count()) > 0 ? "out_of_stock" : "in_stock";

    const priceString = await this.extractProperty(
      page,
      "div.product-info-price > div.price-final_price span.price",
      (node) => node.first().textContent()
    ).then((text) => text?.trim());

    let price: number;
    if (priceString) {
      price = extractPriceFromPriceText(priceString);
    } else {
      if (availability === "out_of_stock") {
        price = 0;
      } else {
        throw new Error("Cannot extract price");
      }
    }

    const originalPriceText = await this.extractProperty(
      page,
      "div.product-info-price span[data-price-type='oldPrice']",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    const isDiscounted = originalPriceText !== undefined;
    const originalPrice = isDiscounted
      ? extractPriceFromPriceText(originalPriceText)
      : undefined;

    const imageUrls = await extractImagesFromProductDetailsPage(page);
    if (imageUrls.length === 0) {
      throw new Error("Cannot extract imageUrls");
    }

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

    let reviews: ProductReviews | undefined;
    if (reviewScoreText && reviewCountText) {
      reviews = {
        reviewCount: extractNumberFromText(reviewCountText),
        averageReview: parseFloat(reviewScoreText),
        recentReviews: [],
      };
    } else {
      reviews = undefined;
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

    // Their schema.org is not properly JSON-formatted so we cannot scrape it :)
    let metadata = undefined;

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
      mpn: sku,

      availability,
      images: imageUrls,
      reviews,
      specifications,
      categoryTree,
      metadata,
    };

    return productInfo;
  }

  static async create(
    launchOptions: CrawlerLaunchOptions
  ): Promise<GardenStoreCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets(
        launchOptions?.uniqueCrawlerKey
      );

    return new GardenStoreCrawlerDefinition({
      detailsDataset,
      listingDataset,
      listingUrlSelector: "ul.pages-items a.next",
      detailsUrlSelector: "li.product-item .product-item-name a",
      productCardSelector: "li.product-item",
      cookieConsentSelector:
        "button#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
      dynamicProductCardLoading: false,
      launchOptions,
    });
  }
}

function extractPriceFromPriceText(priceString: string): number {
  return parseInt(
    priceString.replace(" ", "").replace("kr", "").replaceAll("\u00A0", "")
  );
}

function cleanImageUrl(imgUrl: string): string {
  return imgUrl.split("?")[0];
}

async function extractImagesFromProductDetailsPage(page: Page) {
  // Try to extract from thumbnails:
  const imageLocator = page.locator("div.snapper_nav img");
  const imageCount = await imageLocator.count();
  const imageUrls = [];
  for (let i = 0; i < imageCount; ++i) {
    const imgUrl = await imageLocator.nth(i).getAttribute("src");
    if (imgUrl) {
      imageUrls.push(cleanImageUrl(imgUrl));
    }
  }

  if (imageUrls.length === 0) {
    // No thumbnails found - product only has 1 image:
    const imgUrl = await page
      .locator("div.enlarge_contain img")
      .first()
      .getAttribute("src");
    if (imgUrl) {
      imageUrls.push(cleanImageUrl(imgUrl));
    }
  }

  return imageUrls;
}
