import { Locator, Page } from "playwright";
import { log, PlaywrightCrawlingContext } from "crawlee";

import {
  AbstractCrawlerDefinition,
  CrawlerDefinitionOptions,
} from "../abstract";
import { extractRootUrl } from "../../utils";
import {
  DetailedProductInfo,
  ListingProductInfo,
  OfferMetadata,
  Specification,
} from "../../types/offer";

export class BygghemmaCrawlerDefinition extends AbstractCrawlerDefinition {
  constructor(options: CrawlerDefinitionOptions) {
    super(options);

    const crawlerDefinition = this;
    this._router.addHandler("VARIANT", (_) =>
      crawlerDefinition.crawlVariant(_)
    );
  }

  async prepareHeadlessScreen(ctx: PlaywrightCrawlingContext) {
    // Imitate a vertical screen resolution to fit more elements in the viewport.
    // This helps with some inconsistency when elements are dynamically loaded.
    await ctx.page.setViewportSize({ width: 1200, height: 1600 });
    await ctx.page.evaluate(() => window.scrollTo(0, 500)); // to have the thumbnails in viewport
  }

  /**
   * Need to override this so that since 1 product may have multiple colour variants
   * => Multiple products from 1 original url, each has their own GTIN/SKU.
   */
  override async crawlDetailPage(
    ctx: PlaywrightCrawlingContext
  ): Promise<void> {
    await this.prepareHeadlessScreen(ctx);
    await this.handleCookieConsent(ctx.page);
    await BygghemmaCrawlerDefinition.clickOverlayButton(
      ctx.page,
      "div#modal button"
    );

    const productGroupUrl = ctx.page.url();

    console.log("Starting variant exploration... from url: ", productGroupUrl);
    await this.exploreVariantsSpace(ctx, 0, [], productGroupUrl);
  }

  // Copied from this.crawlSingleDetailPage() for quick HACKY Bygghemma solution
  // where you set the variant = 0, 1, 2, ..., and the variant 0 will have
  // its url changed to the productGroupUrl.
  async crawlSingleDetailPage(
    ctx: PlaywrightCrawlingContext,
    productGroupUrl: string,
    variant: number
  ): Promise<void> {
    const productDetails = await this.extractProductDetails(ctx.page);
    const request = ctx.request;

    await this._detailsDataset.pushData(<DetailedProductInfo>{
      fetchedAt: new Date().toISOString(),
      retailerDomain: extractRootUrl(ctx.page.url()),
      ...request.userData,
      ...productDetails,
      productGroupUrl: productGroupUrl,
      variant: variant,
    });
  }

  async selectOptionForParamIndex(
    ctx: PlaywrightCrawlingContext,
    paramIndex: number,
    optionIndex: number
  ) {
    const paramsDropDownSelectors = ctx.page.locator("div.DcdG0");
    const paramsImageSelectors = ctx.page.locator("ul.xr_zG");

    const paramsDropDownSelectorsCount = await paramsDropDownSelectors.count();
    const paramsImageSelectorsCount = await paramsImageSelectors.count();
    if (paramIndex < paramsDropDownSelectorsCount) {
      const currentParamSelector = paramsDropDownSelectors.nth(paramIndex);
      await currentParamSelector.locator("button").click();
      await ctx.page.waitForTimeout(50);
      await currentParamSelector.locator("li").nth(optionIndex).click();
    } else if (
      paramIndex <
      paramsImageSelectorsCount + paramsDropDownSelectorsCount
    ) {
      const currentParamSelector = paramsImageSelectors.nth(
        paramIndex - paramsDropDownSelectorsCount
      );
      await currentParamSelector.locator("li").nth(optionIndex).click();
    }
  }

  async getOptionsForParamIndex(
    ctx: PlaywrightCrawlingContext,
    paramIndex: number
  ): Promise<number> {
    const paramsDropDownSelectors = ctx.page.locator("div.DcdG0");
    const paramsImageSelectors = ctx.page.locator("ul.xr_zG");

    const paramsDropDownSelectorsCount = await paramsDropDownSelectors.count();
    const paramsImageSelectorsCount = await paramsImageSelectors.count();
    if (paramIndex < paramsDropDownSelectorsCount) {
      const currentParamSelector = paramsDropDownSelectors.nth(paramIndex);
      await currentParamSelector.locator("button").click();
      await ctx.page.waitForTimeout(50);
      const optionsCount = await currentParamSelector.locator("li").count();
      await currentParamSelector.locator("button").click();
      return optionsCount;
    } else if (
      paramIndex <
      paramsImageSelectorsCount + paramsDropDownSelectorsCount
    ) {
      const currentParamSelector = paramsImageSelectors.nth(
        paramIndex - paramsDropDownSelectorsCount
      );
      return await currentParamSelector.locator("li").count();
    }
    return 0;
  }

