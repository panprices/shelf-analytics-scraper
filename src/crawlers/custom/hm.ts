import { Locator, Page } from "playwright";
import { log } from "crawlee";
import { DetailedProductInfo, ListingProductInfo } from "../../types/offer";
import { AbstractCrawlerDefinition, CrawlerLaunchOptions } from "../abstract";
import { extractPriceAndCurrencyFromText } from "../../utils";

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
    ).then((text) => text?.trim());
    if (!name) {
      throw new Error("Cannot extract productName");
    }

    const brand = await this.extractProperty(
      page,
      "div.product hm-product-name a",
      (node) => node.innerText()
    ).then((text) => text?.trim());
    const brandUrl = await this.extractProperty(
      page,
      "div.product hm-product-name a",
      (node) => node.getAttribute("href")
    );
    const description = await this.extractProperty(
      page,
      "div.product div#section-descriptionAccordion p",
      (node) => node.innerText()
    ).then((text) => text?.trim());

    const priceText = await this.extractProperty(
      page,
      "div.product #product-price span:first-child",
      (node) => node.innerText()
    ).then((text) => text?.trim());
    if (!priceText) {
      throw new Error("Cannot extract price");
    }

    const [price, currency] = extractPriceAndCurrencyFromText(priceText);

    const originalPriceText = await this.extractProperty(
      page,
      "div.product #product-price span:nth-child(2)",
      (node) => node.innerText()
    ).then((text) => text?.trim());
    const originalPrice = originalPriceText
      ? extractPriceAndCurrencyFromText(originalPriceText)[0]
      : undefined;
    const isDiscounted = originalPriceText ? true : false;

    const availability = "in_stock"; // couldn't find a product where it's out of stock

    const sku = extractSKUFromProductUrl(page.url());
    const mpn = undefined;

    const images = await this.extractImageFromProductPage(page);

    const descriptionSpecifications = await this.extractSpecificationsFromTable(
      page.locator("div.product div#section-descriptionAccordion dl dt"),
      page.locator("div.product div#section-descriptionAccordion dl dd")
    );
    const materialSpecifications = await this.extractSpecificationsFromTable(
      page.locator(
        "div.product div#section-materialsAndSuppliersAccordion ul li h4"
      ),
      page.locator(
        "div.product div#section-materialsAndSuppliersAccordion ul li p"
      )
    );
    const specifications = descriptionSpecifications
      .concat(materialSpecifications)
      .map((spec) => {
        return {
          key: spec.key.replace(/:$/, ""), // remove colon at the end
          value: spec.value,
        };
      });

    const schemaOrgString = await this.extractProperty(
      page,
      "//script[@type='application/ld+json' and contains(text(), 'schema.org') and contains(text(), 'Product')]",
      (node) => node.textContent()
    );
    let schemaOrg = undefined;
    let gtin, reviews;
    if (schemaOrgString) {
      try {
        schemaOrg = JSON.parse(schemaOrgString);
        gtin = schemaOrg.gtin;

        if (schemaOrg.aggregateRating) {
          reviews = {
            reviewCount: schemaOrg.aggregateRating.reviewCount,
            averageReview: schemaOrg.aggregateRating.ratingValue,
            recentReviews: [],
          };
        }
      } catch (error) {
        log.warning("Error extracting data from schema.org", { error });
      }
    }

    const categoryTree = (
      await this.extractCategoryTree(page.locator("hm-breadcrumbs nav li a"))
    ).slice(1, -1);

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

      categoryTree, // is only optional if we already scraped it in the category page.

      // variantGroupUrl,
      // variant: 0, // 0, 1, 2, 3, ...

      metadata: { schemaOrg },
    };
  }

  async extractImageFromProductPage(page: Page): Promise<string[]> {
    const imageUrls = [];
    for (const img of await page.locator("div.product .pdp-image img").all()) {
      const url = await img.getAttribute("src");
      if (url) {
        imageUrls.push(url);
      }
    }

    return imageUrls;
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
      // listingUrlSelector: ,
      // detailsUrlSelector: ,
      // productCardSelector: ,
      // cookieConsentSelector: ,
      dynamicProductCardLoading: false,
      launchOptions,
    });
  }
}

/** "https://www2.hm.com/de_de/productpage.1219517001.html" => "1219517001" */
function extractSKUFromProductUrl(url: string): string | undefined {
  return url.match(/productpage\.(\d+)/)?.[1];
}
