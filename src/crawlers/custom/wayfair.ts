import { Page } from "playwright";
import { Dictionary, log, PlaywrightCrawlingContext } from "crawlee";
import { URLSearchParams } from "url";

import {
  AbstractCrawlerDefinition,
  AbstractCrawlerDefinitionWithVariants,
  CrawlerDefinitionOptions,
  CrawlerLaunchOptions,
  VariantCrawlingStrategy,
} from "../abstract.js";
import {
  convertCurrencySymbolToISO,
  extractNumberFromText,
} from "../../utils.js";
import {
  DetailedProductInfo,
  OfferMetadata,
  ProductReviews,
  Specification,
} from "../../types/offer.js";
import { WayfairErrorAssertion } from "../../error-handling/detail-error-assertion/wayfair.js";
import { AntiBotDetailErrorHandler } from "../../error-handling/detail-error-handling/anti-bot.js";

export class WayfairCrawlerDefinition extends AbstractCrawlerDefinitionWithVariants {
  protected override variantCrawlingStrategy: VariantCrawlingStrategy =
    "same_tab";

  constructor(
    options: CrawlerDefinitionOptions,
    variantCrawlingStrategy: VariantCrawlingStrategy = "same_tab"
  ) {
    super(options, variantCrawlingStrategy);

    this.__detailPageErrorAssertions = [
      new WayfairErrorAssertion(),
      ...this.__detailPageErrorAssertions,
    ];
    this.__detailPageErrorHandlers = [
      new AntiBotDetailErrorHandler(),
      ...this.__detailPageErrorHandlers,
    ];
  }

