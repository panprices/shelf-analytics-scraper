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

    const availability = "in_stock"; // always in stock
    const sku = (await page
      .locator("div[itemprop='sku']")
      .textContent())!.trim();
    const metadata = undefined;
    const specifications: Specification[] = [];

    return {
      brand,
      name: productName,
      description,
      price,
      originalPrice,
      currency: "SEK",
      images,
      categoryTree: [], // this will be replaced later by value from when we scrape category
      sku,
      metadata,
      specifications,
      isDiscounted,
      url: page.url(),
      reviews: "unavailable",
      availability,
    };
  }

  async extractBrandFromProductDetailsPage(page: Page) {
    // https://www.nordiskarum.se/media/attribute/swatch/c/o/cottage-home.jpg
    // => cottage-home
    const brandImageUrl = await page
      .locator("img[alt='brand']")
      .getAttribute("src");
    if (!brandImageUrl) {
      return undefined;
    }
    const tokens = brandImageUrl!.split("/");
    const brand = tokens[tokens.length - 1]
      .replace(".jpg", "")
      .replace("png", "")
      .replace("webp", "");
    return brand;
  }

  async extractProductImagesFromProductDetailsPage(
    page: Page
  ): Promise<string[]> {
    const images: string[] = [];
    const imageLocator = page.locator("div.fotorama__stage__frame img");

    const extractProductImagesOnPage = async (imageLocator: Locator) => {
      const images: string[] = [];
      const imageCount = await imageLocator.count();
      // Only extract up to the 4th image since we frequently get errors from
      // images 5 and 6, which are also unnecessary.
      const maxImagesToGrab = Math.min(imageCount, 4);
      for (let i = 0; i < maxImagesToGrab; i++) {
        const imageUrl = await imageLocator.nth(i).getAttribute("src");
        if (imageUrl) {
          images.push(imageUrl);
        }
      }
      return images;
    };

    const thumbnailsLocator = page.locator("div.fotorama__nav__shaft img");
    const thumbnailsCount = await thumbnailsLocator.count();

    if (thumbnailsCount == 0) {
      log.debug("No thumbnails found, product only have 1 image!");
      const images = await extractProductImagesOnPage(imageLocator);
      const imagesDeduplicated = [...new Set(images)];
      return imagesDeduplicated;
    }

    // NOTE: Not all images are present in the HTML at the same time.
    // Therefore we try to
    // (1) grab all product images on page and
    // (2) click button to cycle to the next image, and repeat (1)
    for (let i = 0; i < thumbnailsCount; i++) {
      const foundImages = await extractProductImagesOnPage(imageLocator);
      images.push(...foundImages);

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

    // Need to scrape category tree here since we can't do that in Product Page.
    // See docs/ folder for more details.
    const categoryTree = await this.extractCategoryTreeOfCategorypage(
      productCard.page()
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
      categoryTree,
    };
    // console.log(currentProductInfo);

    return currentProductInfo;
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

    console.log(categoryTree);
    return categoryTree;
  }

  static async create(): Promise<NordiskaRumCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets();

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
      if (allImgUrls.every((url) => url.includes("http"))) {
        break;
      }
    }

    await super.scrollToBottom(ctx);
  }
}
