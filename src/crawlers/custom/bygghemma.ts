import { Locator, Page } from "playwright";
import { Dictionary, log, PlaywrightCrawlingContext } from "crawlee";

import {
  AbstractCrawlerDefinition,
  AbstractCrawlerDefinitionWithVariants,
  CrawlerLaunchOptions,
} from "../abstract";
import {
  DetailedProductInfo,
  ListingProductInfo,
  OfferMetadata,
  Specification,
} from "../../types/offer";
import { PageNotFoundError } from "../../types/errors";

export class BygghemmaCrawlerDefinition extends AbstractCrawlerDefinitionWithVariants {
  async prepareHeadlessScreen(ctx: PlaywrightCrawlingContext) {
    // Imitate a vertical screen resolution to fit more elements in the viewport.
    // This helps with some inconsistency when elements are dynamically loaded.
    await ctx.page.setViewportSize({ width: 1200, height: 1600 });
    await ctx.page.evaluate(() => window.scrollTo(0, 500)); // to have the thumbnails in viewport
  }

  override async handleCookieConsent(page: Page): Promise<void> {
    await super.handleCookieConsent(page);
    await BygghemmaCrawlerDefinition.clickOverlayButton(
      page,
      "div#modal button"
    );
  }

  /**
   * Need to override this so that since 1 product may have multiple colour variants
   * => Multiple products from 1 original url, each has their own GTIN/SKU.
   */
  override async crawlDetailPage(
    ctx: PlaywrightCrawlingContext
  ): Promise<void> {
    await this.prepareHeadlessScreen(ctx);
    await super.crawlDetailPage(ctx);
  }

