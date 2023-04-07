import { Page } from "playwright";
import { DetailedProductInfo } from "../../types/offer";
import { AbstractCrawlerDefinition, CrawlerLaunchOptions } from "../abstract";
import { extractRootUrl } from "../../utils";

export class FinnishDesignShopCrawlerDefinition extends AbstractCrawlerDefinition {
  /**
   * This retailer does not use category scraping, it gets the URLs from sitemap
   */
  extractCardProductInfo(): Promise<undefined> {
    return Promise.resolve(undefined);
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    await page.waitForSelector('//*[@itemprop="name"]');

    // return a Dummy `DetailedProductInfo` object
    const sku = await this.extractProperty(
      page,
      '//*[@itemprop="sku"]',
      (node) => node.getAttribute("content")
    );
    const mpn = sku?.substring(2);

    const categoryTree = await this.extractCategoryTree(
      page.locator('//ol[contains(@class, "breadcrumb")]//a'),
      1
    );

    const name = await this.extractProperty(
      page,
      '//*[@itemprop="name"]',
      (node) => node.textContent()
    );

    if (!name) throw new Error("Cannot find name of product");

    const brand = await this.extractProperty(
      page,
      '(//div[contains(@class, "product-info-col")]/h2)[1]/a',
      (node) => node.textContent()
    );

    const description = await this.extractProperty(
      page,
      '//div[contains(@class, "product-description") and not(contains(@class, "hidden"))]',
      (node) => node.textContent()
    );

    const isDiscountedStr = await this.extractProperty(
      page,
      "span.js-price-sale",
      (node) => node.count().then((c) => (c > 0).toString())
    );
    const isDiscounted = isDiscountedStr === "true";

    let price: string | null | undefined;
    let currency: string | null | undefined;
    let originalPrice: string | null | undefined = undefined;

    if (isDiscounted) {
      price = await this.extractProperty(page, "span.js-price-sale", (node) =>
        node.getAttribute("data-localized-price")
      );

      // The price from which we remove commas, dots, spaces and numbers
      currency = await this.extractProperty(
        page,
        "span.js-price-sale",
        (node) => node.textContent().then((t) => t?.replace(/[0-9,\\. ]/g, ""))
      );

      originalPrice = await this.extractProperty(
        page,
        "span.js-price-original",
        (node) => node.getAttribute("data-localized-original-price")
      );
    } else {
      const priceCurrencyString = await this.extractProperty(
        page,
        "span.price-localized",
        (node) => node.textContent()
      );

      price = priceCurrencyString?.replace(/[^0-9,\\. ]/g, "");
      currency = priceCurrencyString?.replace(/[^A-Z]/g, "");
    }

    if (!price) throw new Error("Cannot find price of product");
    if (!currency) throw new Error("Cannot find currency of product");

    const schemaOrg = await this.extractSchemaOrgFromAttributes(page);

    const isAvailable = await this.extractProperty(
      page,
      '//span[contains(@class, "sku-availability") and contains(@class, "bg-checkmark")]',
      (node) => node.count().then((c) => (c > 0).toString())
    );

    const specsReadMoreButton = page.locator(
      '//div[@id = "panelFeatures"]//a[@data-action = "toggle"]'
    );
    const specsReadMoreButtonCount = await specsReadMoreButton.count();
    if (specsReadMoreButtonCount === 1) {
      await specsReadMoreButton.click();
    }

    const specsPropertiesLocator = page.locator(
      '//dl[contains(@class, "product-features-list")]//dt'
    );
    const specsValuesLocator = page.locator(
      '//dl[contains(@class, "product-features-list")]//dd'
    );
    const specsCount = await specsPropertiesLocator.count();
    // Zip the properties and values together
    const specsArray = await Promise.all(
      Array.from(Array(specsCount).keys()).map(async (i) => {
        const property = (await specsPropertiesLocator
          .nth(i)
          .textContent()) as string;
        const value = (await specsValuesLocator.nth(i).textContent()) as string;
        return { key: property, value: value };
      })
    );

    const images = await page
      .locator("img.product-large-image")
      .evaluateAll((nodes) => {
        return nodes.map((node) => node.getAttribute("src"));
      });

    return {
      name: name,
      url: page.url(),

      brand: brand,
      description: description,
      price: Number(price),
      currency: currency,
      isDiscounted: isDiscounted,
      originalPrice: originalPrice ? Number(originalPrice) : undefined,

      gtin: undefined,
      sku: sku,
      mpn: mpn,

      categoryUrl: categoryTree[categoryTree.length - 1].url,
      categoryTree: categoryTree,

      metadata: {
        schemaOrg: schemaOrg,
        originalPrice: originalPrice ? Number(originalPrice) : undefined,
      },

      availability: isAvailable === "true" ? "in_stock" : "out_of_stock",
      fetchedAt: new Date().toISOString(),
      retailerDomain: extractRootUrl(page.url()),

      images: images.filter((i) => i !== undefined).map((i) => i as string), // if not applicable return an empty array
      reviews: "unavailable",
      specifications: specsArray, // if not applicable return an empty array
    };
  }

  static async create(
    launchOptions?: CrawlerLaunchOptions
  ): Promise<FinnishDesignShopCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets();

    return new FinnishDesignShopCrawlerDefinition({
      detailsDataset,
      listingDataset,
      launchOptions,
    });
  }
}
