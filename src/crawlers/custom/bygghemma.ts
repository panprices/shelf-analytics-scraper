import { Locator, Page } from "playwright";
import { log, PlaywrightCrawlingContext } from "crawlee";

import { AbstractCrawlerDefinition } from "../abstract";
import { extractRootUrl } from "../../utils";
import {
  DetailedProductInfo,
  ListingProductInfo,
  OfferMetadata,
  SchemaOrg,
  Specification,
} from "../../types/offer";
import _ from "lodash";

export class BygghemmaCrawlerDefinition extends AbstractCrawlerDefinition {
  /**
   * Need to override this so that since 1 product may have multiple colour variants
   * => Multiple products from 1 original url, each has their own GTIN/SKU.
   */
  override async crawlDetailPage(
    ctx: PlaywrightCrawlingContext
  ): Promise<void> {
    const productGroupUrl = ctx.page.url();
    let variantCounter = 0;

    const chooseColorButtons = ctx.page.locator("ul.xr_zG li");
    const chooseColorButtonsCount = await chooseColorButtons.count();

    const chooseTypeDropdownButton = ctx.page.locator("div.DcdG0 button");
    const selectableOptions = ctx.page.locator("div.DcdG0 li:not(.WYoRt)");

    let currentImages;
    if (chooseColorButtonsCount == 0) {
      if ((await chooseTypeDropdownButton.count()) === 0) {
        await this.crawlSingleDetailPage(ctx, productGroupUrl, variantCounter);
        variantCounter++;
      } else {
        currentImages = await this.extractImages(ctx.page);
        variantCounter = await this.chooseDropdownOptionAndCrawlDetailpage(
          ctx,
          chooseTypeDropdownButton,
          selectableOptions,
          currentImages,
          productGroupUrl,
          variantCounter
        );
      }
    } else {
      currentImages = await this.extractImages(ctx.page);
      // console.log(currentImages);

      for (let i = 0; i < chooseColorButtonsCount; i++) {
        const colorButton = chooseColorButtons.nth(i);
        await colorButton.click();
        await ctx.page.waitForTimeout(1000);

        if ((await chooseTypeDropdownButton.count()) === 0) {
          try {
            currentImages = await this.waitForChanges(ctx, currentImages);
            await this.crawlSingleDetailPage(
              ctx,
              productGroupUrl,
              variantCounter
            );
            variantCounter++;
          } catch (error) {
            // Ignore this product variant and continue to scrape others
            if (error instanceof Error) log.warning(error.message);
          }
        } else {
          variantCounter = await this.chooseDropdownOptionAndCrawlDetailpage(
            ctx,
            chooseTypeDropdownButton,
            selectableOptions,
            currentImages,
            productGroupUrl,
            variantCounter
          );
        }
      }
    }
  }

  async chooseDropdownOptionAndCrawlDetailpage(
    ctx: PlaywrightCrawlingContext,
    chooseTypeDropdownButton: Locator,
    selectableOptions: Locator,
    currentImages: string[],
    productGroupUrl: any,
    variantCounter: number
  ): Promise<number> {
    await chooseTypeDropdownButton.click();
    await ctx.page.waitForTimeout(1000);
    const selectableOptionsCount = await selectableOptions.count();
    await chooseTypeDropdownButton.click(); // close the dropdown so it doesn't interfere with clicking
    await ctx.page.waitForTimeout(1000);
    // console.log("Types: ", selectableOptionsCount);

    for (let j = 0; j < selectableOptionsCount; j++) {
      await chooseTypeDropdownButton.click();
      await ctx.page.waitForTimeout(1000);
      const optionButton = selectableOptions.nth(j);
      await optionButton.click();
      await ctx.page.waitForTimeout(1000);

      try {
        currentImages = await this.waitForChanges(ctx, currentImages);
        await this.crawlSingleDetailPage(ctx, productGroupUrl, variantCounter);
        variantCounter++;
      } catch (error) {
        if (error instanceof Error) log.warning(error.message);
        // Ignore this variant and continue to scraper other variances
      }
    }
    return variantCounter;
  }

