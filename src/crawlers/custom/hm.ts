import { Locator, Page } from "playwright";
import { log } from "crawlee";
import { DetailedProductInfo, ListingProductInfo } from "../../types/offer";
import { AbstractCrawlerDefinition, CrawlerLaunchOptions } from "../abstract";
import { extractPriceAndCurrencyFromText } from "./wayfair";

export class HMCrawlerDefinition extends AbstractCrawlerDefinition {
  
  // Only needed for category exploration. Return <undefined> otherwise.
  async extractCardProductInfo(
    _categoryUrl: string,
    _productCard: Locator
  ): Promise<undefined> {
    return undefined;
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    const name = await this.extractProperty(
      page,
      "div.product hm-product-name h1",
      (element) => element.innerText()
    ).then(text => text?.trim());
    if (!name) {
      throw new Error("Cannot extract productName");
    }


    const brand = await this.extractProperty(
      page,
      "div.product hm-product-name a",
      (node) => node.innerText()
    ).then(text => text?.trim());
    const brandUrl = await this.extractProperty(
      page,
      "div.product hm-product-name a",
      (node) => node.getAttribute("href")
    );
    const description = await this.extractProperty(
      page,
      "div.product div#section-descriptionAccordion p",
      (node) => node.innerText()
    ).then(text => text?.trim());
    
    const priceText = await this.extractProperty(
      page,
      "div.product #product-price",
      node => node.innerText()
    ).then(text => text?.trim());
    if (!priceText) {
      throw new Error("Cannot extract price");
    }

    const [price, currency] = extractPriceAndCurrencyFromText(priceText);


    

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
    
    return {
      name,
      url: page.url(),

      brand,
      brandUrl,
      description,
      price,
      currency,
      isDiscounted,
      originalPrice,
      availability,

      gtin,
      sku,
      mpn,

      images, // if not applicable return an empty array
      specifications, // if not applicable return an empty array
      reviews,

      // categoryTree, // is only optional if we already scraped it in the category page.

      variantGroupUrl,
      variant: 0, // 0, 1, 2, 3, ...

      metadata: { schemaOrg },
    };
  }

  static async create(
    launchOptions?: CrawlerLaunchOptions
  ): Promise<HMCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets(
        launchOptions?.uniqueCrawlerKey
      );

    return new HMCrawlerDefinition({
      detailsDataset,
      listingDataset,

      // Only needed for category exploration
      listingUrlSelector: ,
      detailsUrlSelector: ,
      productCardSelector: ,
      cookieConsentSelector: ,
      dynamicProductCardLoading: false,
      launchOptions,
    });
  }
}
