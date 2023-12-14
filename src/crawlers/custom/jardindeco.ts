import { Page } from "playwright";
import { DetailedProductInfo, OfferMetadata } from "../../types/offer";
import { AbstractCrawlerDefinition, CrawlerLaunchOptions } from "../abstract";
import { extractNumberFromText } from "../../utils";

export class JardindecoCrawlerDefinition extends AbstractCrawlerDefinition {
  /**
   * This retailer does not use category scraping
   */
  async extractCardProductInfo(): Promise<undefined> {
    return undefined;
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    const productName = await this.extractProperty(
      page,
      "div.product_info p.name",
      (node) => node.textContent(),
      false
    ).then((text) => text?.trim());
    if (!productName) {
      throw new Error("Cannot extract productName");
    }

    const description = await this.extractProperty(
      page,
      "div.product_info div#fdesccourte",
      (node) => node.textContent()
    ).then((text) => text?.trim());

    const priceText = await this.extractProperty(
      page,
      "div.product_info div#fprixttc",
      (node) => node.textContent(),
      false
    ).then((text) => text?.trim());
    if (!priceText) {
      throw new Error("Cannot extract price");
    }
    const price = extractPriceFromPriceText(priceText);
    const currency = "EUR";

    const originalPriceText = await this.extractProperty(
      page,
      "div.product_info div.fiche__prices del",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    const originalPrice = originalPriceText
      ? extractPriceFromPriceText(originalPriceText)
      : undefined;
    const isDiscounted = originalPrice ? true : false;

    const categoryTree = await this.extractCategoryTree(
      page.locator("div.breadcrumbprod.hidden-md a"),
      0
    );

    const tags = await page
      .locator("div.product_info div.tags_wrapper > div")
      .allInnerTexts()
      .then((allTexts) => allTexts.map((text) => text.trim()));

    const availability = tags.includes("Disponible")
      ? "in_stock"
      : "out_of_stock";

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

    const brand = schemaOrg.brand;
    const gtin = schemaOrg.gtin13;
    const sku = schemaOrg.sku;

    const imageLocator = page.locator("#gallery_imgs img");
    const imageCount = await imageLocator.count();
    let images = [];
    for (let i = 0; i < imageCount; ++i) {
      const imageUrl = await imageLocator.nth(i).getAttribute("src");
      if (imageUrl) {
        images.push(imageUrl);
      }
    }

    const specifications = await this.extractSpecificationsFromTable(
      page.locator("div.tab_collection_area div.tbl_caracs_tr div:first-child"),
      page.locator("div.tab_collection_area div.tbl_caracs_tr div:last-child")
    );

    const reviewCountText = await page
      .locator("div.rating_wrapper .prodratinginfos")
      .textContent();
    const reviewStarsCount = await page
      .locator("div.rating_wrapper span.star.on")
      .count();
    const reviewHalfStarsCount = await page
      .locator("div.rating_wrapper span.star:not(.on)")
      .count();

    let reviews = undefined;
    if (reviewCountText && reviewStarsCount) {
      reviews = {
        reviewCount: extractNumberFromText(reviewCountText),
        averageReview: reviewStarsCount + reviewHalfStarsCount / 2,
        recentReviews: [],
      };
    }

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

      categoryUrl: categoryTree[0].url,
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

  static async create(
    launchOptions?: CrawlerLaunchOptions
  ): Promise<JardindecoCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets(
        launchOptions?.uniqueCrawlerKey
      );

    return new JardindecoCrawlerDefinition({
      detailsDataset,
      listingDataset,
      launchOptions,
    });
  }
}

function extractPriceFromPriceText(priceText: string): number {
  return parseFloat(
    priceText.replace("€", "").replaceAll(/\s/g, "").replace(",", ".")
  );
}
