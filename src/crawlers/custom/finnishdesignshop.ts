import { Page } from "playwright";
import { DetailedProductInfo } from "../../types/offer";
import {
  AbstractCrawlerDefinition,
  AbstractCrawlerDefinitionWithVariants,
  CrawlerDefinitionOptions,
  CrawlerLaunchOptions,
} from "../abstract";
import { extractDomainFromUrl } from "../../utils";
import { PlaywrightCrawlingContext, Dictionary, log } from "crawlee";

/**
 * Variants appear for example for posters with different sizes:
 * - https://www.finnishdesignshop.com/en-se/product/floating-leaves-09
 *
 * Is the link above unavailable, try looking through the posters category:
 * - https://www.finnishdesignshop.com/en-se/decoration/posters-memory-boards/posters
 *
 * Changing the size does not change the URL, so we need to handle variant crawling
 */
export class FinnishDesignShopCrawlerDefinition extends AbstractCrawlerDefinitionWithVariants {
  public constructor(options: CrawlerDefinitionOptions) {
    super(options, "same_tab");
  }

  private async waitForSinglePrice(page: Page) {
    const priceLocatorString = "form span#price span.price-localized";
    const maxWaitLoops = 5;
    let currentWaitLoop = 0;
    while (true) {
      try {
        await page.waitForSelector(priceLocatorString, {
          timeout: 500,
        });
        const priceLocator = page.locator(priceLocatorString);
        const priceCount = await priceLocator.count();
        if (priceCount === 1) {
          return;
        }

        if (currentWaitLoop > maxWaitLoops) {
          log.info(`Waiting for single price, found ${priceCount} prices`);
          return;
        }

        log.info(`Waiting for single price, found ${priceCount} prices`);
      } catch (e) {
        log.info("Waiting for price threw an error");
      }
      // Add a small delay
      await new Promise((resolve) => setTimeout(resolve, 300));

      currentWaitLoop++;
    }
  }

  override async crawlDetailPage(
    ctx: PlaywrightCrawlingContext
  ): Promise<void> {
    await ctx.page.waitForLoadState("networkidle");
    await this.waitForSinglePrice(ctx.page);
    return super.crawlDetailPage(ctx);
  }

  override async getCurrentVariantState(
    ctx: PlaywrightCrawlingContext
  ): Promise<any> {
    const sku = await this.extractProperty(
      ctx.page,
      "form span#price span.price-localized",
      (node) => node.getAttribute("data-sku")
    );

    return { sku };
  }

  override async getCurrentVariantUrl(
    ctx: PlaywrightCrawlingContext
  ): Promise<string> {
    await ctx.page.waitForSelector("form span#price span.price-localized", {
      timeout: 500,
    });
    const url = ctx.page.url().split("?")[0];
    const sku = await this.extractProperty(
      ctx.page,
      "form span#price span.price-localized",
      (node) => node.getAttribute("data-sku")
    );
    log.info(`Current variant url: ${url}?sku=${sku}`);
    return `${url}?sku=${sku}`;
  }

  async selectOptionForParamIndex(
    ctx: PlaywrightCrawlingContext<Dictionary<any>>,
    paramIndex: number,
    optionIndex: number
  ): Promise<void> {
    const allParametersLocator = ctx.page.locator(
      "ul.product-variations:visible"
    );
    const parametersCount = await allParametersLocator.count();
    if (paramIndex >= parametersCount) {
      log.info("Had variants initially but option was auto-selected");
      return;
    }

    const parameterLocator = allParametersLocator.nth(paramIndex);
    const options = parameterLocator.locator("li");
    const option = await options.nth(optionIndex);

    await option.click();

    await ctx.page.waitForLoadState("networkidle");
  }

  async hasSelectedOptionForParamIndex(
    ctx: PlaywrightCrawlingContext<Dictionary<any>>,
    paramIndex: number
  ): Promise<boolean> {
    const parameterLocator = ctx.page
      .locator("ul.product-variations")
      .nth(paramIndex);
    const optionsLocator = parameterLocator.locator("li");
    const optionsCount = await optionsLocator.count();

    for (let i = 0; i < optionsCount; i++) {
      const currentOptionLocator = optionsLocator.nth(i);
      const isSelected = await currentOptionLocator
        .getAttribute("class")
        .then((className) => className?.includes("selected") ?? false);

      if (isSelected) {
        return true;
      }
    }
    return false;
  }

  private async hasVariants(page: Page): Promise<boolean> {
    return page
      .locator("ul.product-variations")
      .count()
      .then((count) => count > 0);
  }

  async getOptionsForParamIndex(
    ctx: PlaywrightCrawlingContext<Dictionary<any>>,
    paramIndex: number
  ): Promise<number> {
    const allParametersLocator = ctx.page.locator("ul.product-variations");
    const parametersCount = await allParametersLocator.count();
    if (paramIndex >= parametersCount) {
      return 0;
    }

    const parameterLocator = allParametersLocator.nth(paramIndex);
    const optionsLocator = parameterLocator.locator("li");
    return optionsLocator.count();
  }

  /**
   * Assumed to be impossible
   * @param ctx
   * @param currentOption
   */
  async checkInvalidVariant(
    ctx: PlaywrightCrawlingContext<Dictionary<any>>,
    currentOption: number[]
  ): Promise<boolean> {
    const availableOptionsCount = await this.getOptionsForParamIndex(
      ctx,
      currentOption.length - 1
    );

    return availableOptionsCount === 0;
  }

