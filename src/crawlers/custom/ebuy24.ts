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

export class Ebuy24CrawlerDefinition extends AbstractCrawlerDefinition {
  override listingUrlSelector = "ul.pagination.small li:last-child a[href]";

  override async crawlListPage(ctx: PlaywrightCrawlingContext): Promise<void> {
    if (!this.productCardSelector) {
      throw new Error("productCardSelector not defined");
    }
    await ctx.page.locator(this.productCardSelector).nth(0).waitFor();

    await this.scrollToBottom(ctx);
    await this.registerProductCards(ctx);

    // if ((await ctx.page.locator(this.listingUrlSelector).count()) === 0) {
    //   // Only 1 page => just scrape it
    //   await this.scrollToBottom(ctx);
    //   return;
    // }

    // // Have pagination => click and scrape each page
    // let [previousPageUrl, currentPageUrl] = ["", ctx.page.url()];
    // while (currentPageUrl !== previousPageUrl) {
    //   await ctx.page.locator(this.listingUrlSelector).click({ timeout: 5000 });

    //   await ctx.page.waitForTimeout(3000);
    //   await this.scrollToBottom(ctx);

    //   previousPageUrl = currentPageUrl;
    //   currentPageUrl = ctx.page.url();
    // }

    // Scrape next pages if exist:
    while ((await ctx.page.locator(this.listingUrlSelector).count()) > 0) {
      await ctx.page.locator(this.listingUrlSelector).click({ timeout: 5000 });

      await ctx.page.waitForTimeout(3000);
      await ctx.page.waitForLoadState("networkidle");
      await this.scrollToBottom(ctx);
      await this.registerProductCards(ctx);
    }
  }

  async extractCardProductInfo(
    categoryUrl: string,
    productCard: Locator
  ): Promise<ListingProductInfo> {
    await productCard
      .locator(".m-productlist-title")
      .waitFor({ state: "attached", timeout: 5000 });

    const productName = await this.extractProperty(
      productCard,
      ".m-productlist-title",
      (node) => node.textContent()
    ).then((text) => text?.trim());

    if (!productName) throw new Error("Cannot find productName of productCard");

    const url = await this.extractProperty(
      productCard,
      "header a:first-child",
      (node) => node.getAttribute("href")
    );
    if (!url) throw new Error("Cannot find url of productCard");

    const currentProductInfo: ListingProductInfo = {
      name: productName,
      url,
      categoryUrl,
    };

    return currentProductInfo;
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    const productNameSelector = "h1.m-product-title";
    await page.waitForSelector(productNameSelector, { timeout: 5000 });

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
      "div.m-product-additional-info div.description",
      (node) => node.textContent()
    ).then((text) => text?.trim());

    const priceText = await this.extractProperty(
      page,
      ".m-product-price",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    if (!priceText) {
      throw new Error("Cannot extract price");
    }
    const [price, currency] = extractPriceAndCurrencyFromPriceText(priceText);

    const originalPriceText = await this.extractProperty(
      page,
      ".m-product-price-before-discount",
      (node) => node.textContent()
    ).then((text) => text?.trim());

    const originalPrice = originalPriceText
      ? extractPriceAndCurrencyFromOriginalPriceText(originalPriceText)[0]
      : undefined;
    const isDiscounted = originalPrice !== undefined;

    const specKeys = await page
      .locator("div.m-product-customdata table td.m-product-customdata-title")
      .allTextContents()
      .then((textContents) => textContents.map((text) => text.trim()));
    const specVals = await page
      .locator("div.m-product-customdata table td.m-product-customdata-data")
      .allTextContents()
      .then((textContents) => textContents.map((text) => text.trim()));
    if (specKeys.length !== specVals.length) {
      throw new Error("Number of specification keys and vals mismatch");
    }
    const specifications: Specification[] = [];
    for (let i = 0; i < specKeys.length; i++) {
      specifications.push({
        key: specKeys[i],
        value: specVals[i],
      });
    }

    const gtin = specifications.find(
      (spec) => spec.key === "EAN-nummer"
    )?.value;
    const sku = await this.extractProperty(
      page,
      ".m-product-itemNumber-value",
      (node) => node.textContent()
    ).then((text) => {
      if (!text || text.indexOf("-") === -1) {
        return undefined;
      }
      return text.trim().split("-").slice(1).join("-");
    });

    const reviews = "unavailable";

    const availabilityHref = await this.extractProperty(
      page,
      "link[itemprop='availability']",
      (node) => node.getAttribute("href")
    );
    if (!availabilityHref) {
      throw new Error("Cannot extract availability");
    }
    const availability = availabilityHref.includes("schema.org/InStock")
      ? "in_stock"
      : "out_of_stock";

    const images = await extractImagesFromProductDetailsPage(page);

    const categoryTree = await this.extractCategoryTree(
      page.locator("div.m-breadcrumb a"),
      1
    );
    categoryTree.pop(); // last category breadcrum is the product itself

    const metadata = undefined;

    return {
      // brand,
      name: productName,
      description,
      url: page.url(),
      price,
      currency,
      isDiscounted,
      originalPrice,

      gtin,
      sku,
      mpn: sku,

      availability,
      images,
      reviews,
      specifications,
      categoryTree,
      metadata,
    };
  }

  static async create(
    launchOptions?: CrawlerLaunchOptions
  ): Promise<Ebuy24CrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets();

    return new Ebuy24CrawlerDefinition({
      detailsDataset,
      listingDataset,
      listingUrlSelector: "ul.pagination.small li:last-child a[href]",

      detailsUrlSelector:
        "div.row > div.m-productlist-list-item article header a:first-child",
      productCardSelector: "div.row > div.m-productlist-list-item article",
      // cookieConsentSelector: "",
      dynamicProductCardLoading: false,
      launchOptions,
    });
  }
}

/**  2.789,00 DKK -> [2789, "DKK"] **/
function extractPriceAndCurrencyFromPriceText(priceText: string): any[] {
  const price = parseInt(
    priceText.trim().split(" ")[0].replaceAll(".", "").replaceAll(",", ".")
  );
  const currency = priceText.trim().split(" ")[1];

  return [price, currency];
}

/** "Før 2.789,00 DKK" -> [2789, "DKK"] **/
function extractPriceAndCurrencyFromOriginalPriceText(
  priceText: string
): any[] {
  return extractPriceAndCurrencyFromPriceText(
    priceText.replace("Før", "").trim()
  );
}

async function extractImagesFromProductDetailsPage(
  page: Page
): Promise<string[]> {
  const imageUrls = [];
  const thumbnailsLocator = page.locator("ul.thumbelina img");
  const thumbnailsCount = await thumbnailsLocator.count();

  for (let i = 0; i < thumbnailsCount; i++) {
    const imgUrl = await thumbnailsLocator.nth(i).getAttribute("src");
    if (imgUrl) {
      // "https://shop14872.sfstatic.io/upload_dir/shop/_thumbs/11-0000094071_2.w60.h60.crop.jpg"
      // => "https://shop14872.sfstatic.io/upload_dir/shop/11-0000094071_2.jpg"
      const imgUrlCleaned = imgUrl
        .replace(".w60.h60.crop", "")
        .replace("/_thumbs", "");

      imageUrls.push(imgUrlCleaned);
    }
  }

  return imageUrls;
}
