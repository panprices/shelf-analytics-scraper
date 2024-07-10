import { Locator, Page } from "playwright";
import { log } from "crawlee";
import { DetailedProductInfo, ListingProductInfo } from "../../types/offer.js";
import {
  AbstractCrawlerDefinition,
  CrawlerLaunchOptions,
} from "../abstract.js";

export class FlosCrawlerDefinition extends AbstractCrawlerDefinition {
  // Only needed for category exploration. Return <undefined> otherwise.
  async extractCardProductInfo(
    categoryUrl: string,
    productCard: Locator
  ): Promise<ListingProductInfo> {
    const url = await this.extractProperty(productCard, "", (node) =>
      node.getAttribute("href")
    );
    if (!url) throw new Error("Cannot find url of productCard");

    const categoryTree = await this.extractCategoryTreeFromCategoryPage(
      productCard.page().locator(""),
      0,
      productCard.page().locator("")
    );
    return {
      url,
      categoryUrl,
      popularityCategory: categoryTree ? categoryTree : undefined,
    };
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    // wait to load the full resolution images
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    const name = await this.extractProperty(
      page,
      ".product-detail__body div.u-h3",
      (element) => element.innerText()
    ).then((text) => text?.trim());

    const schemaOrgString = await this.extractProperty(
      page,
      "//script[@type='application/ld+json' and contains(text(), 'schema.org') and contains(text(), 'Product')]",
      (node) => node.textContent()
    );
    let schemaOrg = undefined;
    let gtin;
    if (schemaOrgString) {
      try {
        schemaOrg = JSON.parse(schemaOrgString);
        gtin = schemaOrg.gtin;
      } catch (error) {
        log.warning("Error extracting data from schema.org", { error });
      }
    }

    const imagesString = await this.extractProperty(
      page,
      ".product-detail__image-grid img",
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

    return {
      name,
      url: page.url(),

      brand: "Flos",
      brandUrl: "flos.com",
      description: "",
      price: 0,
      currency: "EUR",
      availability: "in_stock",

      gtin,

      images, // if not applicable return an empty array
      specifications: [], // if not applicable return an empty array

      categoryTree: [], // is only optional if we already scraped it in the category page.
      metadata: { schemaOrg },
    };
  }

  static async create(
    launchOptions?: CrawlerLaunchOptions
  ): Promise<FlosCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets(
        launchOptions?.uniqueCrawlerKey
      );

    return new FlosCrawlerDefinition({
      detailsDataset,
      listingDataset,
      launchOptions,
    });
  }
}
