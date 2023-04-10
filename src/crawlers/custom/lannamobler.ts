import { Page } from "playwright";
import { DetailedProductInfo } from "../../types/offer";
import { AbstractCrawlerDefinition, CrawlerLaunchOptions } from "../abstract";
import { extractRootUrl } from "../../utils";

export class LannaMoblerCrawlerDefinition extends AbstractCrawlerDefinition {
  /**
   * This retailer does not use category scraping, it gets the URLs from sitemap
   */
  extractCardProductInfo(): Promise<undefined> {
    return Promise.resolve(undefined);
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    await page.waitForSelector('//*[@itemprop="name"]');

    const name = await this.extractProperty(
      page,
      '(//div[@class = "lm-product-details"]/div)[1]',
      (node) => node.textContent()
    );
    if (!name) throw new Error("Cannot find name of product");

    const brand = await this.extractProperty(
      page,
      '//a[contains(@class, "lm-product-details__brand-logo")]/img',
      (node) => node.getAttribute("alt")
    );

    const description = await this.extractProperty(
      page,
      ".lm-product-body-text-section__body",
      async (locator) => {
        const nodesCount = await locator.count();
        const texts = [];
        for (let i = 0; i < nodesCount; i++) {
          const text = await locator.nth(i).textContent();
          texts.push(text);
        }
        // deduplicate (because same text might be displayed differently for different screen sizes)
        return [...new Set(texts)].join("\n\n");
      }
    );

    const priceCurrencyString = await this.extractProperty(
      page,
      ".lm-product-details__current-price",
      (node) => node.textContent()
    );
    let [price, currency] = priceCurrencyString?.trim().split(" ") ?? ["0", ""];
    price = price.replace(".", "").replace(",", ".");

    const schemaOrgString = await this.extractProperty(
      page,
      "//script[@type='application/ld+json' and contains(text(), 'schema.org') and contains(text(), 'Product')]",
      (node) => node.textContent()
    );
    const schemaOrg = JSON.parse(schemaOrgString ?? "{}");

    const isDiscountedString = await this.extractProperty(
      page,
      ".lm-product-details__old-price",
      (node) => node.count().then((v) => (v > 0 ? "true" : "false"))
    );
    const isDiscounted = isDiscountedString === "true";

    const originalPriceCurrencyString = await this.extractProperty(
      page,
      "//div[@class='lm-product-details__old-price']/span[2]",
      (node) => node.textContent()
    );
    const originalPrice = originalPriceCurrencyString
      ?.trim()
      .split(" ")[0]
      .replace(".", "")
      .replace(",", ".");

    if (currency.length !== 3 && currency !== "UNKNOWN") {
      currency = schemaOrg?.offers?.priceCurrency;
    }
    const gtin = schemaOrg?.gtin;
    const sku = schemaOrg?.sku;
    const mpn = schemaOrg?.mpn;

    const categoryTree = await this.extractCategoryTree(
      page.locator("//li[@class='lm-breadcrumbs__list-item ']/a")
    );

    const availableCheckMark = await this.extractProperty(
      page,
      "//div[contains(@class, 'lm-product-delivery-info__in-stock-details')]/i",
      (node) => node.count().then((c) => (c > 0).toString())
    );
    const availability =
      availableCheckMark === "true" ? "in_stock" : "out_of_stock";

    const imagesString = await this.extractProperty(
      page,
      "//div[" +
        "contains(@class, 'slick-slide') " +
        "and not(contains(@class, 'slick-cloned')) " +
        "and not(contains(@class, 'slick-slider'))" +
        "]/img",
      async (node) => {
        const imageCount = await node.count();
        const images = [];
        for (let i = 0; i < imageCount; i++) {
          const image = await node.nth(i).getAttribute("src");
          images.push(image);
        }
        return JSON.stringify(images);
      }
    );
    const images = JSON.parse(imagesString ?? "[]");

    const specificationsString = await this.extractProperty(
      page,
      "//div[contains(@class, 'is--productinfo')]//li",
      async (node) => {
        const nodesCount = await node.count();
        const texts = [];
        for (let i = 0; i < nodesCount; i++) {
          const listItem = await node.nth(i);
          const key = await listItem.locator("div").nth(0).textContent();
          const value = await listItem.locator("div").nth(1).textContent();
          texts.push({ key, value });
        }
        // deduplicate (because same text might be displayed differently for different screen sizes)
        return JSON.stringify(texts);
      }
    );
    const specifications = JSON.parse(specificationsString ?? "[]");

    // return a Dummy `DetailedProductInfo` object
    return {
      name: name,
      url: page.url(),

      brand: brand,
      description: description,
      price: Number(price),
      currency: currency,
      isDiscounted: isDiscounted,
      originalPrice: Number(originalPrice),

      gtin: gtin,
      sku: sku,
      mpn: mpn,

      categoryUrl: categoryTree[categoryTree.length - 1].url,
      categoryTree: categoryTree,

      metadata: {},

      availability: availability,
      fetchedAt: new Date().toISOString(),
      retailerDomain: extractRootUrl(page.url()),

      images: images, // if not applicable return an empty array
      reviews: "unavailable",
      specifications: specifications,

      // It has variants, but each variant define its own URL and should appear independently in the sitemap
      // https://www.lanna.no/oppbevaring-og-hyller/hyller-og-vegghyller-/pythagoras-xs-shelf-and-brackets---dusty-apricot/
    };
  }

  static async create(
    launchOptions?: CrawlerLaunchOptions
  ): Promise<LannaMoblerCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets();

    return new LannaMoblerCrawlerDefinition({
      detailsDataset,
      listingDataset,
      launchOptions,
    });
  }
}
