import { Locator, Page } from "playwright";
import { log } from "crawlee";
import { DetailedProductInfo, ListingProductInfo } from "../../types/offer";
import { AbstractCrawlerDefinition, CrawlerLaunchOptions } from "../abstract";

export class LevelLightCrawlerDefinition extends AbstractCrawlerDefinition {
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
    const name = await this.extractProperty(
      page,
      "//h1//span[@itemprop='name']",
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

    const mainImageLocatorStr = ".articleImage img";
    const imageCarouselLocatorStr = ".extraArticles.switcher a";

    const imageCarouselLocator = page.locator(imageCarouselLocatorStr);
    const imagesCount = await imageCarouselLocator.count();
    const images = [];
    for (let i = 0; i < imagesCount; i++) {
      const image = imageCarouselLocator.nth(i);
      await image.click();
      let mainImageLocator = page.locator(mainImageLocatorStr);
      let imageUrl = await mainImageLocator.getAttribute("src");
      if (!imageUrl) {
        continue;
      }
      images.push(imageUrl);
    }

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
  ): Promise<LevelLightCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets(
        launchOptions?.uniqueCrawlerKey
      );

    return new LevelLightCrawlerDefinition({
      detailsDataset,
      listingDataset,
      launchOptions,
    });
  }
}
