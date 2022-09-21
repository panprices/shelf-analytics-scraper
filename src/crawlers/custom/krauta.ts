import { Locator, Page } from "playwright";
import {
  browserCrawlerEnqueueLinks,
  Dataset,
  log,
  PlaywrightCrawlingContext,
} from "crawlee";
import { v4 as uuidv4 } from "uuid";

import { AbstractCrawlerDefinition } from "../abstract";
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

export class KrautaCrawlerDefinition extends AbstractCrawlerDefinition {
  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    const brand = await this.extractProperty(
      page,
      "a.product-heading__brand-name",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    if (!brand) throw new Error("Cannot extract brand");

    const productName = await this.extractProperty(
      page,
      "h1.product-heading__product-name",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    if (!productName) throw new Error("Cannot extract productName");

    const description = await this.extractProperty(
      page,
      "div.product-info__wrapper  div.product-description",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    if (!description) throw new Error("Cannot extract description");

    const originalPriceLocator = page.locator(
      "div.product-page__top-info .price-view__before-discount"
    );
    const isDiscounted = (await originalPriceLocator.count()) > 0;
    const originalPrice = isDiscounted
      ? extractNumberFromText((await originalPriceLocator.textContent())!)
      : undefined;

    const price = await this.extractProperty(
      page,
      "div.product-page__top-info .price-view__sale-price-container",
      (node) => node.textContent()
    ).then((priceString) => {
      if (!priceString) {
        throw new Error("Cannot extract price");
      }
      return extractNumberFromText(priceString);
    });

    const skuAndEanListItem = page.locator("ul.article-numbers li");
    if ((await skuAndEanListItem.count()) !== 2) {
      throw new Error("Found more than 2 row in ArticleNumber-EAN ul");
    }
    const skuAndEanText = await skuAndEanListItem.allTextContents();
    const sku = extractNumberFromText(skuAndEanText[0]).toString();
    const ean = extractNumberFromText(skuAndEanText[1]).toString();

    const images = page.locator(
      "div.product-images-and-videos div.carousel img"
    );
    const imageCount = await images.count();
    const imageUrls = [];
    for (let i = 0; i < imageCount; ++i) {
      const imgUrl = await images.nth(i).getAttribute("data-src");
      if (imgUrl) {
        imageUrls.push(cleanImageUrl(imgUrl));
      }
    }

    const inStock = await this.extractProperty(
      page,
      "span.availability__message",
      (node) => node.first().textContent()
    ).then((availabilityMessage) =>
      availabilityMessage?.toLocaleLowerCase().includes("ej tillgänglig")
        ? false
        : true
    );

    const productSpecTableLocator = page
      .locator("div.product-attributes div.product-attributes__content")
      .first();
    const specKeys = await productSpecTableLocator
      .locator("dt")
      .allTextContents();
    const specVals = await productSpecTableLocator
      .locator("dd")
      .allTextContents();
    const specCount = specKeys.length;
    const specifications: Specification[] = [...Array(specCount).keys()].map(
      (i) => ({
        key: specKeys[i],
        value: specVals[i],
      })
    );

    const categoriesATags = await page.locator(
      "div.product-page__breadcrumbs a"
    );
    const categoriesATagsCount = await categoriesATags.count();
    const categories = [];
    for (let i = 0; i < categoriesATagsCount; ++i) {
      const category = {
        name: <string>await categoriesATags.nth(i).textContent(),
        url: <string>await categoriesATags.nth(i).getAttribute("href"),
      };
      categories.push(category);
    }

    const reviewCount = await this.extractProperty(
      page,
      "div.testfreaks-reviews .tf-based span",
      (node) => node.first().textContent()
    ).then((reviewCountText) => {
      if (!reviewCountText) {
        return 0;
      }
      return extractNumberFromText(reviewCountText);
    });

    const extractReviews = async () => {
      const averageReview = await this.extractProperty(
        page,
        "div.testfreaks-reviews .tf-rating",
        (node) => node.textContent()
      ).then((ratingString) => {
        if (!ratingString) throw new Error("Cannot extract average reviews");
        return parseFloat(ratingString);
      });

      const reviews: ProductReviews = {
        reviewCount,
        averageReview,
        recentReviews: [],
      };
      return reviews;
    };
    const reviews = reviewCount > 0 ? await extractReviews() : "unavailable";

    return {
      url: page.url(),
      brand,
      name: productName,
      description,
      price,
      originalPrice,
      isDiscounted,
      currency: "SEK",
      images: imageUrls,
      sku,
      gtin: ean,
      // metadata,
      inStock,
      categoryTree: categories,
      specifications,
      reviews,
    };
  }

  async extractCardProductInfo(
    categoryUrl: string,
    productCard: Locator
  ): Promise<ListingProductInfo> {
    const productName = await this.extractProperty(productCard, "h2", (node) =>
      node.textContent()
    );
    if (!productName) throw new Error("Cannot find productName of productCard");

    const url = await this.extractProperty(
      productCard,
      "a.product-card",
      (node) => node.getAttribute("href")
    );
    if (!url) throw new Error("Cannot find url of productCard");

    const originalPriceString = await this.extractProperty(
      productCard,
      ".price-view__before-discount",
      (node) => node.textContent()
    );
    const originalPrice = originalPriceString
      ? extractPriceFromText(originalPriceString)
      : undefined;
    const isDiscounted = originalPriceString ? true : false;

    const priceString = await this.extractProperty(
      productCard,
      ".price-view__sale-price-container",
      (node) => node.textContent()
    );
    if (!priceString) throw new Error("Cannot find price of productCard");

    const price = extractPriceFromText(priceString);

    const previewImageUrl = await this.extractPreviewImageOfProductCard(
      productCard
    );

    if (!previewImageUrl)
      throw new Error("Cannot find previewImage of productCard");

    const currentProductInfo: ListingProductInfo = {
      // brand,
      name: productName,
      url,
      price,
      currency: "SEK",
      isDiscounted,
      originalPrice,
      previewImageUrl,
      popularityIndex: -1, // this will be overwritten later
      categoryUrl,
    };

    return currentProductInfo;
  }

  static async create(): Promise<KrautaCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets();

    return new KrautaCrawlerDefinition({
      detailsDataset,
      listingDataset,
      listingUrlSelector: "a[rel='next']",
      detailsUrlSelector: "article.product-list__card a.product-card",
      productCardSelector: "article.product-list__card",
      dynamicProductCardLoading: false,
    });
  }

  async extractPreviewImageOfProductCard(
    productCard: Locator
  ): Promise<string | undefined> {
    // 2 types of previewImage: only 1 image, or multiple images that can be cycled

    const mainImageLocator = productCard.locator("div[data-index='0']");
    let previewImageUrl;
    if ((await mainImageLocator.count()) > 0) {
      previewImageUrl = await this.extractProperty(
        mainImageLocator,
        "img",
        (node) => node.first().getAttribute("src")
      );
      return previewImageUrl;
    }

    previewImageUrl = await this.extractProperty(
      productCard,
      "img.product-card__image",
      (node) => node.first().getAttribute("src")
    );
    return previewImageUrl;
  }
}

const extractPriceFromText = (priceString: string): number => {
  try {
    const price = extractNumberFromText(priceString);
    return price;
  } catch (error) {
    log.error(`Cannot extract price from priceString: ${priceString}`);
    throw error;
  }
};

/**
 * Remove the query parameters that applies modification on the image.
 * @example
 * "https://public.keskofiles.com/f/btt/ASSET_JPEG_24882951?auto=format&bg=fff&dpr=2&fit=fill&h=558&q=80&w=558"
 * => "https://public.keskofiles.com/f/btt/ASSET_JPEG_24882951"
 */
const cleanImageUrl = (imgUrl: string): string => {
  return imgUrl.split("?")[0];
};
