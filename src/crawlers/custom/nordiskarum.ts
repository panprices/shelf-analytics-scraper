import { Locator, Page } from "playwright";
import {
  browserCrawlerEnqueueLinks,
  Dataset,
  log,
  PlaywrightCrawlingContext,
} from "crawlee";
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

export class NordiskaRumCrawlerDefinition extends AbstractCrawlerDefinition {
  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    // Wait for images
    await page.waitForSelector("div.fotorama__stage img");
    await page.waitForTimeout(100);

    const brand = await this.extractBrandFromProductDetailsPage(page);
    // const productName = (await page
    //   .locator("h1.page-title")
    //   .textContent())!.trim();
    const productName = await this.extractProperty(
      page,
      "h1.page-title",
      (node) => node.textContent()
    ).then((text) => text!.trim());
    const description = await this.extractProperty(
      page,
      "div[itemprop='description']",
      (node) => node.textContent()
    ).then((text) => text!.trim());

    const allPricesLocators = await page.locator(
      ".product-info-price span.price-wrapper"
    );
    const nrPriceLocators = await allPricesLocators.count();
    const allPrices = [];
    for (let i = 0; i < nrPriceLocators; i++) {
      const priceString =
        (await allPricesLocators.nth(i).getAttribute("data-price-amount")) ||
        "";
      allPrices.push(parseInt(priceString));
    }
    const isDiscounted = allPrices.length === 2;
    const price = Math.min(...allPrices);
    const originalPrice = isDiscounted ? Math.max(...allPrices) : undefined;

    const images = await this.extractProductImagesFromProductDetailsPage(page);

    const categoryTree: Category[] = [];
    const inStock = true; // always in stock
    const sku = (await page
      .locator("div[itemprop='sku']")
      .textContent())!.trim();
    const metadata = undefined;
    const specifications: Specification[] = [];

    return {
      // brand:,
      name: productName,
      description,
      price,
      currency: "SEK",
      images,
      categoryTree,
      sku,
      metadata,
      specifications,
      isDiscounted,
      url: page.url(),
      reviews: "unavailable",
      inStock,
    };
  }

  async extractBrandFromProductDetailsPage(page: Page) {
    // https://www.nordiskarum.se/media/attribute/swatch/c/o/cottage-home.jpg
    // => cottage-home
    const brandImageUrl = await page
      .locator("img[alt='brand']")
      .getAttribute("src");
    if (!brandImageUrl) {
      return null;
    }
    const tokens = brandImageUrl!.split("/");
    const brand = tokens[tokens.length - 1]
      .replace(".jpg", "")
      .replace("png", "")
      .replace("webp", "");
    return brand;
  }

  async extractProductImagesFromProductDetailsPage(page: Page) {
    const thumbnailsLocator = page.locator("div.fotorama__nav__shaft img");
    const thumbnailsCount = await thumbnailsLocator.count();

    const images: string[] = [];
    const imagesSelector = page.locator("div.fotorama__stage__frame img");
    for (let i = 0; i < thumbnailsCount; i++) {
      const imageCount = await imagesSelector.count();
      // Only extract up to the 4th image since we frequently get errors from
      // images 5 and 6, which are also unnecessary.
      const maxImagesToGrab = Math.min(imageCount, 4);
      for (let i = 0; i < maxImagesToGrab; i++) {
        const imageUrl = await imagesSelector
          .nth(i)
          .getAttribute("src")
          .then((url) => url!);
        images.push(imageUrl);
      }

      // Click button to open next image
      const nextImageButton = page.locator("div.fotorama__arr--next");
      // Use force: true to prevent error: "subtree intercepts pointer events"
      await nextImageButton.click({ force: true });
      await page.waitForTimeout(1500); // to make sure images has been loaded
    }

    const imagesDeduplicated = [...new Set(images)];

    if (imagesDeduplicated.length !== thumbnailsCount) {
      log.error("Number of images and number of thumbnails mismatch", {
        imagesCount: imagesDeduplicated.length,
        thumbnailsCount: thumbnailsCount,
      });
    }
    return imagesDeduplicated;
  }

  async extractCardProductInfo(
    categoryUrl: string,
    productCard: Locator
  ): Promise<ListingProductInfo> {
    // productCard.page().waitForFunction(() => {
    //   return window.innerHeight > 100;
    // });

    const productName = (await productCard
      .locator(".product-item-name")
      .textContent())!.trim();
    const url = <string>(
      await productCard
        .locator(".product-item-photo > a")
        .nth(0)
        .getAttribute("href")
    );

    const allPricesLocators = await productCard.locator("span.price-wrapper");
    const nrPriceLocators = await allPricesLocators.count();
    const allPrices = [];
    for (let i = 0; i < nrPriceLocators; i++) {
      const priceString =
        (await allPricesLocators.nth(i).getAttribute("data-price-amount")) ||
        "";
      allPrices.push(parseInt(priceString));
    }
    const isDiscounted = allPrices.length === 2;
    const price = Math.min(...allPrices);
    const originalPrice = isDiscounted ? Math.max(...allPrices) : undefined;

    const previewImageUrl = <string>(
      await productCard.locator(".product-item-photo img").getAttribute("src")
    );

    const currentProductInfo: ListingProductInfo = {
      //   brand,
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
    // console.log(currentProductInfo);

    return currentProductInfo;
  }

  static async create(): Promise<NordiskaRumCrawlerDefinition> {
    const detailsDataset = await Dataset.open(
      "__CRAWLEE_TEMPORARY_detailsDataset"
    );
    const listingDataset = await Dataset.open(
      "__CRAWLEE_TEMPORARY_listingDataset"
    );

    return new NordiskaRumCrawlerDefinition({
      detailsDataset,
      listingDataset,
      listingUrlSelector: "a.next",
      detailsUrlSelector: "div.product-item-photo a",
      productCardSelector: "li.product-item",
      cookieConsentSelector: "a.cta-ok",
    });
  }

  override async scrollToBottom(ctx: PlaywrightCrawlingContext): Promise<void> {
    // Scroll to bottom once:
    const page = ctx.page;
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise((f) => setTimeout(f, 100));

    // Wait for all image src to change
    // from "data:image/png;base64..."" -> "https://..."
    const waitTimeLimitMs = 2000; // avoid infinite loop
    const startWaitTime = Date.now();
    while (Date.now() - startWaitTime < waitTimeLimitMs) {
      let allImgUrls: string[] = [];

      const nrProductCards = await page
        .locator(this.productCardSelector)
        .count();
      for (let i = 0; i < nrProductCards; i++) {
        allImgUrls.push(
          (await page
            .locator(this.productCardSelector)
            .nth(i)
            .locator(".product-item-photo > a")
            .nth(0)
            .getAttribute("href")) || ""
        );
      }
      console.log(allImgUrls.length);
      console.log(allImgUrls);
      if (allImgUrls.every((url) => url.includes("http"))) {
        break;
      }
    }

    await super.scrollToBottom(ctx);
  }
}
