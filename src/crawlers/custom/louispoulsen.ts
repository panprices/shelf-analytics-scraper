import { Page } from "playwright";
import { DetailedProductInfo } from "../../types/offer";
import {
  AbstractCrawlerDefinition,
  AbstractCrawlerDefinitionWithVariants,
  CrawlerLaunchOptions,
} from "../abstract";
import { PlaywrightCrawlingContext } from "crawlee";

export class LouisPoulsenCrawlerDefinition extends AbstractCrawlerDefinitionWithVariants {
  /**
   * This retailer does not use category scraping, it gets the URLs from sitemap
   */
  extractCardProductInfo(): Promise<undefined> {
    return Promise.resolve(undefined);
  }

  override async handleCookieConsent(page: Page): Promise<void> {
    const modalOverlay = page.locator(".modal-body-container");
    const modalOverlayExists = (await modalOverlay.count()) > 0;
    if (modalOverlayExists) {
      const modalOverlayCloseButton = modalOverlay.locator(
        "//button[span/i[contains(text(), clear)]]"
      );
      await modalOverlayCloseButton.click();
    }

    return super.handleCookieConsent(page);
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    await page.waitForLoadState("networkidle");

    // return a Dummy `DetailedProductInfo` object
    const name = await this.extractProperty(
      page,
      "//div[contains(@class, 'u-mb-80p')]//h1[contains(@class, 'u-text-h3-s')]",
      (el) => el.innerText()
    );

    const sku = page.url().split("?")[1].split("&")[0].split("-")[1];

    const images = [];
    const mainImageElement = page.locator(".c-carousel-element.is-selected");

    // check if any overlay appeared
    await this.handleCookieConsent(page);
    await mainImageElement.click();

    const imageElements = page.locator(".slider-image");
    const imageElementsCount = await imageElements.count();
    for (let i = 0; i < imageElementsCount; i++) {
      const currentImage = imageElements.nth(i);
      const imageSource = await currentImage.evaluate((el) =>
        el.getAttribute("srcset")
      );
      const lastImageSource = imageSource?.split(", ").pop();
      if (!lastImageSource) {
        continue;
      }
      const lastImageSourceUrl = lastImageSource.split(" ")[0];
      images.push(lastImageSourceUrl);
    }

    const modalCloseButton = page.locator(
      "//div[contains(@class, 'c-modal')]//div[i[contains(text(), 'clear')]]"
    );
    await modalCloseButton.click();

    // Grab "inspirational" images
    const moreImagesButton = page.locator(
      "//a[contains(text(), 'Show more images')]"
    );
    const moreImagesButtonExists = (await moreImagesButton.count()) > 0;
    if (moreImagesButtonExists) {
      await moreImagesButton.click();
      await page.waitForTimeout(1000);
      await page.waitForLoadState("networkidle");
    }
    const otherImageElements = page.locator(".inspirational-content img");
    const otherImageElementsCount = await otherImageElements.count();
    for (let i = 0; i < otherImageElementsCount; i++) {
      const currentImage = otherImageElements.nth(i);
      const imageSource = await currentImage.evaluate((el) =>
        el.getAttribute("src")
      );
      if (!imageSource) {
        continue;
      }
      images.push(imageSource);
    }

    return {
      name: name ?? "",
      url: page.url(),

      brand: "Louis Poulsen",
      description: "",
      price: undefined,
      currency: undefined,
      isDiscounted: false,
      originalPrice: undefined,

      gtin: "",
      sku: sku,
      mpn: sku,

      categoryUrl: "",
      categoryTree: [],

      metadata: {},

      availability: "in_stock",

      images: images, // if not applicable return an empty array
      reviews: "unavailable",
      specifications: [], // if not applicable return an empty array
    };
  }

  static async create(
    launchOptions?: CrawlerLaunchOptions
  ): Promise<LouisPoulsenCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets(
        launchOptions?.uniqueCrawlerKey
      );

    return new LouisPoulsenCrawlerDefinition({
      detailsDataset,
      listingDataset,
      launchOptions,
      cookieConsentSelector:
        "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
    });
  }

  checkInvalidVariant(
    _: PlaywrightCrawlingContext,
    __: number[]
  ): Promise<boolean> {
    return Promise.resolve(false);
  }

  async _getColorVariantsCount(
    ctx: PlaywrightCrawlingContext
  ): Promise<number> {
    const page = ctx.page;
    const colorSelectors = page.locator(".c-property-selector-color");
    return await colorSelectors.count();
  }

  async getOptionsCountForParamIndex(
    ctx: PlaywrightCrawlingContext,
    paramIndex: number
  ): Promise<number> {
    const page = ctx.page;
    const colorsCount = await this._getColorVariantsCount(ctx);
    if (paramIndex === 0 && colorsCount !== 1) {
      return colorsCount;
    }

    const offsetForColorsParam = colorsCount === 1 ? 0 : 1;

    const panelOptions = page.locator("//div[div[@class = 'u-pl-1']]");
    const panelOptionIndex = paramIndex - offsetForColorsParam;

    const panelOptionCount = await panelOptions.count();
    if (panelOptionIndex >= panelOptionCount) {
      return 0;
    }

    const panelOption = panelOptions.nth(panelOptionIndex);
    await panelOption.click();

    const options = page.locator(".c-radio");
    const result = await options.count();

    // reset the panel option
    const panelCloseButton = page.locator(
      ".c-desktop-flyover-content .u-top-0"
    );

    await panelCloseButton.click();

    return result;
  }

  hasSelectedOptionForParamIndex(
    _: PlaywrightCrawlingContext,
    __: number
  ): Promise<boolean> {
    return Promise.resolve(true);
  }

  async selectOptionForParamIndex(
    ctx: PlaywrightCrawlingContext,
    paramIndex: number,
    optionIndex: number
  ): Promise<void> {
    const page = ctx.page;

    const colorVariantsCount = await this._getColorVariantsCount(ctx);
    if (paramIndex === 0 && colorVariantsCount !== 1) {
      const colorOptions = ctx.page.locator(".c-property-selector-color");
      const colorOptionsCount = await colorOptions.count();
      if (optionIndex >= colorOptionsCount) {
        return;
      }

      const colorOption = colorOptions.nth(optionIndex);
      await colorOption.click();
      return;
    }
    const offsetForColorsParam = colorVariantsCount === 1 ? 0 : 1;

    const panelOptions = page.locator("//div[div[@class = 'u-pl-1']]");
    const panelOptionIndex = paramIndex - offsetForColorsParam;

    const panelOptionCount = await panelOptions.count();
    if (panelOptionIndex >= panelOptionCount) {
      return;
    }

    const panelOption = panelOptions.nth(panelOptionIndex);
    await panelOption.click();

    const options = page.locator(".c-radio");
    const optionsCount = await options.count();
    if (optionIndex >= optionsCount) {
      return;
    }
    const option = options.nth(optionIndex);
    await option.click();

    const confirmationButton = page.locator(
      "//button[span[contains(text(), 'close')]]"
    );
    await confirmationButton.click();

    return;
  }

  override async waitForChanges(
    ctx: PlaywrightCrawlingContext,
    currentState: any,
    _: number = 1000 // ms
  ) {
    // Wait for network to be idle
    await ctx.page.waitForLoadState("networkidle");

    // Wait for 1 more second just in case
    await ctx.page.waitForTimeout(1000);

    return currentState;
  }
}
