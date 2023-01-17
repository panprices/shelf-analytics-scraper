import { Locator, Page } from "playwright";
import { Dataset, log, PlaywrightCrawlingContext } from "crawlee";
import { AbstractCrawlerDefinition } from "../abstract";
import {
  DetailedProductInfo,
  IndividualReview,
  ListingProductInfo,
  OfferMetadata,
  ProductReviews,
  SchemaOrg,
} from "../../types/offer";

export class EllosCrawlerDefinition extends AbstractCrawlerDefinition {
  override async crawlDetailPage(
    ctx: PlaywrightCrawlingContext
  ): Promise<void> {
    await super.crawlDetailPage(ctx);

    // Enqueue the variant groups where you have a.href:
    await ctx.enqueueLinks({
      selector: "div.product-info ul.color-picker-list a",
      label: "DETAIL",
      userData: ctx.request.userData,
    });
  }

  override async scrollToBottom(ctx: PlaywrightCrawlingContext): Promise<void> {
    const page = ctx.page;
    const loadMoreButton = page.locator("div.load-more-button");

    while (true) {
      await super.scrollToBottom(ctx);
      await this.handleCookieConsent(page);

      try {
        await loadMoreButton.click({ timeout: 5000 });
        // wait for consistency
        await new Promise((f) => setTimeout(f, 500));
      } catch (error) {
        // No more expand button to click => break
        break;
      }
    }
  }

  async extractCardProductInfo(
    categoryUrl: string,
    productCard: Locator
  ): Promise<ListingProductInfo> {
    const productName = await this.extractProperty(
      productCard,
      "h2.ellos-full-product-name",
      (node) => node.textContent()
    ).then((text) => {
      // Trim and replace multiple whitespaces/endlines with single white spaces
      return text?.trim().replaceAll(/\s+/g, " ");
    });
    if (!productName) throw new Error("Cannot find productName of productCard");

    const url = await this.extractProperty(
      productCard,
      "xpath=./a[1]",
      (node) => node.getAttribute("href")
    );
    if (!url) throw new Error("Cannot find url of productCard");

    const currentProductInfo: ListingProductInfo = {
      name: productName,
      url,
      categoryUrl,
      popularityIndex: -1, // will be overwritten later
    };

    return currentProductInfo;
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    const productName = await this.extractProperty(
      page,
      "div.product-desc h1",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    if (!productName) {
      throw new Error("Cannot extract productName");
    }

    const brand = await this.extractProperty(
      page,
      "div.product-desc a.brand",
      (node) => node.textContent()
    ).then((text) => text?.trim());

    const priceText = await this.extractProperty(
      page,
      // "div.product-desc .offer span",
      "//div[contains(@class, 'product-desc')]//strong[contains(@class, 'offer')]//span[contains(text(), 'SEK')]",
      (node) => node.textContent()
    );
    if (!priceText) {
      throw new Error("Cannot extract priceText");
    }
    const price = extractPriceFromPriceText(priceText);
    const originalPriceText = await this.extractProperty(
      page,
      "div.product-desc .offer s",
      (node) => node.textContent()
    );
    const isDiscounted = !!originalPriceText;
    const originalPrice = isDiscounted
      ? extractPriceFromPriceText(originalPriceText)
      : undefined;

    const description = await this.extractProperty(
      page,
      "div.product-details-intro",
      (node) => node.textContent()
    ).then((text) => text?.trim());

    const schemaOrgString = await page
      .locator(
        "//script[@type='application/ld+json' and contains(text(), 'schema.org') and contains(text(), 'Product')]"
      )
      .textContent();
    if (!schemaOrgString) {
      throw new Error("Cannot extract schema.org data");
    }
    const schemaOrg = JSON.parse(schemaOrgString);

    let availability;
    try {
      availability = schemaOrg.offers.availability.includes("InStock")
        ? "in_stock"
        : "out_of_stock";
    } catch (error) {
      throw new Error("Cannot extract availability of product");
    }
    const reviews: ProductReviews = {
      averageReview: schemaOrg.aggregateRating?.ratingValue,
      reviewCount: schemaOrg.aggregateRating?.reviewCount,
      recentReviews: [],
    };

    const imageUrls = schemaOrg.image;

    const categoryTree = await this.extractCategoryTree(
      page.locator("ul.navigation-breadcrumb-items li a"),
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

      availability,
      images: imageUrls,
      reviews,
      specifications: [], // TODO: extract specifications
      categoryTree,
      metadata: {
        schemaOrg: schemaOrg,
      },
    };

    return productInfo;
  }

  static async create(): Promise<EllosCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets();

    return new EllosCrawlerDefinition({
      detailsDataset,
      listingDataset,
      detailsUrlSelector: "//article[contains(@class, 'product-card')]//a",
      productCardSelector: "//article[contains(@class, 'product-card')]",
      cookieConsentSelector: "a.cta-ok",
      dynamicProductCardLoading: true,
    });
  }
}

function extractPriceFromPriceText(priceText: string) {
  return parseInt(
    priceText.replace(" ", "").replace("SEK", "").replaceAll("\u00A0", "")
  );
}