  // Copied from this.crawlSingleDetailPage() for quick HACKY Bygghemma solution
  async crawlSingleDetailPage(
    ctx: PlaywrightCrawlingContext,
    productgroupUrl: string,
    variant: number
  ): Promise<void> {
    log.info(`Looking at product with url ${ctx.page.url()}`);
    const productDetails = await this.extractProductDetails(ctx.page);
    const request = ctx.request;

    await this._detailsDataset.pushData(<DetailedProductInfo>{
      fetchedAt: new Date().toISOString(),
      retailerDomain: extractRootUrl(ctx.page.url()),
      ...request.userData,
      ...productDetails,
      productGroupUrl: productgroupUrl,
      variant: variant,
    });
  }

  async waitForChanges(
    ctx: PlaywrightCrawlingContext,
    currentImages: string[],
    timeout: number = 1000 // ms
  ) {
    log.info("Wait for images to change...");
    const startTime = Date.now();

    let newImages;
    do {
      if (Date.now() - startTime > timeout) {
        // Shouldn't throw error but just return result since it's likely that
        // the image wasn't changed after choosing another option.
        return currentImages;
      }

      // newImages = await this.extractImages(ctx.page);
      try {
        newImages = await this.extractImages(ctx.page);
      } catch (error) {
        // Page changed during image extraction => just try again
      }
    } while (
      !newImages ||
      JSON.stringify(newImages) === JSON.stringify(currentImages)
    );
    // console.log(currentImages);

    console.log(currentImages.length, newImages.length);
    console.log(currentImages);
    console.log(newImages);

    return newImages;
  }

