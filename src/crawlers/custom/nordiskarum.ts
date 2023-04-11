import { Locator, Page } from "playwright";
import {
  browserCrawlerEnqueueLinks,
  Dataset,
  log,
  PlaywrightCrawlingContext,
} from "crawlee";
import { v4 as uuidv4 } from "uuid";

import { AbstractCrawlerDefinition, CrawlerLaunchOptions } from "../abstract";
import {
  Category,
  DetailedProductInfo,
  IndividualReview,
  ListingProductInfo,
  OfferMetadata,
  ProductReviews,
  SchemaOrg,
  Specification,
} from "../../types/offer";
import { extractNumberFromText } from "../../utils";

export class NordiskaRumCrawlerDefinition extends AbstractCrawlerDefinition {
  async extractCardProductInfo(
    categoryUrl: string,
    productCard: Locator
  ): Promise<ListingProductInfo> {
    const productName = await this.extractProperty(
      productCard,
      "a.sf-product-card__link h3",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    if (!productName) throw new Error("Cannot find productName of productCard");

    const url = await this.extractProperty(
      productCard,
      "> a.sf-product-card__link",
      (node) => node.getAttribute("href")
    );
    if (!url) throw new Error("Cannot find url of productCard");

    const currentProductInfo: ListingProductInfo = {
      name: productName,
      url,
      popularityIndex: -1, // this will be overwritten later
      categoryUrl,
    };

    return currentProductInfo;
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    // Wait for images
    await page
      .locator(".m-product-gallery ul.glide__slides img:not(.noscript)")
      .first()
      .waitFor({ state: "attached" });

    const productName = await this.extractProperty(
      page,
      ".product__info .sf-product-name",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    if (!productName) throw new Error("Cannot extract productName");

    const description = await this.extractProperty(
      page,
      ".product__info .product__description",
      (node) => node.first().textContent()
    ).then((text) => text?.trim());

    const price = await this.extractPriceFromProductDetailsPage(page);
    const originalPrice = await this.extractOriginalPriceFromProductDetailsPage(
      page
    );
    const isDiscounted = !!originalPrice;

    const images = await this.extractProductImagesFromProductDetailsPage(page);

    const availabilitySchemaOrg = await this.extractProperty(
      page,
      "meta[itemprop='availability']",
      (node) => node.getAttribute("content")
    ).then((text) => text?.trim());

    // default to in stock since we haven't found any out of stock products on their website
    let availability = "in_stock";
    if (availabilitySchemaOrg) {
      availability = availabilitySchemaOrg.includes("InStock")
        ? "in_stock"
        : "out_of_stock";
    }

    const skuText = await this.extractProperty(
      page,
      ".product__info .product__sku",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    const sku = skuText?.replace("Artikelnummer:", "").trim();

    const specKeys = await page
      .locator(".product__info .sf-property__name")
      .allTextContents()
      .then((textContents) => textContents.map((text) => text.trim()));
    const specVals = await page
      .locator(".product__info .sf-property__value")
      .allTextContents()
      .then((textContents) => textContents.map((text) => text.trim()));
    if (specKeys.length !== specVals.length) {
      log.warning("Cannot extract specs: number of keys and vals mismatch.");
    }

    const specifications: Specification[] = [];
    for (let i = 0; i < specKeys.length; i++) {
      specifications.push({ key: specKeys[i], value: specVals[i] });
    }
    const brand = specifications.find((spec) =>
      spec.key.includes("Varumärke")
    )?.value;

    const categoryTree = await this.extractCategoryTree(
      page.locator("li.sf-breadcrumbs__list-item a"),
      1
    );
    categoryTree.pop(); // last category breadcrum is the product itself

    return {
      name: productName,
      url: page.url(),

      brand,
      description,
      price,
      originalPrice,
      isDiscounted,
      currency: "SEK",
      images,
      categoryTree,

      gtin: undefined,
      sku,
      mpn: sku,

      availability,
      reviews: "unavailable",
      specifications,

      metadata: {},
    };
  }

  async extractOriginalPriceFromProductDetailsPage(page: Page) {
    let priceText = await this.extractProperty(
      page,
      ".product__info .sf-price__old",
      (node) => node.textContent()
    ).then((text) => text?.trim());

    if (!priceText) {
      return undefined;
    }

    const originalPrice = parseInt(
      priceText.toLowerCase().replace("kr", "").replace(/\s/g, "")
    );
    return originalPrice;
  }

  async extractPriceFromProductDetailsPage(page: Page) {
    let priceText = await this.extractProperty(
      page,
      ".product__info .sf-price__regular",
      (node) => node.textContent()
    ).then((text) => text?.trim());

    if (!priceText) {
      priceText = await this.extractProperty(
        page,
        ".product__info .sf-price__special",
        (node) => node.textContent()
      ).then((text) => text?.trim());
    }

    if (!priceText) {
      throw new Error("Cannot extract price");
    }

    const price = parseInt(
      priceText.toLowerCase().replace("kr", "").replace(/\s/g, "")
    );
    return price;
  }

  async extractProductImagesFromProductDetailsPage(
    page: Page
  ): Promise<string[]> {
    // Try to extract from thumbnails:
    const imageLocator = page.locator(
      ".m-product-gallery ul.glide__slides img:not(.noscript)"
    );
    const imageCount = await imageLocator.count();
    const images = [];
    for (let i = 0; i < imageCount; ++i) {
      const imgUrl = await imageLocator.nth(i).getAttribute("src");
      if (imgUrl) {
        images.push(imgUrl);
      }
    }
    const imagesDeduplicated = [...new Set(images)];
    return imagesDeduplicated;
  }

  async extractCategoryTreeOfCategorypage(page: Page): Promise<Category[]> {
    const breadcrumbLocator = page.locator("div.breadcrumbs li");
    const breadcrumbCount = await breadcrumbLocator.count();
    const categoryTree = [];
    const startingIndex = 1; // ignore 1st breadcrum which is the homepage

    for (let i = startingIndex; i < breadcrumbCount; i++) {
      const name = (<string>(
        await breadcrumbLocator.nth(i).textContent()
      )).trim();

      const url =
        i === breadcrumbCount - 1
          ? page.url()
          : <string>(
              await breadcrumbLocator.nth(i).locator("a").getAttribute("href")
            );

      categoryTree.push({
        name,
        url,
      });
    }

    return categoryTree;
  }

  static async create(
    launchOptions?: CrawlerLaunchOptions
  ): Promise<NordiskaRumCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets();

    return new NordiskaRumCrawlerDefinition({
      detailsDataset,
      listingDataset,
      listingUrlSelector: "nav .sf-pagination__item--next a",
      detailsUrlSelector: ".sf-product-card > a.sf-product-card__link",
      productCardSelector: ".sf-product-card",
      cookieConsentSelector: "button#CybotCookiebotDialogBodyLevelButtonAccept",
      launchOptions,
    });
  }
}
