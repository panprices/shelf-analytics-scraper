import { Page } from "playwright";
import { DetailedProductInfo } from "../../types/offer";
import {
  AbstractCrawlerDefinition,
  AbstractCrawlerDefinitionWithVariants,
  CrawlerLaunchOptions,
} from "../abstract";
import { log, PlaywrightCrawlingContext } from "crawlee";

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
      try {
        await modalOverlayCloseButton.click({ timeout: 1000 });
      } catch (error) {
        // do nothing
        log.warning("The modal overlay could not be closed (or disappeared)");
      }
    }

    const countryPopup = page.locator(
      "#Form--14f6e1579-93c1-4d4e-ad96-00b6e5f745e7"
    );
    const countryPopupExists = (await countryPopup.count()) > 0;
    if (countryPopupExists) {
      await countryPopup.evaluate((el) => {
        const document = el.parentElement?.parentElement;
        const parent = el.parentElement;
        if (!document || !parent) {
          return;
        }
        document?.removeChild(parent);
      });
    }

    return super.handleCookieConsent(page);
  }

  override async exploreVariantsSpace(
    ctx: PlaywrightCrawlingContext,
    parameterIndex: number,
    currentOption: number[],
    variantGroupUrl: string,
    exploredVariants: number = 0,
    pageState?: any,
    limit?: number
  ): Promise<[any, number]> {
    // Increased timeout for page variant exploration
    ctx.page.setDefaultTimeout(90000);
    return super.exploreVariantsSpace(
      ctx,
      parameterIndex,
      currentOption,
      variantGroupUrl,
      exploredVariants,
      pageState,
      limit
    );
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
      "//a[contains(text(), 'Vis flere billeder')]"
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

      images: [...new Set(images)], // deduplicate images by url
      reviews: undefined,
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
      "//button[span[contains(text(), 'Vælg')]]"
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
