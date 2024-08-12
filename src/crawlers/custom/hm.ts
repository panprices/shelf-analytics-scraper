import { Locator, Page } from "playwright";
import { log } from "crawlee";
import { DetailedProductInfo, ListingProductInfo } from "../../types/offer.js";
import {
  AbstractCrawlerDefinition,
  CrawlerLaunchOptions,
} from "../abstract.js";
import { convertCurrencySymbolToISO } from "../../utils.js";

import { findElementByCSSProperties } from "../scraper-utils.js";

export class HMCrawlerDefinition extends AbstractCrawlerDefinition {
  // Only needed for category exploration. Return <undefined> otherwise.
  async extractCardProductInfo(
    _categoryUrl: string,
    _productCard: Locator
  ): Promise<undefined> {
    return undefined;
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    // It feels a little risky to select the h1 element here and hope they
    // only have one. However, it seems that they only have 1 h1 for SEO.
    const name = await this.extractProperty(
      page,
      "h1",
      (element) => element.innerText()
    ).then((text) => text?.trim());
    if (!name) {
      throw new Error("Cannot extract productName");
    }

    const brand = await this.extractProperty(
      page,
      "h2 a",
      (node) => node.innerText()
    ).then((text) => text?.trim());
    const brandUrl = await this.extractProperty(
      page,
      "h2 a",
      (node) => node.getAttribute("href")
    );
    const description = await this.extractProperty(
      page,
      "#section-descriptionAccordion p",
      (node) => node.innerText()
    ).then((text) => text?.trim());

    const rootElement = page.locator("body");
    const priceText = await findElementByCSSProperties(
      rootElement,
      {
        "overflow": "hidden",
        "text-overflow": "ellipsis",
        "text-align": "left",
      },
      "div"
    )
      .then((element) => element?.locator("span").first().innerText())
      .then((text) => text?.trim());
      if (!priceText) {
        throw new Error("Cannot extract price");
      }

    const [price, currency] = extractPriceAndCurrencyFromText(priceText);

    const originalPriceText = await findElementByCSSProperties(
      rootElement,
      {
        overflow: "hidden",
        "text-overflow": "ellipsis",
        "text-align": "left",
      },
      "div"
    )
      .then(async (element) => {
        if (!element) return null; // If the element itself is not found, return null
        // Get the locator for the span element at index 1
        const spanLocator = element.locator("span").nth(1);
        // Check if the span element exists
        const spanCount = await spanLocator.count();
        if (spanCount === 0) return null; // If span does not exist, return null
        // Return the innerText of the span element
        return await spanLocator.innerText();
      })
      .then((text) => text?.trim()); // Trim any whitespace from the text

    const originalPrice = originalPriceText
      ? extractPriceAndCurrencyFromText(originalPriceText)[0]
      : undefined;
    const isDiscounted = originalPriceText ? true : false;

    const availability = "in_stock"; // couldn't find a product where it's out of stock

    const sku = extractSKUFromProductUrl(page.url());
    const mpn = undefined;

    const images = await this.extractImageFromProductPage(page);

    const descriptionSpecifications = await this.extractSpecificationsFromTable(
      page.locator("div#section-descriptionAccordion dl dt"),
      page.locator("div#section-descriptionAccordion dl dd"),
    );

    // Sometimes there are no key, only values:
    const materialSpecifications = [];
    const materialSpecLocator = page.locator(
      "div#section-materialsAndSuppliersAccordion ul li"
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
      await this.extractCategoryTree(page.locator('nav[aria-label="Breadcrumb"] li a'))
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
    // H&M don't render visible images and instead have values such as these
    // "src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP" instead of URL's.
    // To get the website to properly render all images we need to scroll
    // to the bottom of the page.
    await page.evaluate(async () => {
      // Scroll down incrementally to ensure all lazy-loaded images are loaded
      const scrollDelay = 500; // Delay between scrolls in milliseconds
      const scrollStep = 1500; // Number of pixels to scroll in each step

      // Get the total height of the document
      const scrollHeight = document.body.scrollHeight;

      // Scroll until we reach the bottom of the page
      let currentScrollPosition = 0;
      while (currentScrollPosition < scrollHeight) {
        window.scrollBy(0, scrollStep); // Scroll down by scrollStep pixels
        currentScrollPosition += scrollStep;
        await new Promise(resolve => setTimeout(resolve, scrollDelay)); // Wait for new content to load
      }
    });
    // Get the image URL's
    for (const img of await page.locator('[data-testid="grid-gallery"] img').all()) {
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
