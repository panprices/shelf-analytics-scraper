import { Locator, Page } from "playwright";
import { DetailedProductInfo, ListingProductInfo } from "../../types/offer.js";
import {
  AbstractCrawlerDefinition,
  AbstractCrawlerDefinitionWithVariants,
  CrawlerDefinitionOptions,
  CrawlerLaunchOptions,
} from "../abstract.js";
import { Dictionary, PlaywrightCrawlingContext } from "crawlee";
import { convertSchemaOrgAvailability } from "../../utils.js";

export class AndLightCrawlerDefinition extends AbstractCrawlerDefinitionWithVariants {
  public constructor(options: CrawlerDefinitionOptions) {
    super(options, "same_tab");
  }

  override async crawlIntermediateCategoryPage(
    ctx: PlaywrightCrawlingContext<Dictionary>
  ): Promise<void> {
    await this.handleCookieConsent(ctx.page);
    await ctx.enqueueLinks({
      selector: "div.level-3.submenu li a",
      label: "LIST",
    });
  }

  // Only needed for category exploration. Return <undefined> otherwise.
  async extractCardProductInfo(
    categoryUrl: string,
    productCard: Locator
  ): Promise<ListingProductInfo> {
    const url = await this.extractProperty(
      productCard,
      "span.productImage a",
      (node) => node.getAttribute("href")
    );
    if (!url) throw new Error("Cannot find url of productCard");

    const categoryTree = await this.extractCategoryTreeFromCategoryPage(
      productCard.page().locator("a.BreadCrumbLink"),
      0,
      productCard.page().locator("div.category-info h1")
    );

    if (categoryTree) {
      const firstPageUrl = await this.extractProperty(
        productCard.page(),
        "//ul[contains(@class, 'pagination')]//a[@title='1']",
        (node) => node.getAttribute("href")
      );
      if (firstPageUrl) {
        categoryTree[categoryTree.length - 1].url = firstPageUrl;
      }
    }

    return {
      url,
      categoryUrl,
      popularityCategory: categoryTree ? categoryTree : undefined,
    };
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    const name = await this.extractProperty(
      page,
      "//h1[@itemprop='name']",
      (element) => element.innerText()
    ).then((text) => text?.trim());

    const brand = await this.extractProperty(
      page,
      "//a[@id='manufacturer-details-link']",
      (element) => element.innerText()
    );
    const brandUrl = await this.extractProperty(
      page,
      "//a[@id='manufacturer-details-link']",
      (element) => element.getAttribute("href")
    );
    const description = await this.extractProperty(
      page,
      "//div[@itemprop='description']",
      (element) => element.innerText()
    );
    const price = await this.extractProperty(
      page,
      "span.main-price-padding",
      (element) => element.innerText().then((p) => p.replace(/[^0-9]/g, ""))
    );
    const currency = await this.extractProperty(
      page,
      "//meta[@itemprop='priceCurrency']",
      (element) => element.getAttribute("content") || ""
    );
    const originalPrice = await this.extractProperty(
      page,
      "div.price-before span.line-through",
      (element) => element.innerText().then((p) => p.replace(/[^0-9]/g, ""))
    );
    const isDiscounted = !!originalPrice;

    let availability = await this.extractProperty(
      page,
      "//link[@itemprop='availability']",
      (element) => element.getAttribute("href")
    );
    availability = availability
      ? convertSchemaOrgAvailability(availability)
      : undefined;

    const gtin = await this.extractProperty(
      page,
      "//meta[@itemprop='gtin13']",
      (element) => element.getAttribute("content")
    );
    const sku = await this.extractProperty(
      page,
      "//span[@itemprop='productid']",
      (element) => element.innerText()
    );
    const mpn = await this.extractProperty(
      page,
      "//meta[@itemprop='mpn']",
      (element) => element.getAttribute("content")
    );

    const images = await this.extractImageFromProductPage(page);

    const specifications = await this.extractSpecificationsFromTable(
      page.locator("//div[contains(@class, 'productdetails-flex-row')]/div[1]"),
      page.locator("//div[contains(@class, 'productdetails-flex-row')]/div[2]")
    );

    const categoryTree = await this.extractCategoryTree(
      page.locator("a.BreadCrumbLink")
    );

    return {
      name,
      url: page.url(),

      brand,
      brandUrl,
      description,
      price: price ? parseInt(price) : undefined,
      currency,
      isDiscounted,
      originalPrice: originalPrice ? parseInt(originalPrice) : undefined,
      availability,

      gtin,
      sku,
      mpn,

      images, // if not applicable return an empty array
      specifications, // if not applicable return an empty array

      categoryTree, // is only optional if we already scraped it in the category page.
    };
  }

  async extractImageFromProductPage(page: Page): Promise<string[]> {
    const imageUrls = [];
    const imageLocator = page.locator("div#product-info div.prod-image a");
    const imageCount = await imageLocator.count();

    for (let i = 0; i < imageCount; i++) {
      const img = imageLocator.nth(i);
      const url = await img.getAttribute("href");
      if (url) {
        imageUrls.push(url);
      }
    }

    return imageUrls;
  }

  static async create(
    launchOptions?: CrawlerLaunchOptions
  ): Promise<AndLightCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets(
        launchOptions?.uniqueCrawlerKey
      );

    return new AndLightCrawlerDefinition({
      detailsDataset,
      listingDataset,

      // Only needed for category exploration
      listingUrlSelector: "li#NextPage a",
      detailsUrlSelector: "article.productCard span.productImage a",
      productCardSelector: "article.productCard",
      cookieConsentSelector: "button#acc__accept-btn",
      dynamicProductCardLoading: false,
      launchOptions,
    });
  }

  checkInvalidVariant(
    _: PlaywrightCrawlingContext,
    _currentOption: number[]
  ): Promise<boolean> {
    return Promise.resolve(false);
  }

  async getOptionsCountForParamIndex(
    ctx: PlaywrightCrawlingContext,
    paramIndex: number
  ): Promise<number> {
    if (paramIndex === 1) {
      const variantSelectorsLocator = ctx.page.locator(
        "section.variants label"
      );
      const variantSelectorsCount = await variantSelectorsLocator.count();

      if (variantSelectorsCount > 1) {
        throw new Error(
          "Unkown page format with more than one variant selector"
        );
      }
      return 0;
    }

    const optionsLocator = ctx.page.locator(
      "section.variants a.productElement"
    );
    return optionsLocator.count();
  }

  hasSelectedOptionForParamIndex(
    _ctx: PlaywrightCrawlingContext,
    _paramIndex: number
  ): Promise<boolean> {
    return Promise.resolve(true); // haven't seen an example with unselected variant
  }

  async selectOptionForParamIndex(
    ctx: PlaywrightCrawlingContext,
    paramIndex: number,
    optionIndex: number
  ): Promise<void> {
    if (optionIndex === 0) {
      // First option is selected by default
      return;
    }

    const variantSelectorLocator = ctx.page
      .locator("section.variants label")
      .nth(paramIndex);

    await variantSelectorLocator.click();

    const selectedOptionLocator = ctx.page
      .locator("section.variants div.variant-products a")
      .nth(optionIndex - 1);

    await selectedOptionLocator.click();
  }

  override async waitForChanges(
    ctx: PlaywrightCrawlingContext,
    currentState: any,
    timeout: number = 1000, // ms,
    currentOption: number[] = []
  ): Promise<any> {
    if (currentOption[currentOption.length - 1] === 0) {
      // The first option is selected by default
      return currentState;
    }

    return super.waitForChanges(ctx, currentState, timeout, currentOption);
  }
}