  /**
   * This retailer does not do category scraping
   */
  extractCardProductInfo(): Promise<undefined> {
    return Promise.resolve(undefined);
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    const metadata: OfferMetadata = {};
    const schemaOrgString = <string>(
      await page
        .locator(
          "//script[@type='application/ld+json' and contains(text(), 'schema.org') and contains(text(), 'Product')]"
        )
        .textContent()
    );
    metadata.schemaOrg = JSON.parse(schemaOrgString);

    log.info("SchemaOrg", { schemaOrg: metadata.schemaOrg });

    const name = await this.extractProperty(
      page,
      "div[data-enzyme-id='PdpLayout-infoBlock'] header h1",
      (node) => node.textContent(),
      false
    ).then((text) => text?.trim());
    if (!name) {
      throw new Error("Could not extract product name");
    }

    const brand = await this.extractProperty(
      page,
      "div[data-enzyme-id='PdpLayout-infoBlock'] a[data-enzyme-id='pdp-title-block-manufacturer-name']",
      (node) => node.textContent()
    ).then((text) => text?.trim());

    const description = await this.extractProperty(
      page,
      "div.ProductOverviewItem .ProductOverviewInformation-content",
      (node) => node.textContent()
    ).then((text) => text?.trim());

    const [price, currency] = await this.extractPriceAndCurrency(page);

    let originalPrice = undefined;
    const originalPriceText = await this.extractProperty(
      page,
      "div[data-enzyme-id='PdpLayout-infoBlock'] div[data-enzyme-id='PriceBlock'] s",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    if (!originalPriceText) {
      log.debug("Cannot extract original price of product");
      originalPrice = undefined;
    } else {
      originalPrice = extractPriceAndCurrencyFromText(originalPriceText)[0];
    }

    const onSaleText = await this.extractProperty(
      page,
      "div[data-enzyme-id='PdpLayout-infoBlock'] div[data-enzyme-id='PriceBlock'] span:first-child",
      (node) => node.last().textContent()
    );
    const isDiscounted =
      originalPrice !== undefined ||
      (onSaleText !== undefined && onSaleText.includes("Im Angebot"));

    const outOfStockOverlayExist =
      (await page.locator(".OutOfStockOverlay").count()) > 0;
    const availability = outOfStockOverlayExist ? "out_of_stock" : "in_stock";

    const skuText = await this.extractProperty(
      page,
      ".PdpLayoutResponsive-breadcrumbWrap nav li:last-child",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    const sku = skuText?.replace("SKU:", "").trim();

    const mpn = await this.extractMPN(page);

    const reviews = await this.extractReviews(page);

    const categoryTree = await this.extractCategoryTree(
      page.locator(".PdpLayoutResponsive-breadcrumbWrap nav li a"),
      0
    );

    const images = (await page
      .locator("li.ProductDetailImageCarousel-carouselItem img")
      .evaluateAll((nodes) => {
        return nodes.map((node) => node.getAttribute("src"));
      })
      .then((url) => url.filter((url) => url !== null))) as string[];

    const specifications = [
      ...(await this.extractVariantOptions(page)),
      ...(await this.extractSpecificationsFromTable(
        page.locator("div.ProductOverviewItem  dl dt.kwjygg5_6101"),
        page.locator("div.ProductOverviewItem  dl dd.kwjygg6_6101")
      )),
    ];

    return {
      name,
      url: page.url(),

      brand,
      description,
      price,
      currency,
      isDiscounted,
      originalPrice,

      gtin: undefined,
      sku,
      mpn,

      categoryTree, //categoryTree is only optional if we already scraped it in the category page.

      availability,

      images, // if not applicable return an empty array
      reviews,
      specifications, // if not applicable return an empty array

      variantGroupUrl: undefined,
      variant: 0, // 0, 1, 2, 3, ...

      metadata: {},
    };
  }

  async extractReviews(page: Page): Promise<ProductReviews> {
    const averageReviewText = await this.extractProperty(
      page,
      "div[data-enzyme-id='PdpLayout-infoBlock'] .ProductRatingNumberWithCount-rating",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    const averageReview = averageReviewText ? parseFloat(averageReviewText) : 0;

    const reviewCountText = await this.extractProperty(
      page,
      "div[data-enzyme-id='PdpLayout-infoBlock'] .ProductRatingNumberWithCount-count",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    const reviewCount = extractNumberFromText(reviewCountText || "0");

    const reviews: ProductReviews = {
      reviewCount,
      averageReview,
      recentReviews: [],
    };

    return reviews;
  }

  async extractPriceAndCurrency(page: Page): Promise<[number, string]> {
    const priceAndCurrencyText = await page
      .locator(
        "div[data-enzyme-id='PdpLayout-infoBlock'] div[data-enzyme-id='PriceBlock'] span:first-child"
      )
      .first()
      .textContent({ timeout: 20000 })
      .then((text) => text?.trim());
    if (!priceAndCurrencyText) {
      throw new Error("Cannot extract price of product");
    }

    return extractPriceAndCurrencyFromText(priceAndCurrencyText);
  }

  /** Extract MPN from the a JS script tag */
  async extractMPN(page: Page): Promise<string | undefined> {
    // UPDATE 2023-08-28: Temporarily return undefined since they changed the
    // website.
    // TODO: Update this to scrape MPN.
    return undefined;

    let webpackData;
    try {
      webpackData = await this.extractWebpackEntryData(page);
    } catch (e) {
      log.warning("Cannot extract webpack data from page", {
        url: page.url(),
      });
      return undefined;
    }

    const variantPIID = await this.extractPIIDFromUrl(page.url());
    if (variantPIID) {
      const partNumbersByOption: any[] =
        webpackData.application?.props.title.manufacturerPartNumber
          .partNumbersByOption;
      if (partNumbersByOption) {
        // find where partNumbersByOption.optionKey === variantPIID
        const partNumber = partNumbersByOption.find(
          (option) => option.optionKey === variantPIID
        )?.partNumber;
        return partNumber;
      }
    } else {
      // No variant, just return the MPN of the product
      return webpackData.application?.props.title.manufacturerPartNumber
        .partNumber;
    }

    return undefined;
  }

  /** https://www.wayfair.de/moebel/pdp/perspections-essgruppe-vowinckel-mit-4-stuehlen-d000827215.html?piid=1033586268%2C1033586259
   * -> 1033586268,1033586259
   */
  async extractPIIDFromUrl(url: string): Promise<string | null> {
    const urlSearchParams = new URLSearchParams(url.split("?")[1]);
    const piid = urlSearchParams.get("piid");

    return piid;
  }

  async extractWebpackEntryData(page: Page): Promise<any> {
    const candidateScriptTexts = await page
      .locator("script[type='text/javascript']:not([src])")
      .allTextContents();

    for (const scriptText of candidateScriptTexts) {
      if (scriptText.startsWith('window["WEBPACK_ENTRY_DATA"]')) {
        // remove the window["WEBPACK_ENTRY_DATA"] and the last semicolon ;
        const jsonText = scriptText
          .replace('window["WEBPACK_ENTRY_DATA"]=', "")
          .slice(0, -1);
        return JSON.parse(jsonText);
      }
    }

    return undefined;
  }

  async extractVariantOptions(page: Page): Promise<Specification[]> {
    const options = await page
      .locator(
        "div[data-enzyme-id='PdpLayout-infoBlock'] div[data-enzyme-id='selected-option-name']"
      )
      .allTextContents()
      .then((allTexts) => {
        const options: Specification[] = allTexts.map((text) => {
          return {
            key: text.split(" ")[0],
            value: text.split(" ")[1],
          };
        });
        return options;
      });

    return options;
  }

  override async selectOptionForParamIndex(
    ctx: PlaywrightCrawlingContext<Dictionary>,
    paramIndex: number,
    optionIndex: number
  ): Promise<void> {
    const clickOptionGroupSelector = ctx.page.locator(
      "div[data-enzyme-id='PdpLayout-infoBlock'] div[data-hb-id='Grid']"
    );
    const clickOptionGroupCount = await clickOptionGroupSelector.count();
    if (paramIndex >= clickOptionGroupCount) {
      return;
    }

    const option = clickOptionGroupSelector
      .nth(paramIndex)
      .locator("div[data-hb-id='Grid.Item']")
      .nth(optionIndex);

    if (!(await option.isVisible())) {
      // Click on the group header to show the options:
      const clickOptionHeader = ctx.page.locator(
        "div[data-enzyme-id='PdpLayout-infoBlock'] div[data-enzyme-id='option-category']"
      );
      await clickOptionHeader.nth(paramIndex).click();
    }
    await option.click({ force: true });
  }

  override async hasSelectedOptionForParamIndex(
    _ctx: PlaywrightCrawlingContext<Dictionary<any>>,
    __paramIndex: number
  ): Promise<boolean> {
    return true;
  }

  override async getOptionsCountForParamIndex(
    ctx: PlaywrightCrawlingContext<Dictionary>,
    paramIndex: number
  ): Promise<number> {
    const clickOptionGroupSelector = ctx.page.locator(
      "div[data-enzyme-id='PdpLayout-infoBlock'] div[data-hb-id='Grid']"
    );
    const clickOptionGroupCount = await clickOptionGroupSelector.count();

    if (paramIndex > clickOptionGroupCount) {
      return 0;
    }

    return await clickOptionGroupSelector
      .nth(paramIndex)
      .locator("div[data-hb-id='Grid.Item']")
      .count();
  }

  override async checkInvalidVariant(
    _: PlaywrightCrawlingContext<Dictionary>,
    __: number[]
  ): Promise<boolean> {
    return false;
  }

  static async create(
    launchOptions: CrawlerLaunchOptions
  ): Promise<WayfairCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets(
        launchOptions?.uniqueCrawlerKey
      );

    return new WayfairCrawlerDefinition(
      {
        detailsDataset,
        listingDataset,
        launchOptions,
        cookieConsentSelector: "button[data-enzyme-id='BannerAcceptAll']",
      },
      "new_tabs"
    );
  }
}

/** "1.519,99 €" -> [1519.99, "EUR"]*/
function extractPriceAndCurrencyFromText(text: string): [number, string] {
  text = text
    .trim()
    .replaceAll(".", "")
    .replaceAll(",", ".")
    .replaceAll("\u00A0", " "); // replace non-breaking space with normal space
  const price = parseFloat(text.split(" ")[0]);
  const currencySymbol = text.trim().split(" ")[1];
  const currency = convertCurrencySymbolToISO(currencySymbol);

  return [price, currency];
}
