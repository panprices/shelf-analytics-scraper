import { Locator, Page } from "playwright";
import { log } from "crawlee";
import { DetailedProductInfo, ListingProductInfo } from "../../types/offer.js";
import {
  AbstractCrawlerDefinition,
  CrawlerLaunchOptions,
} from "../abstract.js";
import { convertCurrencySymbolToISO } from "../../utils.js";

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

    // Sometimes there are no key, only values:
    const materialSpecifications = [];
    const materialSpecLocator = page.locator(
      "div.product div#section-materialsAndSuppliersAccordion ul li"
    );
    for (const materialSpecRowLocator of await materialSpecLocator.all()) {
      const key = (
        await this.extractProperty(materialSpecRowLocator, "h4", (h4) =>
          h4.textContent()
        )
      )?.trim();

      const value = (
        await materialSpecRowLocator.locator("p").innerText()
      ).trim();
      materialSpecifications.push({
        key: key || "",
        value: value,
      });
    }
    // const materialSpecifications = await this.extractSpecificationsFromTable(
    //   page.locator(
    //     "div.product div#section-materialsAndSuppliersAccordion ul li h4"
    //   ),
    //   page.locator(
    //     "div.product div#section-materialsAndSuppliersAccordion ul li p"
    //   )
    // );
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

/** "1 519,99 €" -> [1519.99, "EUR"]*/
function extractPriceAndCurrencyFromText(text: string): [number, string] {
  text = text
    .trim()
    .replaceAll(".", "")
    .replaceAll(",", ".")
    .replaceAll("\u00A0", ""); // remove the non-breaking space with normal space;
  const price = parseFloat(text.split(" ")[0]);
  const currencySymbol = text.trim().split(" ")[1];
  const currency = convertCurrencySymbolToISO(currencySymbol);

  return [price, currency];
}
