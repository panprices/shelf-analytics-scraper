import { Locator, Page } from "playwright";
import { DetailedProductInfo, ListingProductInfo } from "../../types/offer";
import {
  AbstractCrawlerDefinition,
  CrawlerDefinitionOptions,
  CrawlerLaunchOptions,
} from "../abstract";
import { PlaywrightCrawlingContext } from "crawlee";

export class NordlyLivingCrawlerDefinition extends AbstractCrawlerDefinition {
  private readonly _priceExtractor;
  constructor(options: CrawlerDefinitionOptions) {
    super(options);

    this._priceExtractor = (t: string | null) =>
      t?.split(",")[0].trim().replace(".", "");
  }

  override async crawlIntermediateCategoryPage(
    ctx: PlaywrightCrawlingContext
  ): Promise<void> {
    const menuItemLocator = ctx.page.locator(
      "(//ul[contains(@class, 'mega-menu__list')])[position() != last()]/li"
    );
    const menuItemCount = await menuItemLocator.count();

    for (let i = 0; i < menuItemCount; ++i) {
      const menuItem = menuItemLocator.nth(i);

      const rootCategoryLocator = menuItem.locator("xpath=/a");
      const rootCategoryUrl = await rootCategoryLocator.getAttribute("href");
      const rootCategoryName = await rootCategoryLocator.textContent();

      const subCategoryLocator = menuItem.locator("xpath=/ul/li/a");
      const subCategoryCount = await subCategoryLocator.count();
      for (let j = 0; j < subCategoryCount; ++j) {
        const subCategory = subCategoryLocator.nth(j);
        const subCategoryUrl = await subCategory.getAttribute("href");
        const subCategoryName = await subCategory.textContent();

        const categoryUrl = `https://nordlyliving.dk${subCategoryUrl}`;

        await ctx.enqueueLinks({
          urls: [categoryUrl],
          label: "LIST",
          userData: {
            categoryTree: [
              {
                name: rootCategoryName?.trim(),
                url: `https://nordlyliving.dk${rootCategoryUrl}`,
              },
              {
                name: subCategoryName?.trim(),
                url: categoryUrl,
              },
            ],
          },
        });
      }
    }
  }

  private async _extractPricingData(root: Locator) {
    const salePriceLocator = root.locator("div.price__sale");
    const salePriceExists =
      (await salePriceLocator.count()) === 1 &&
      (await salePriceLocator.isVisible());
    let price = undefined,
      originalPrice = undefined;
    if (salePriceExists) {
      originalPrice = await this.extractProperty(
        salePriceLocator,
        "s.price-item--regular",
        (n) => n.textContent().then(this._priceExtractor),
        false
      );

      price = await this.extractProperty(
        salePriceLocator,
        "span.price-item--sale",
        (n) => n.textContent().then(this._priceExtractor),
        false
      );
    } else {
      originalPrice = undefined;

      price = await this.extractProperty(
        root,
        "div.price__regular span.price-item--regular",
        (n) => n.textContent().then(this._priceExtractor),
        false
      );
    }

    if (!price) throw Error("Price not found");

    return {
      price: Number(price),
      currency: "DKK",
      isDiscounted: salePriceExists,
      originalPrice: originalPrice ? Number(originalPrice) : undefined,
    };
  }

