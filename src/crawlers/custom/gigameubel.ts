import { Locator, Page } from "playwright";
import { Dictionary, PlaywrightCrawlingContext, log } from "crawlee";
import { DetailedProductInfo, ListingProductInfo } from "../../types/offer.js";
import {
  AbstractCrawlerDefinition,
  AbstractCrawlerDefinitionWithSimpleVariants,
  AbstractCrawlerDefinitionWithVariants,
  CrawlerLaunchOptions,
} from "../abstract.js";
import { convertSchemaOrgAvailability } from "../../utils.js";

export class GigameubelCrawlerDefinition extends AbstractCrawlerDefinitionWithSimpleVariants {
  // Only needed for category exploration. Return <undefined> otherwise.
  async extractCardProductInfo(
    categoryUrl: string,
    productCard: Locator
  ): Promise<ListingProductInfo> {
    const url = await this.extractProperty(productCard, "a.product", (node) =>
      node.first().getAttribute("href")
    );
    if (!url) throw new Error("Cannot find url of productCard");

    const categoryTree = await this.extractCategoryTreeFromCategoryPage(
      productCard.page().locator("div.breadcrumbs ul li a"),
      1,
      productCard.page().locator("div.breadcrumbs ul li").last()
    );
    return {
      url,
      categoryUrl,
      popularityCategory: categoryTree ? categoryTree : undefined,
    };
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    const name = await this.extractProperty(
      page,
      "main h1.page-title",
      (element) => element.innerText()
    ).then((text) => text?.trim());

    const brand = await this.extractProperty(
      page,
      "main div.sidebar-lg-sticky h4",
      (element) => element.innerText()
    ).then((text) => text?.trim());

    const description = await this.extractProperty(
      page,
      "main div.product.info div.cms-content",
      (e) => e.innerText()
    );

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
    const currency = "EUR";

    const originalPriceText = await this.extractProperty(
      page,
      "div.product-info-main span[data-price-type='oldPrice']",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    const originalPrice = originalPriceText
      ? extractPriceFromPriceText(originalPriceText)
      : undefined;
    const isDiscounted = originalPrice ? true : false;

    const schemaOrgString = await this.extractProperty(
      page,
      "//script[@type='application/ld+json' and contains(text(), 'schema.org') and contains(text(), 'Product')]",
      (node) => node.textContent()
    );
    let schemaOrg = undefined;
    let gtin, availability;
    if (schemaOrgString) {
      try {
        schemaOrg = JSON.parse(schemaOrgString);
        gtin = schemaOrg.gtin13;
        availability = convertSchemaOrgAvailability(
          schemaOrg.offers.availability
        );
      } catch (error) {
        log.warning("Error extracting data from schema.org", { error });
      }
    }

    const images = await extractImageFromProductPage(page);

    const specifications = await this.extractSpecificationsFromTable(
      page.locator("main div.product.info table tr th"),
      page.locator("main div.product.info table tr td")
    );
    const sku = specifications.find((spec) => spec.key === "Art.nr.")?.value;

    const categoryTree = await this.extractCategoryTree(
      page.locator("div.breadcrumbs ul li a"),
      1
    );

    return {
      name,
      url: page.url(),

      brand,
      // brandUrl,
      description,
      price,
      currency,
      isDiscounted,
      originalPrice,
      availability,

      gtin,
      sku,
      // mpn,

      images, // if not applicable return an empty array
      specifications, // if not applicable return an empty array
      // reviews,

      categoryTree, // is only optional if we already scraped it in the category page.

      // variantGroupUrl,
      // variant: 0, // 0, 1, 2, 3, ...

      metadata: { schemaOrg },
    };
  }

  override async extractVariantUrls(
    ctx: PlaywrightCrawlingContext
  ): Promise<string[]> {
    const variantUrls = [];
    for (const li of await ctx.page
      .locator("main .sidebar-lg-sticky li.custom-dropdown-option")
      .all()) {
      const url = await li.getAttribute("data-url");
      if (url) variantUrls.push(url);
    }

    return variantUrls;
  }

  override async crawlIntermediateCategoryPage(
    ctx: PlaywrightCrawlingContext<Dictionary>
  ): Promise<void> {
    await ctx.enqueueLinks({
      selector: "nav ul li.level2 a",
      label: "LIST",
    });
  }

  static async create(
    launchOptions?: CrawlerLaunchOptions
  ): Promise<GigameubelCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets(
        launchOptions?.uniqueCrawlerKey
      );

    return new GigameubelCrawlerDefinition({
      detailsDataset,
      listingDataset,

      // Only needed for category exploration
      listingUrlSelector: "div.toolbar .pages-items li a",
      detailsUrlSelector: "div.card-product a.product",
      productCardSelector: "div.card-product",
      // cookieConsentSelector: ,
      dynamicProductCardLoading: false,
      launchOptions,
    });
  }
}

async function extractImageFromProductPage(page: Page): Promise<string[]> {
  const imageUrls = [];
  for (const a of await page
    .locator("main div.product.media .MagicToolboxSelectorsContainer a")
    .all()) {
    const url = await a.getAttribute("href");
    if (url) {
      imageUrls.push(url);
    }
  }

  return imageUrls;
}

export function extractPriceFromPriceText(priceText: string): number {
  /** 1.295,00 -> 1295 */
  return parseFloat(
    priceText.replaceAll(".", "").replaceAll(",", ".").trim().split(/\s/g)[0]
  );
}