  /**
   * Depth first exploration of the variants space.
   *
   * @param ctx
   * @param parameterIndex
   * @param currentOption
   * @param productGroupUrl
   * @param exploredVariants
   * @param pageState
   */
  async exploreVariantsSpace(
    ctx: PlaywrightCrawlingContext,
    parameterIndex: number,
    currentOption: number[],
    productGroupUrl: string,
    exploredVariants: number = 0,
    pageState: any = undefined
  ): Promise<[any, number]> {
    if (!pageState) {
      pageState = { url: productGroupUrl };
    }

    const optionsCount = await this.getOptionsForParamIndex(
      ctx,
      parameterIndex
    );
    if (optionsCount === 0) {
      let newPageState = {};
      // We only expect state changes for products with variants
      // If we crawl a "variant" but the parameter index is 0 then there are in fact no parameters => no variants
      if (parameterIndex !== 0) {
        pageState = { url: ctx.page.url() };
        newPageState = await this.waitForChanges(ctx, pageState, 10000);

        await ctx.enqueueLinks({
          urls: [ctx.page.url()],
          userData: {
            ...ctx.request.userData,
            variantIndex: exploredVariants,
            productGroupUrl: productGroupUrl,
            label: "VARIANT",
          },
        });
      } else {
        ctx.request.userData = {
          ...ctx.request.userData,
          variantIndex: 0,
          productGroupUrl: productGroupUrl,
        };
        await this.crawlVariant(ctx);
      }

      return [newPageState, 1];
    }

    let exploredSubBranches = 0;
    for (let optionIndex = 0; optionIndex < optionsCount; optionIndex++) {
      await this.selectOptionForParamIndex(ctx, parameterIndex, optionIndex);
      const invalidVariant = await this.checkInvalidVariant(ctx, [
        ...currentOption,
        optionIndex,
      ]);
      if (invalidVariant) {
        // select the state previous to the change
        for (let i = 0; i < currentOption.length; i++) {
          await this.selectOptionForParamIndex(ctx, i, currentOption[i]);
        }
        continue;
      }
      const [newPageState, exploredOnSubBranch] =
        await this.exploreVariantsSpace(
          ctx,
          parameterIndex + 1,
          [...currentOption, optionIndex],
          productGroupUrl,
          exploredVariants,
          pageState
        );
      exploredSubBranches += exploredOnSubBranch;
      exploredVariants += exploredOnSubBranch;
      pageState = newPageState;
    }
    return [pageState, exploredSubBranches];
  }

  async checkInvalidVariant(
    ctx: PlaywrightCrawlingContext,
    currentOption: number[]
  ): Promise<boolean> {
    let invalidVariant = await this.waitForInvalidVariantMessage(ctx);
    if (!invalidVariant) {
      return false;
    }

    for (let i = 0; i < currentOption.length; i++) {
      await this.selectOptionForParamIndex(ctx, i, currentOption[i]);
    }

    return await this.waitForInvalidVariantMessage(ctx);
  }

  /**
   * Select a specific variant.
   *
   * The selection is defined by an array of the length equal to the number of parameters to set.
   * Each element in the array is the index of the option to select for the parameter at the given index.
   *
   * Normally the parameters remain there between different variants. A combination may fail just
   * because it is incompatible with previously selected parameters. In this case we retry the selection one more time
   * after seeing the invalid variant message.
   *
   * @param ctx
   */
  async crawlVariant(ctx: PlaywrightCrawlingContext) {
    await this.prepareHeadlessScreen(ctx);

    const variantIndex = ctx.request.userData.variantIndex;
    const productGroupUrl = ctx.request.userData.productGroupUrl;
    try {
      await this.crawlSingleDetailPage(ctx, productGroupUrl, variantIndex);
    } catch (error) {
      if (error instanceof Error) log.warning(error.message);
      // Ignore this variant and continue to scraper other variances
    }
  }

