import { Locator, Page } from "playwright";
import {
  browserCrawlerEnqueueLinks,
  Dataset,
  log,
  PlaywrightCrawlingContext,
} from "crawlee";
import { AbstractCrawlerDefinition } from "../abstract";
import {
  DetailedProductInfo,
  IndividualReview,
  ListingProductInfo,
  OfferMetadata,
  ProductReviews,
  SchemaOrg,
} from "../../types/offer";

export class NordiskaRumCrawlerDefinition extends AbstractCrawlerDefinition {
  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    const productName = (await page
      .locator("h1.page-title")
      .textContent())!.trim();
    const description = (await page
      .locator("div[itemprop='description']")
      .textContent())!.trim();

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

    // TODO: HOW DO I CLICK THE ARROW FOR IT TO LOAD THE NEXT IMAGE???
    const imageThumbnailCount = await page.locator("div.fotorama__nav__shaft img").count();
    const clickNextImage = () => {page.locator()}
    Array(imageThumbnailCount).forEach(() => {
      page.
    })
    const images = await page.locator("div.fotorama__stage img").

    const stock = ...;
    const 

    // return {
    //   // brand:,
    //   name: productName,
    //   description: ,
    //   price,
    //   currency: "SEK",
    //   //     images,
    //   //     categoryTree,
    //   //     sku,
    //   //     metadata,
    //   //     specifications: specArray,
    //   //     isDiscounted,
    //   //     url: page.url(),
    //   //     reviews: "unavailable",
    //   //     inStock,
    // };
    return {};
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