  override async selectOptionForParamIndex(
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

  override async hasSelectedOptionForParamIndex(
    ctx: PlaywrightCrawlingContext,
    paramIndex: number
  ): Promise<boolean> {
    const paramsDropDownSelectors = ctx.page.locator("div.DcdG0");
    const paramsImageSelectors = ctx.page.locator("ul.xr_zG");

    const paramsDropDownSelectorsCount = await paramsDropDownSelectors.count();
    const paramsImageSelectorsCount = await paramsImageSelectors.count();
    if (paramIndex < paramsDropDownSelectorsCount) {
      const currentParamSelector = paramsDropDownSelectors.nth(paramIndex);
      await currentParamSelector.locator("button").click();
      await ctx.page.waitForTimeout(50);
      const hasSelectedOption =
        (await currentParamSelector.locator("li.Hq9Iz").count()) > 0;
      await currentParamSelector.locator("button").click();
      return hasSelectedOption;
    } else if (
      paramIndex <
      paramsImageSelectorsCount + paramsDropDownSelectorsCount
    ) {
      const currentParamSelector = paramsImageSelectors.nth(
        paramIndex - paramsDropDownSelectorsCount
      );
      return (await currentParamSelector.locator("li.qC64r").count()) > 0;
    }
    return false;
  }

  override async getOptionsCountForParamIndex(
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

  override async checkInvalidVariant(
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

  override async crawlVariant(ctx: PlaywrightCrawlingContext) {
    await this.prepareHeadlessScreen(ctx);
    await super.crawlVariant(ctx);
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
    const url = await this.extractProperty(
      productCard,
      "div.FSL6m > a",
      (node) => node.getAttribute("href")
    );
    if (!url) throw new Error("Cannot find 'url' of productCard");

    const categoryTree = await this.extractCategoryTree(
      productCard.page().locator("a.PMDfl"),
      0
    );
    return {
      url,
      categoryUrl,
      popularityCategory: categoryTree,
    };
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    if (!isProductPage(page.url())) {
      throw new PageNotFoundError("Page not found");
    }

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
    if (!productNamePart1 || !productNamePart2) {
      log.warning("Cannot extract productName");
    }

    const productName = productNamePart1 + " " + productNamePart2;

    let description = undefined;
    const descriptionAndSpecDivLocators = await page.locator(
      "div.X9bND div._VQkc"
    );
    const descriptionAndSpecDivCount =
      await descriptionAndSpecDivLocators.count();
    for (let i = 0; i < descriptionAndSpecDivCount; i++) {
      const div = descriptionAndSpecDivLocators.nth(i);
      const heading = await div
        .locator("h3")
        .textContent()
        .then((text) => text?.trim());
      if (heading === "Beskrivning") {
        description = await div
          .locator("> div:nth-child(2)")
          .innerText()
          .then((text) => text?.trim());
      }
    }

    const priceString = await this.extractProperty(
      page,
      "div.gZqc6 div:first-child > span:first-child",
      (node) => node.textContent()
    );
    if (!priceString) throw new Error("Cannot extract priceString");
    const price = parsePrice(priceString);

    const originalPriceString = await this.extractProperty(
      page,
      "div.gZqc6 div:first-child > span:last-child",
      (node) => node.textContent()
    );

    const isDiscounted =
      !!originalPriceString && originalPriceString !== priceString;
    const originalPrice =
      originalPriceString && originalPriceString !== priceString
        ? parsePrice(originalPriceString)
        : undefined;

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
    const brandUrl = await this.extractProperty(
      page,
      "div.SonMi a.kkIWz",
      (node) => node.getAttribute("href")
    );

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

    const reviews = undefined;

    return {
      url: page.url(),
      brand,
      brandUrl,
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
      mpn: articleNumber,
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

  postProcessProductDetails(p: DetailedProductInfo): void {
    p.variantGroupUrl = createVariantGroupUrl(p.url);
  }

  override async crawlIntermediateCategoryPage(
    ctx: PlaywrightCrawlingContext<Dictionary>
  ): Promise<void> {
    const page = ctx.page;
    await this.handleCookieConsent(page);

    const firstLevelNodes = page.locator("div.N3Sg1");
    const firstLevelNodesCount = await firstLevelNodes.count();
    console.log("First level:", firstLevelNodesCount);

    const categoryUrls = [];
    for (let i1 = 0; i1 < firstLevelNodesCount; i1++) {
      const firstLevelNode = firstLevelNodes.nth(i1);
      await firstLevelNode.hover();
      const secondLevelNodes = firstLevelNode.locator("ul.tOsbX li");
      const secondLevelsCount = await secondLevelNodes.count();
      console.log("Second level:", secondLevelsCount);

      for (let i2 = 0; i2 < secondLevelsCount; i2++) {
        const secondLevelNode = secondLevelNodes.nth(i2);
        await secondLevelNode.hover();
        console.log(secondLevelNode);

        // Wait for 3rd level categories to be loaded:
        await page.waitForTimeout(1000);
        // await page.waitForSelector("div.LgNuf div.DR3bk a");
        const thirdLevelNodes = firstLevelNode.locator("div.LgNuf div.DR3bk a");

        const thirdLevelNodesCount = await thirdLevelNodes.count();
        console.log("Third level:", thirdLevelNodesCount);

        await ctx.enqueueLinks({
          selector: "div.N3Sg1 div.LgNuf div.DR3bk a",
          label: "LIST",
        });
      }
    }
  }
  static async create(
    launchOptions: CrawlerLaunchOptions
  ): Promise<BygghemmaCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets(
        launchOptions?.uniqueCrawlerKey
      );

    return new BygghemmaCrawlerDefinition(
      {
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
        launchOptions,
      },
      "same_tab"
    );
  }
}

const isProductPage = (url: string): boolean => {
  const match = url.match(/p-\d+/);
  if (!match) {
    return false;
  }
  return true;
};

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

export const createVariantGroupUrl = (url: string): string => {
  // On Bygghemma, sometime a product url on a category page is:
  // https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-dipp-o115-cm-med-4-berit-stolar/p-1470135
  // but it gets redirected to a variant page:
  // https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-dipp-o115-cm-med-4-berit-stolar/p-1470135-1468458
  // This makes us miss products when doing category indexing since we cannot recognise the original url.
  //
  // Thus we did a custom modification here, where any products with two
  // dashes: p-{productId}-{variantId} will auto assigned to variant group
  // p-{productId}.

  const found = url.match(/p-\d+-\d+/);
  if (found) {
    return url.replace(/-\d+$/, "").replace(/-\d+\/$/, "");
  }

  return url;
};
