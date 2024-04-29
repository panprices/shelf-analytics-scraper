import { Locator, Page } from "playwright";
import { DetailedProductInfo, ListingProductInfo } from "../../types/offer";
import { AbstractCrawlerDefinition, CrawlerLaunchOptions } from "../abstract";
import { extractNumberFromText } from "../../utils";
import { Dictionary, PlaywrightCrawlingContext, log } from "crawlee";
import { scrollToBottomV2 } from "../scraper-utils";
import { PageNotFoundError } from "../../types/errors";

export class NorlivingCrawlerDefinition extends AbstractCrawlerDefinition {
  // NOTE: We don't need to do variant scraping for this because individual
  // variants are listed separately on category pages and on sitemap.

  // Only needed for category exploration
  async extractCardProductInfo(
    categoryUrl: string,
    productCard: Locator
  ): Promise<ListingProductInfo> {
    const name = await this.extractProperty(
      productCard,
      "div.product-card__info a",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    if (!name) throw new Error("Cannot find productName of productCard");

    const url = await this.extractProperty(
      productCard,
      "div.product-card__info a",
      (node) => node.getAttribute("href")
    );
    if (!url) throw new Error("Cannot find url of productCard");

    return {
      name,
      url,
      categoryUrl,
    };
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    if ((await page.title()).trim().toLowerCase() === "404 ikke fundet") {
      throw new PageNotFoundError("404 Not Found");
    }

    const name = await this.extractProperty(
      page,
      "div.product h1.product-info__title",
      (element) => element.innerText()
    ).then((text) => text?.trim());
    // Throw error since product name is absolutely necessary
    if (!name) throw new Error("Cannot find name of product");

    const priceText = await this.extractProperty(
      page,
      "div.product price-list sale-price",
      (e) => e.innerText()
    ).then((text) => text?.trim());
    if (!priceText) throw new Error("Cannot find price of product");

    const price = extractNumberFromText(priceText?.replaceAll(".", ""));
    const currency = "DKK";
    const originalPriceText = await this.extractProperty(
      page,
      "div.product price-list compare-at-price",
      (e) => e.innerText()
    );

    let originalPrice;
    try {
      if (originalPriceText) {
        originalPrice = extractNumberFromText(
          originalPriceText?.replaceAll(".", "")
        );
      }
    } catch {
      originalPrice = undefined;
    }

    const isDiscounted = originalPrice !== undefined;

    const images = await this.extractImagesFromProductPage(page);

    const schemaOrgString = await this.extractProperty(
      page,
      "//script[@type='application/ld+json' and contains(text(), 'schema.org') and contains(text(), 'Product')]",
      (node) => node.textContent()
    );
    let schemaOrg = undefined;
    let brand, description, gtin;
    if (schemaOrgString) {
      try {
        schemaOrg = JSON.parse(schemaOrgString);
        brand = schemaOrg.brand?.name;
        description = schemaOrg.description;
        gtin = schemaOrg.gtin;
      } catch (error) {
        log.warning("Error extracting data from schema.org", { error });
      }
    }
    if (brand) {
      brand = cleanUpBrandName(brand);
    }

    const specifications = await this.extractSpecificationsFromTable(
      page.locator("x-tabs table.specifications-table tr td:first-child"),
      page.locator("x-tabs table.specifications-table tr td:last-child")
    );
    const sku = specifications.find(
      (spec) => spec.key.toLocaleLowerCase() === "sku"
    )?.value;
    // We can extract Venture Design MPN by removing the first two characters
    // "VD" from the sku. E.g. VD115009-092 => 115009-092
    let mpn = sku?.startsWith("VD") ? sku.substring(2) : undefined;
    // Sometimes they add weird post-fix as well, so we should remove that.
    // E.g. VD51074-320-340x240-cm. => 51074-320
    mpn = mpn?.split("-").slice(0, 2).join("-");

    return {
      name,
      url: page.url(),

      brand,
      description,
      price,
      currency,
      isDiscounted,
      originalPrice,
      availability: "in_stock", // couldn't find any out-of-stock product

      gtin,
      sku,
      mpn,

      images, // if not applicable return an empty array
      reviews: undefined,
      specifications, // if not applicable return an empty array

      //categoryTree is only optional if we already scraped it in the category page.

      // variantGroupUrl,
      // variant: 0, // 0, 1, 2, 3, ...

      metadata: { schemaOrg },
    };
  }

  async extractImagesFromProductPage(page: Page): Promise<string[]> {
    const imageLocator = await page
      .locator("div.product-gallery__media img")
      .all();

    const images = [];
    for (const imageTag of imageLocator) {
      const imageUrl = await imageTag.getAttribute("src");
      if (imageUrl) {
        images.push(imageUrl);
      }
    }

    return images;
  }

  override async crawlIntermediateCategoryPage(
    ctx: PlaywrightCrawlingContext<Dictionary>
  ): Promise<void> {
    await ctx.enqueueLinks({
      selector: "ul.mega-menu__nav ul li a",
      label: "LIST",
    });
  }

  static async create(
    launchOptions?: CrawlerLaunchOptions
  ): Promise<NorlivingCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets(
        launchOptions?.uniqueCrawlerKey
      );

    return new NorlivingCrawlerDefinition({
      detailsDataset,
      listingDataset,

      // Only needed for category exploration
      productCardSelector: "div.collection product-card",
      detailsUrlSelector:
        "div.collection product-card div.product-card__info  a",
      listingUrlSelector: undefined, // infinite scroll, no next button
      cookieConsentSelector: undefined,
      dynamicProductCardLoading: false,
      scrollToBottomStrategy: scrollToBottomV2,
      launchOptions,
    });
  }
}

/** "Eget lager - Venture design" => "Venture design" */
export function cleanUpBrandName(brandName: string) {
  // Match "EGET LAGER" ignoring case
  let pattern: RegExp = /eget\s+lager/gi;

  let newBrandName = brandName
    .replaceAll(pattern, "")
    .trim()
    .replace(/^\-/, "")
    .replace(/\-$/, "")
    .trim();

  return newBrandName;
}