  /**
   * This retailer does not use category scraping, it gets the URLs from sitemap
   */
  extractCardProductInfo(): Promise<undefined> {
    return Promise.resolve(undefined);
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    await page.waitForSelector('//*[@itemprop="name"]');

    const hasVariants = await this.hasVariants(page);

    // return a Dummy `DetailedProductInfo` object
    const sku = await this.extractProperty(
      page,
      "form span#price span.price-localized",
      (node) => node.getAttribute("data-sku")
    );
    const mpn = sku?.substring(2);

    const categoryTree = await this.extractCategoryTree(
      page.locator('//ol[contains(@class, "breadcrumb")]//a'),
      1
    );

    const name = await this.extractProperty(
      page,
      '//*[@itemprop="name"]',
      (node) => node.textContent()
    );

    if (!name) throw new Error("Cannot find name of product");

    const brand = await this.extractProperty(
      page,
      '(//div[contains(@class, "product-info-col")]//h2)[1]/a',
      (node) => node.textContent()
    );

    const description = await this.extractProperty(
      page,
      '//div[contains(@class, "product-description") and not(contains(@class, "hidden"))]',
      (node) => node.textContent()
    );

    const isDiscountedStr = await this.extractProperty(
      page,
      "form span#price span.js-price-sale",
      (node) => node.count().then((c) => (c > 0).toString())
    );
    const isDiscounted = isDiscountedStr === "true";

    let price: string | null | undefined;
    let currency: string | null | undefined;
    let originalPrice: string | null | undefined = undefined;

    const currencyExtractor = (t: string | null | undefined) =>
      t
        ?.replace(/[^A-Z€£]/g, "")
        .replace("€", "EUR")
        .replace("£", "GBP");

    if (isDiscounted) {
      price = await this.extractProperty(
        page,
        "form span#price span.js-price-sale",
        (node) => node.getAttribute("data-localized-price")
      );

      // The price from which we remove commas, dots, spaces and numbers
      currency = await this.extractProperty(
        page,
        "form span#price span.js-price-sale",
        (node) => node.textContent().then(currencyExtractor)
      );

      originalPrice = await this.extractProperty(
        page,
        "form span#price span.js-price-original",
        (node) => node.getAttribute("data-localized-original-price")
      );
    } else {
      const priceCurrencyString = await this.extractProperty(
        page,
        "form span#price span.price-localized",
        (node) => node.textContent()
      );

      price = priceCurrencyString?.replace(/[^0-9,\\. ]/g, "").split(",")[0];
      currency = currencyExtractor(priceCurrencyString);
    }

    if (!price) throw new Error("Cannot find price of product");
    if (!currency) throw new Error("Cannot find currency of product");

    const schemaOrg = await this.extractSchemaOrgFromAttributes(page);

    const isAvailable = await this.extractProperty(
      page,
      '//span[contains(@class, "sku-availability") and contains(@class, "bg-checkmark")]',
      (node) => node.count().then((c) => (c > 0).toString())
    );

    const specsReadMoreButton = page.locator(
      '//div[@id = "panelFeatures"]//a[@data-action = "toggle"]'
    );
    const specsReadMoreButtonCount = await specsReadMoreButton.count();
    if (specsReadMoreButtonCount === 1) {
      const canClick = await specsReadMoreButton.isVisible();
      if (canClick) {
        await specsReadMoreButton.click();
      }
    }

    const specsPropertiesLocator = page.locator(
      '//dl[contains(@class, "product-features-list")]//dt'
    );
    const specsValuesLocator = page.locator(
      '//dl[contains(@class, "product-features-list")]//dd'
    );
    const specsCount = await specsPropertiesLocator.count();
    // Zip the properties and values together
    const specsArray = await Promise.all(
      Array.from(Array(specsCount).keys()).map(async (i) => {
        const property = (await specsPropertiesLocator
          .nth(i)
          .textContent()) as string;
        const value = (await specsValuesLocator.nth(i).textContent()) as string;
        return { key: property, value: value };
      })
    );

    const images = await page
      .locator("img.product-large-image")
      .evaluateAll((nodes) => {
        return nodes.map((node) => node.getAttribute("src"));
      });

    return {
      name: name,
      url: hasVariants ? `${page.url()}?sku=${sku}` : page.url(),

      brand: brand,
      description: description,
      price: parseFloat(price),
      currency: currency,
      isDiscounted: isDiscounted,
      originalPrice: originalPrice ? parseFloat(originalPrice) : undefined,

      gtin: undefined,
      sku: sku,
      mpn: mpn,

      categoryUrl: categoryTree[categoryTree.length - 1]?.url,
      categoryTree: categoryTree,

      metadata: {
        schemaOrg: schemaOrg,
        originalPrice: originalPrice ? parseFloat(originalPrice) : undefined,
      },

      availability: isAvailable === "true" ? "in_stock" : "out_of_stock",
      fetchedAt: new Date().toISOString(),
      retailerDomain: extractDomainFromUrl(page.url()),

      images: images.filter((i) => i !== undefined).map((i) => i as string), // if not applicable return an empty array
      reviews: "unavailable",
      specifications: specsArray, // if not applicable return an empty array
    };
  }

  static async create(
    launchOptions?: CrawlerLaunchOptions
  ): Promise<FinnishDesignShopCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets();

    return new FinnishDesignShopCrawlerDefinition({
      detailsDataset,
      listingDataset,
      launchOptions,
    });
  }
}