  /**
   * This retailer does not use category scraping, it gets the URLs from sitemap
   */
  async extractCardProductInfo(
    categoryUrl: string,
    productCard: Locator
  ): Promise<ListingProductInfo> {
    const name = await this.extractProperty(
      productCard,
      "h3.card__heading a",
      (node) => node.last().textContent(),
      false
    );
    if (!name) throw Error("Product name not found");

    const url = await this.extractProperty(
      productCard,
      "h3.card__heading a",
      (node) => node.last().getAttribute("href"),
      false
    );
    if (!url) throw Error("Product url not found");

    const brand = await this.extractProperty(
      productCard,
      "//div[contains(@class, 'card--media')]/div[contains(@class, 'card__content')]//div[contains(@class, 'card-vendor')]",
      (node) => node.textContent(),
      true
    );

    const pricingData = await this._extractPricingData(productCard);

    return {
      name: name,
      url: url,

      brand: brand,
      ...pricingData,
      categoryUrl,
    };
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    const mainProductLocator = page.locator(
      "//section[contains(@id, 'MainProduct-template')]"
    );

    const productName = await this.extractProperty(
      mainProductLocator,
      "//div[contains(@class, 'product__title') and not(contains(@style,'display:none'))]/h1",
      (n) => n.textContent(),
      false
    );
    if (!productName) throw Error("Product name not found");

    const brand = await this.extractProperty(
      mainProductLocator,
      "//p[contains(@class, 'product__text') and contains(@class, 'caption-with-letter-spacing')]/a[@title]",
      (n) => n.textContent(),
      true
    );

    const descriptionExpander = page.locator(
      "//div[contains(@class, 'product__description')]/a"
    );
    const descriptionExpanderExists = (await descriptionExpander.count()) === 1;
    if (descriptionExpanderExists) {
      await this.handleCookieConsent(page);
      await descriptionExpander.click();
    }

    const description = await this.extractProperty(
      mainProductLocator,
      "div.product__description",
      (n) => n.textContent().then((t) => t?.replace("Vis mindre", "").trim()),
      true
    );
    const priceElement = mainProductLocator.locator(
      "//div[contains(@id, 'price-template') and not(contains(@style,'display:none'))]"
    );
    const pricingData = await this._extractPricingData(priceElement);

    const sku = await this.extractProperty(
      mainProductLocator,
      "div.product__sku",
      (n) =>
        n.textContent().then((text) => {
          if (text && text.includes(":")) {
            return text?.split(":")[1].trim();
          }
          return undefined;
        }),
      true
    );

    const schemaOrgString = await this.extractProperty(
      page,
      "//script[@type='application/ld+json' and @id='yoast-schema-graph']",
      (n) => n.textContent(),
      false
    );
    let schemaOrg = JSON.parse(schemaOrgString ?? "{}");
    if (schemaOrg !== undefined) {
      schemaOrg = schemaOrg["@graph"].filter(
        (g: any) => g["@type"] === "Product"
      )[0];
    }

    const gtin = schemaOrg?.offers[0].gtin;

    const imageLocator = mainProductLocator.locator("div.product__media img");
    const imageCount = await imageLocator.count();
    let images = [];
    for (let i = 0; i < imageCount; ++i) {
      const imageUrl = await imageLocator.nth(i).getAttribute("src");
      if (imageUrl) {
        images.push(`https:${imageUrl}`);
      }
    }

    // Deduplicate images (we get the same image twice, once from the small slider and once from the bigger one)
    images = [...new Set(images)];

    const availability = await this.extractProperty(
      mainProductLocator,
      "div.inventory-text",
      (n) =>
        n.getAttribute("class").then((c) => {
          if (c?.includes("green")) {
            return "in_stock";
          } else if (c?.includes("red")) {
            return "out_of_stock";
          } else if (c?.includes("yellow")) {
            return "back_order";
          }

          return undefined;
        }),
      true
    );

    // return a Dummy `DetailedProductInfo` object
    return {
      name: productName,
      url: page.url(),

      brand: brand,
      description: description,
      ...pricingData,

      gtin: gtin,
      sku: sku,
      mpn: sku,

      metadata: {
        schemaOrg: schemaOrg,
      },

      availability: availability ?? "out_of_stock", // assume we don't have it,

      images: images, // if not applicable return an empty array
      reviews: "unavailable",
      specifications: [], // if not applicable return an empty array

      //categoryTree is only optional if we already scraped it in the category page.
    };
  }

  static async create(
    launchOptions?: CrawlerLaunchOptions
  ): Promise<NordlyLivingCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets(
        launchOptions?.uniqueCrawlerKey
      );

    return new NordlyLivingCrawlerDefinition({
      detailsDataset,
      listingDataset,
      launchOptions,
      productCardSelector: "li.product",

      listingUrlSelector: "div.page-next a",
      detailsUrlSelector: "h3.card__heading a",
      // This is not actually the selector to accept the cookie consent prompt,
      // but the close button to NOT set your location to Sweden.
      // Need to click it to not get price in SEK and also to interact with the page.
      cookieConsentSelector:
        "div.recommendation-modal__container button.recommendation-modal__close-button",
      dynamicProductCardLoading: false,
    });
  }
}
