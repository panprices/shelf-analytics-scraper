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
import { extractNumberFromText } from "../../utils";

export class EllosCrawlerDefinition extends AbstractCrawlerDefinition {
  // protected override categoryPageSize: number = 56;

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
      await this.registerProductCards(ctx);
      await this.handleCookieConsent(page);

      try {
        await loadMoreButton.click({ timeout: 15000 });
        // wait for consistency
        await new Promise((f) => setTimeout(f, 500));
      } catch (error) {
        // No more expand button to click => break
        break;
      }
    }
  }

  // DEPRECATED: Toan tried to paralellize the category exploration just like
  // Homeroom, but encounters some issues that give us less products.
  // Apparently Ellos page show 56 products but calculate the pagination
  // with 58 products, thus we are missing 2 products per (nrPages - 1).
  // override async crawlListPage(ctx: PlaywrightCrawlingContext): Promise<void> {
  //   const categoryUrl = ctx.page.url();
  //   if (!categoryUrl.includes("?page=")) {
  //     // Initial category page => Calculate the number of pages
  //     // and enqueue all pages to scrape.
  //     const nrProductsText = await ctx.page
  //       .locator("div.product-list-inner div.product-sort")
  //       .textContent();
  //     if (!nrProductsText) {
  //       throw new Error(
  //         "Cannot extract nrProductsText. Category url might be broken."
  //       );
  //     }

  //     const nrProducts = extractNumberFromText(nrProductsText);
  //     const nrPages = Math.ceil(nrProducts / this.categoryPageSize);

  //     const urlsToExplore = [];
  //     for (let i = 1; i <= nrPages; i++) {
  //       const url = categoryUrl.split("?")[0] + `?page=${i}`;
  //       urlsToExplore.push(url);

  //       await ctx.enqueueLinks({
  //         urls: [url],
  //         label: "LIST",
  //         userData: {
  //           ...ctx.request.userData,
  //           pageNumber: i,
  //         },
  //       });
  //     }

  //     log.info(
  //       `Category has ${nrProducts} products. Enqueued ${nrPages} pages to explore.`
  //     );

  //     return;
  //   }

  //   await super.crawlListPage(ctx);
  // }

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
    ).then((text) =>
      // Trim and replace multiple whitespaces/endlines with single white spaces
      text?.trim().replaceAll(/\s+/g, " ")
    );
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

    const sku = await extractSKUFromProductPage(page);

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

      sku,

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
async function extractSKUFromProductPage(
  page: Page
): Promise<string | undefined> {
  const skuText = await page.locator("p.product-details-sku").textContent();
  if (!skuText) {
    log.error("Cannot extract SKU of product");
    return undefined;
  }
  // Extract SKU from string.
  // "Artikelnummer: 1705327-01-24" -> "1705327-01-24"
  try {
    const sku = skuText.split(":")[1].trim();
    return sku;
  } catch {
    log.error("Cannot extract SKU of product");
    return undefined;
  }
}
