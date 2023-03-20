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

export class BernoMoblerCrawlerDefinition extends AbstractCrawlerDefinition {
  async extractCardProductInfo(
    categoryUrl: string,
    productCard: Locator
  ): Promise<ListingProductInfo> {
    const productName = await this.extractProperty(productCard, "h3", (node) =>
      node.textContent()
    ).then((text) => text?.trim());
    if (!productName) throw new Error("Cannot find productName of productCard");

    const url = await this.extractProperty(productCard, "a", (node) =>
      node.getAttribute("href")
    );
    if (!url) throw new Error("Cannot find url of productCard");

    return {
      name: productName,
      url,
      popularityIndex: -1, // will be overwritten later
      categoryUrl,
    };
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    const productNameSelector =
      "div.product-grid__content .product-single__title";
    await page.waitForSelector(productNameSelector);

    const productName = await this.extractProperty(
      page,
      productNameSelector,
      (node) => node.textContent()
    ).then((text) => text?.trim());
    if (!productName) {
      throw new Error("Cannot extract productName");
    }

    const description = await this.extractProperty(
      page,
      "div.product-grid__content .rte",
      (node) => node.first().textContent()
    ).then((text) => text?.trim());

    const prices = await extractPricesFromProductDetailsPage(page);
    const price = prices[0];
    const originalPrice = prices[1];

    const isDiscounted = !!originalPrice;

    const metadata: OfferMetadata = {};
    const schemaOrgString = await page
      .locator(
        "//script[@type='application/ld+json' and contains(text(), 'schema.org') and contains(text(), 'Product')]"
      )
      .textContent();
    if (!schemaOrgString) {
      throw new Error("Cannot extract schema.org data");
    }
    const schemaOrg = JSON.parse(schemaOrgString);

    const brand = schemaOrg?.brand;
    const gtin = schemaOrg?.gtin;
    const sku = schemaOrg?.sku;
    let availability;
    try {
      availability = schemaOrg.offers[0].availability.includes("InStock")
        ? "in_stock"
        : "out_of_stock";
    } catch (error) {
      throw new Error("Cannot extract availability of product");
    }

    const imageUrls = await extractImagesFromProductDetailsPage(page);
    const reviews: "unavailable" | ProductReviews = "unavailable";

    const specifications: Specification[] = [];
    const candidateSpecBlocks = await page.locator(
      "div.flex-col div.product-block"
    );
    const candidateSpecBlocksCount = await candidateSpecBlocks.count();
    for (let i = 0; i < candidateSpecBlocksCount; i++) {
      const candidateSpecBlock = candidateSpecBlocks.nth(i);

      // This is a blank block that seperate the specification blocks and
      // the "delivery and return" blocks. We can stop here.
      const isSeperationBlock =
        (await candidateSpecBlock
          .textContent()
          .then((text) => text?.trim().length)) === 0;
      if (isSeperationBlock) {
        break;
      }

      const specBlockTitle = await candidateSpecBlock
        .locator("button")
        .textContent();
      const specBlock = candidateSpecBlock;
      const specContent = await specBlock
        .locator(".collapsible-content__inner")
        .textContent()
        .then((text) => text?.trim());

      if (specContent) {
        const individualSpecs = specContent.split("\n").map((row) => {
          const [key, value] = row.split(":");
          return {
            key: key.trim(),
            value: value.trim(),
          };
        });
        individualSpecs.forEach((spec) => {
          specifications.push(spec);
        });
      }
    }

    const productInfo = {
      brand,
      name: productName,
      description,
      url: page.url(),
      price: price,
      currency: "SEK",
      isDiscounted,
      originalPrice,

      gtin,
      sku,

      availability,
      images: imageUrls,
      reviews,
      specifications, // TODO
      // categoryTree: [], // this will be replaced later
      metadata: { schemaOrg },
    };

    return productInfo;
  }

  static async create(
    launchOptions?: CrawlerLaunchOptions
  ): Promise<BernoMoblerCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets();

    return new BernoMoblerCrawlerDefinition({
      detailsDataset,
      listingDataset,
      productCardSelector: "main div.grid article",
      detailsUrlSelector: "main div.grid article a",
      listingUrlSelector: "div.pagination span.next a",
      // cookieConsentSelector: "",
      dynamicProductCardLoading: false,
      launchOptions,
    });
  }
}
async function extractPricesFromProductDetailsPage(
  page: Page
): Promise<[number, number?]> {
  const allPriceTexts = await page
    .locator("div.product-block--price span")
    .allTextContents();
  if (!allPriceTexts || allPriceTexts.length === 0) {
    throw new Error("Cannot extract price");
  }
  if (allPriceTexts.length >= 3) {
    throw new Error("Cannot extract price: found too many priceTexts");
  }

  if (allPriceTexts.length === 1) {
    // No discount
    const price = extractPriceFromPriceText(allPriceTexts[0]);
    const originalPrice = undefined;
    return [price, originalPrice];
  } else {
    // allPriceTexts.length === 2 (with discount)
    const prices = allPriceTexts.map((text) => extractPriceFromPriceText(text));
    const price = Math.min(...prices);
    const originalPrice = Math.max(...prices);

    return [price, originalPrice];
  }
}

function extractPriceFromPriceText(priceText: string): number {
  return parseInt(priceText.replace(" ", "").replace("SEK", ""));
}

async function extractImagesFromProductDetailsPage(
  page: Page
): Promise<string[]> {
  const imageUrls: string[] = [];
  const imageLocator = page.locator(
    "div.product__photos div.product-main-slide img"
  );
  const imagesCount = await imageLocator.count();
  for (let i = 0; i < imagesCount; i++) {
    const imgUrl = await imageLocator
      .nth(i)
      .getAttribute("data-photoswipe-src");
    if (!imgUrl) continue;
    if (imgUrl.startsWith("//")) {
      imageUrls.push("https:" + imgUrl);
    }
  }

  return imageUrls;
}