  async extractCardProductInfo(
    categoryUrl: string,
    productCard: Locator
  ): Promise<ListingProductInfo> {
    const productName = await this.extractProperty(
      productCard,
      "p.tBjFV",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    if (!productName)
      throw new Error("Cannot find 'productName' of productCard");

    const url = await this.extractProperty(
      productCard,
      "div.FSL6m > a",
      (node) => node.getAttribute("href")
    );
    if (!url) throw new Error("Cannot find 'url' of productCard");

    const priceString = await this.extractProperty(
      productCard,
      "span.YwyJA > span",
      (node) => node.first().textContent()
    );
    if (!priceString) throw new Error("Cannot find 'price' of productCard");
    const price = parseInt(priceString.replace(" ", ""));

    const campaignBannerText = await this.extractProperty(
      productCard,
      "p.qtaRX",
      (node) => node.textContent()
    );
    const isDiscounted = campaignBannerText ? true : false;

    const previewImageUrl = await this.extractProperty(
      productCard,
      ".FSL6m > a > div > img",
      (node) => node.getAttribute("src")
    );
    if (!previewImageUrl)
      throw new Error("Cannot find 'previewImageUrl' of productCard");
    const previewImageUrlCleaned = cleanImageUrl(previewImageUrl);

    const productInfo: ListingProductInfo = {
      name: productName,
      url,
      price,
      currency: "SEK",
      isDiscounted,
      previewImageUrl: previewImageUrlCleaned,
      categoryUrl,
      popularityIndex: -1, // this will be overwritten later
    };
    return productInfo;
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    const productName = await this.extractProperty(page, "h1.mpzBU", (node) =>
      node.textContent()
    ).then((text) => text?.trim());
    if (!productName) throw new Error("Cannot extract productName");

    const description = await this.extractProperty(
      page,
      "div._VQkc div.SonMi div.SonMi",
      (node) => node.first().textContent()
    ).then((text) => text?.trim());

    const priceString = await this.extractProperty(
      page,
      "div.gZqc6 div:first-child",
      (node) => node.textContent()
    );
    if (!priceString) throw new Error("Cannot extract priceString");
    const price = parsePrice(priceString);

    const campaignBannerText = await this.extractProperty(
      page,
      "div.gZqc6 div:last-child",
      (node) => node.textContent()
    );
    const isDiscounted = campaignBannerText?.trim() ? true : false;
    const originalPrice = undefined; // cannot find original price even if on campaign

    const images = await this.extractImages(page);

    const categoryTree = await this.extractCategoryTree(
      page.locator("a.PMDfl"),
      0
    );

    const specKeys = await page.locator("div.OeTqb table th").allTextContents();
    const specVals = await page.locator("div.OeTqb table td").allTextContents();
    if (specKeys.length !== specVals.length) {
      throw new Error("Number of specification keys and vals mismatch");
    }
    const specs: Specification[] = [];
    for (let i = 0; i < specKeys.length; i++) {
      specs.push({
        key: specKeys[i],
        value: specVals[i],
      });
    }

    const brand = specs
      .find((spec) => spec.key.trim() === "Varumärke")
      ?.value.trim();
    const gtin = specs
      .find((spec) => spec.key.trim() === "EAN-nr")
      ?.value.trim();
    const articleNumber = specs
      .find((spec) => spec.key.trim() === "Art.Nr.")
      ?.value.trim();

    const metadata: OfferMetadata = {};
    const schemaOrgString = await page
      .locator(
        "//script[@type='application/ld+json' and contains(text(), 'schema.org') and contains(text(), 'Product')]"
      )
      .textContent();
    if (!schemaOrgString) throw new Error("Cannot extract schema.org data");
    const schemaOrg = JSON.parse(schemaOrgString);
    metadata.schemaOrg = schemaOrg;

    let availability;
    try {
      availability = schemaOrg.offers.availability.includes("InStock")
        ? "in_stock"
        : "out_of_stock";
    } catch (error) {
      throw new Error("Cannot extract availability of product");
    }

    const reviews = "unavailable";

    return {
      url: page.url(),
      brand,
      name: productName,
      images,
      description,
      price,
      isDiscounted,
      originalPrice,
      currency: "SEK",
      categoryTree,
      gtin,
      sku: articleNumber,
      articleNumber,
      availability,
      reviews,
      specifications: specs,
      metadata,
    };
  }

  async extractImages(page: Page): Promise<string[]> {
    const images = [];

    // Take thumbnail images:
    const thumbnailImagesSelector = page.locator("img.vGPfg");
    let hasThumbnails;
    try {
      await thumbnailImagesSelector.nth(0).waitFor({ timeout: 2000 });
      hasThumbnails = true;
    } catch {
      hasThumbnails = false;
    }

    if (hasThumbnails) {
      const imagesCount = await thumbnailImagesSelector.count();
      for (let i = 0; i < imagesCount; i++) {
        const imgUrl = await thumbnailImagesSelector
          .nth(i)
          .getAttribute("src", { timeout: 200 });
        if (imgUrl) {
          images.push(cleanImageUrl(imgUrl));
        }
      }
    } else {
      // No thumbnail images found => product only have 1 image => take it
      if (images.length === 0) {
        const imgUrl = await page.locator("img.eNbZA").getAttribute("src");
        if (imgUrl) {
          images.push(cleanImageUrl(imgUrl));
        }
      }
    }

    return images;
  }

  static async create(): Promise<BygghemmaCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets();

    return new BygghemmaCrawlerDefinition({
      detailsDataset,
      listingDataset,
      /*
      - For a leaf category, pressing the "next" button will go to the next page using JS. But the a.href points to the next page of the 2nd-to-last category instead.
      For example, see [this page](https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matbord-och-koksbord/?page=2) and search for `div.WfGIO a`.
      However, there is a <link data-page rel='next' href='...'> that point to the correct next page. We use that instead.
      */
      listingUrlSelector: "link[rel='next']",
      detailsUrlSelector: "div.xqHsK >div.FSL6m > a",
      productCardSelector: "main div.xqHsK",
      cookieConsentSelector: "button#ccc-notify-accept",
      dynamicProductCardLoading: false,
    });
  }
}

/* Remove auto formatter as query parameters */
const cleanImageUrl = (imgUrl: string): string => {
  let cleaned = imgUrl.split("?")[0];
  if (cleaned.startsWith("//")) {
    cleaned = "https:" + cleaned;
  }

  return cleaned;
};

const parsePrice = (priceString: string): number => {
  // "fr.1 455 kr" | "1 455 kr" => 1455
  const cleaned = priceString
    .replace("fr.", "")
    .replace("kr", "")
    .replace(" ", "");
  return parseInt(cleaned);
};