  /**
   * The logic: wait 1 second after changing the parameters, then wait for network idle, check the url changed
   * then wait again for network idle and one more second
   * @param ctx
   * @param currentState
   * @param timeout
   */
  async waitForChanges(
    ctx: PlaywrightCrawlingContext,
    currentState: any,
    timeout: number = 1000 // ms
  ) {
    log.info("Wait for state to change, current state: ", currentState);
    const startTime = Date.now();

    // Wait for 1 more second just in case
    await ctx.page.waitForTimeout(1000);

    await ctx.page.waitForLoadState("networkidle");

    let newState = {};
    do {
      if (Date.now() - startTime > timeout) {
        // Shouldn't throw error but just return result since it's likely that
        // the image wasn't changed after choosing another option.
        log.warning("Timeout while waiting for state to change");
        return currentState;
      }

      try {
        const newUrl = ctx.page.url();
        newState = {
          url: newUrl,
        };
      } catch (error) {
        // Page changed during image extraction => just try again
      }
      await ctx.page.waitForTimeout(timeout / 10);
    } while (
      !newState ||
      // expect changes in all keys
      Object.keys(newState).some((key) => newState[key] === currentState[key])
    );
    // Wait for network to be idle
    await ctx.page.waitForLoadState("networkidle");

    // Wait for 1 more second just in case
    await ctx.page.waitForTimeout(1000);
    const newUrl = ctx.page.url();
    newState = {
      url: newUrl,
    };
    return newState;
  }

  async waitForInvalidVariantMessage(
    ctx: PlaywrightCrawlingContext
  ): Promise<boolean> {
    const invalidCombination =
      await BygghemmaCrawlerDefinition.clickOverlayButton(ctx.page, ".KAdjw");

    if (invalidCombination) {
      log.info("Invalid combination of parameters");
      return true;
    }
    return false;
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

    const previewImageUrl = await this.extractProperty(
      productCard,
      ".FSL6m > a > div > img",
      (node) => node.getAttribute("src")
    );
    const previewImageUrlCleaned =
      previewImageUrl !== undefined
        ? cleanImageUrl(previewImageUrl)
        : undefined;

    return {
      name: productName,
      url,
      previewImageUrl: previewImageUrlCleaned,
      categoryUrl,
      popularityIndex: -1, // this will be overwritten later
    };
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    log.info(`Looking at product with url ${page.url()}`);
    const productNamePart1 = await this.extractProperty(
      page,
      "h1.mpzBU .ftHHn",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    const productNamePart2 = await this.extractProperty(
      page,
      "h1.mpzBU .Wvkg0",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    if (!productNamePart1 || !productNamePart2)
      throw new Error("Cannot extract productName");

    const productName = productNamePart1 + " " + productNamePart2;

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
    const isDiscounted = !!campaignBannerText?.trim();
    const originalPrice = undefined; // cannot find original price even if on campaign

    const images = await this.extractImages(page);

    const categoryTree = await this.extractCategoryTree(
      page.locator("a.PMDfl"),
      0
    );

    const specKeys = await page
      .locator("div.OeTqb table th")
      .allTextContents()
      .then((textContents) => textContents.map((text) => text.trim()));
    const specVals = await page
      .locator("div.OeTqb table td")
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

    const brand = specifications.find(
      (spec) => spec.key === "Varumärke"
    )?.value;
    const gtin = specifications.find((spec) => spec.key === "EAN-nr")?.value;
    const articleNumber = specifications.find(
      (spec) => spec.key === "Art.Nr."
    )?.value;

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
      specifications: specifications,
      metadata,
    };
  }

  async extractImages(page: Page): Promise<string[]> {
    const images = [];

    // Extract main image:
    if (images.length === 0) {
      const imgUrl = await page.locator("img.eNbZA").getAttribute("src");
      if (imgUrl) {
        images.push(cleanImageUrl(imgUrl));
      }
    }

    // Try to take thumbnail images:
    try {
      await page.waitForSelector("div.h2Ciw:first-child img.vGPfg", {
        timeout: 5000,
      });
    } catch (error) {
      // No thumbnails found, just return the main image
      return images;
    }

    // await page.waitForLoadState("networkidle");
    const thumbnailImagesSelector = page.locator("img.vGPfg");
    const thumbnailImagesCount = await thumbnailImagesSelector.count();
    for (let i = 0; i < thumbnailImagesCount; i++) {
      const imgUrl = await thumbnailImagesSelector
        .nth(i)
        .getAttribute("src", { timeout: 500 });
      if (imgUrl) {
        images.push(cleanImageUrl(imgUrl));
      }
    }

    return [...new Set(images)]; // deduplicate
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
