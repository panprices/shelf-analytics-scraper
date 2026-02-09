import { Locator, Page } from "playwright";
import {
  DetailedProductInfo,
  ListingProductInfo,
  OfferMetadata,
  Specification,
} from "../../types/offer.js";
import {
  AbstractCrawlerDefinition,
  CrawlerLaunchOptions,
} from "../abstract.js";
import { PlaywrightCrawlingContext, Dictionary } from "crawlee";

export class JensenCompanyCrawlerDefinition extends AbstractCrawlerDefinition {
  /**
   * This retailer does not use category scraping, it gets the URLs from sitemap
   */
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
      productCard.page().locator("div.breadcrumbs ul li a"),
      1,
      productCard.page().locator("div.breadcrumbs ul li > strong")
    );
    return {
      name: productName,
      url,
      categoryUrl,
      popularityCategory: categoryTree ? categoryTree : undefined,
    };
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    const productName = await this.extractProperty(
      page,
      "div.product-info-main h1.page-title",
      (node) => node.textContent(),
      false
    ).then((text) => text?.trim());
    if (!productName) {
      throw new Error("Cannot extract productName");
    }

    const brand = await this.extractProperty(
      page,
      "div.product-brand",
      (node) => node.textContent()
    ).then((text) => text?.trim());

    const sku = await this.extractProperty(
      page,
      "div.attribute.sku div.value",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    const gtin = sku;

    const descriptionAndSpecsText = await this.extractProperty(
      page,
      "div.description",
      (node) => node.innerText()
    ).then((text) => text?.trim());

    let description = descriptionAndSpecsText?.includes("Specifikationer:")
      ? descriptionAndSpecsText?.split("Specifikationer:")[0]
      : descriptionAndSpecsText;

    const priceText = await this.extractProperty(
      page,
      "div.product-info-main span[data-price-type='finalPrice']",
      (node) => node.textContent(),
      false
    ).then((text) => text?.trim());
    if (!priceText) {
      throw new Error("Cannot extract price");
    }
    const price = extractPriceFromPriceText(priceText);
    const currency = "DKK";

    const originalPriceText = await this.extractProperty(
      page,
      "div.product-info-main span[data-price-type='oldPrice']",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    const originalPrice = originalPriceText
      ? extractPriceFromPriceText(originalPriceText)
      : undefined;
    const isDiscounted = originalPrice ? true : false;

    const categoryTree = await this.extractCategoryTree(
      page.locator("div.breadcrumbs ul li a"),
      1
    );

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

    const availability = schemaOrgString.includes("InStock")
      ? "in_stock"
      : "out_of_stock";

    let images = [];
    const mainImageLocator = page.locator(
      "div.fotorama__stage__frame.fotorama__active img"
    );
    const thumbnailLocator = page.locator(".fotorama__thumb");
    const thumbnailCount = await thumbnailLocator.count();
    for (let i = 0; i < thumbnailCount; i++) {
      const currentImagePreview = thumbnailLocator.nth(i);
      await this.handleCookieConsent(page);
      await currentImagePreview.click({ force: true });
      await page.waitForTimeout(2000);

      const imageUrl = await mainImageLocator.nth(1).getAttribute("src");
      if (imageUrl) {
        images.push(imageUrl);
      }
    }
    images = [...new Set(images)];

    let specifications: Specification[] = [];
    const specificationText = descriptionAndSpecsText?.includes(
      "Specifikationer:"
    )
      ? descriptionAndSpecsText?.split("Specifikationer:")[1]
      : null;

    if (specificationText) {
      const specRows = specificationText.trim().split("\n");
      specifications = specRows
        .filter((row) => row.includes(":"))
        .map((row) => {
          return {
            key: row.split(":")[0].trim(),
            value: row.split(":")[1].trim(),
          };
        });
    }

    let reviews = undefined;
    // const reviewCountText = await page
    //   .locator("div.rating_wrapper .prodratinginfos")
    //   .textContent();
    // const reviewStarsCount = await page
    //   .locator("div.rating_wrapper span.star.on")
    //   .count();
    // const reviewHalfStarsCount = await page
    //   .locator("div.rating_wrapper span.star:not(.on)")
    //   .count();

    // if (reviewCountText && reviewStarsCount) {
    //   reviews = {
    //     reviewCount: extractNumberFromText(reviewCountText),
    //     averageReview: reviewStarsCount + reviewHalfStarsCount / 2,
    //     recentReviews: [],
    //   };
    // }

    return {
      name: productName,
      url: page.url(),

      brand,
      description,
      price,
      currency,
      originalPrice,
      isDiscounted,

      gtin,
      sku,

      // categoryUrl: categoryTree[0].url,
      categoryTree,

      metadata,

      availability,

      images, // if not applicable return an empty array
      reviews,
      specifications, // if not applicable return an empty array

      // variantGroupUrl: "",
      // variant: 0, // 0, 1, 2, 3, ...
    };
  }

  override async crawlIntermediateCategoryPage(
    ctx: PlaywrightCrawlingContext<Dictionary>
  ): Promise<void> {
    await this.handleCookieConsent(ctx.page);
    await ctx.enqueueLinks({
      selector: "nav ul.subchildmenu li.ui-menu-item.level2 a",
      label: "LIST",
    });
  }

  static async create(
    launchOptions?: CrawlerLaunchOptions
  ): Promise<JensenCompanyCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets(
        launchOptions?.uniqueCrawlerKey
      );

    return new JensenCompanyCrawlerDefinition({
      detailsDataset,
      listingDataset,
      productCardSelector: "div#layer-product-list li.product-item",
      detailsUrlSelector:
        "div#layer-product-list li.product-item .product-item-name a",
      listingUrlSelector: "ul.pages-items a.next",
      cookieConsentSelector: "div.coi-button-group button.coi-banner__accept",
      dynamicProductCardLoading: false,
      launchOptions,
    });
  }
}

/** 4.525,00 kr. -> 4525 */
function extractPriceFromPriceText(priceText: string): number {
  return parseFloat(
    priceText.replaceAll(".", "").replaceAll(",", ".").trim().split(/\s/g)[0]
  );
}
