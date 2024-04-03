import {
  AbstractCrawlerDefinition,
  CrawlerDefinitionOptions,
  CrawlerLaunchOptions,
} from "../abstract";
import { Locator, Page } from "playwright";
import { Dataset, log, PlaywrightCrawlingContext } from "crawlee";
import {
  DetailedProductInfo,
  IndividualReview,
  ListingProductInfo,
  OfferMetadata,
  ProductReviews,
  Specification,
} from "../../types/offer";
import { extractDomainFromUrl } from "../../utils";
import { v4 as uuidv4 } from "uuid";
import {
  createCrawlerDefinitionOption,
  extractCardProductInfo as baseExtractCardProductInfo,
  extractProductDetails as baseExtractProductDetails,
  getVariantUrlsFromSchemaOrg,
  isProductPage,
} from "./base-chill";

export class ChilliCrawlerDefinition extends AbstractCrawlerDefinition {
  constructor(options: CrawlerDefinitionOptions) {
    super(options);

    this._router.addHandler("INTERMEDIATE_LOWER_CATEGORY", (_) =>
      this.crawlIntermediateLowerCategoryPage(_)
    );
  }

  override async crawlDetailPage(
    ctx: PlaywrightCrawlingContext
  ): Promise<void> {
    // Always scrape at least once:
    await super.crawlDetailPage(ctx);

    if (this.launchOptions?.ignoreVariants) {
      return;
    }
    if (!isProductPage(ctx.page.url())) {
      return;
    }

    // Enqueue the urls from the colour selector:
    await ctx.enqueueLinks({
      selector: "main div.d.a3 div.o a",
      label: "DETAIL",
      userData: ctx.request.userData,
    });

    // Enqueue the urls from the size selector:
    const chooseSizeButtonSelector = ctx.page.locator(
      "main div.d.a3 div[aria-haspopup='listbox'] span > a"
    );
    if ((await chooseSizeButtonSelector.count()) > 0) {
      chooseSizeButtonSelector.click();
      await ctx.page
        .locator("main div.d.a3 ul[role='listbox'] li a")
        .first()
        .waitFor();
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    await ctx.enqueueLinks({
      selector: "main div.d.a3 ul[role='listbox'] li a",
      label: "DETAIL",
      userData: ctx.request.userData,
    });

    // DEPRECATED: Doesn't work on Chilli anymore
    // Enqueue variants from schema.org:
    // const schemaOrgVariantUrls = await getVariantUrlsFromSchemaOrg(ctx.page);
    // if (schemaOrgVariantUrls) {
    //   await ctx.enqueueLinks({
    //     urls: schemaOrgVariantUrls,
    //     label: "DETAIL",
    //     userData: ctx.request.userData,
    //   });
    // }

    // Check for secondary variant group where you don't have a.href.
    // Try to click buttons and enqueue new links:
    const secondaryVariantButtons = ctx.page.locator(
      "div[data-cy='product_variant_link']"
    );
    const secondaryVariantButtonsCount = await secondaryVariantButtons.count();

    // Always have one button grayed out which is the current selected variant,
    // so we only try to enqueue more if there are at least 1 more.

    const variantUrls = [];
    if (secondaryVariantButtonsCount >= 2) {
      for (let i = 0; i < secondaryVariantButtonsCount; i++) {
        await secondaryVariantButtons.nth(i).click();
        await ctx.page.waitForTimeout(1500);

        variantUrls.push(ctx.page.url());
      }
    }
    await ctx.enqueueLinks({
      urls: variantUrls,
      label: "DETAIL",
      userData: ctx.request.userData,
    });
  }

  async extractCardProductInfo(
    categoryUrl: string,
    productCard: Locator
  ): Promise<ListingProductInfo> {
    return baseExtractCardProductInfo(this, categoryUrl, productCard);
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    const productInfo = await baseExtractProductDetails(this, page);

    let description;
    try {
      const descriptionExpander = page.locator(
        "//main//div[contains(@class, 'ac') and .//span/text()='Produktinformation']"
      );
      await descriptionExpander.click({ timeout: 5000 });
      description = await this.extractProperty(
        page,
        "//main//div[contains(@class, 'ac') and .//span/text()='Produktinformation']/div",
        (node) => node.innerText()
      ).then((text) => text?.trim());
    } catch (e) {
      log.info(`Description not found for product with url: ${page.url()}`);
      description = undefined;
    }

    let articleNumber = undefined,
      specifications: Specification[] = [];
    try {
      const specificationsExpander = page.locator(
        "//main//div[contains(@class, 'ac') and .//span/text()='Specifikationer']"
      );
      await specificationsExpander.click({ timeout: 5000 });
      await page.waitForSelector(
        "//main//div[contains(@class, 'ac') and .//span/text()='Specifikationer']//div//div//div//div//span[2]"
      );
      articleNumber = await this.extractProperty(
        page,
        "//main//div[contains(@class, 'ac') and .//span/text()='Specifikationer']//div//div//div//div//span[2]",
        (node) => node.textContent()
      ).then((text) => text?.trim());

      specifications = await this.extractSpecificationsFromTable(
        specificationsExpander.locator("//tr/td[1]"),
        specificationsExpander.locator("//tr/td[2]")
      );
    } catch (e) {
      log.info(`Specification not found for product with url: ${page.url()}`);
    }

    const images = await extractImagesFromProductPage(page);

    return {
      ...productInfo,
      description,
      sku: articleNumber,
      images,
      specifications,
    };
  }

  override async crawlIntermediateCategoryPage(
    ctx: PlaywrightCrawlingContext
  ): Promise<void> {
    await ctx.enqueueLinks({
      selector:
        "//div[contains(@class, 'subCategories-enter-done')]//a[not(contains(@aria-label, 'Kampanj'))]",
      label: "INTERMEDIATE_LOWER_CATEGORY",
    });
  }

  async crawlIntermediateLowerCategoryPage(
    ctx: PlaywrightCrawlingContext
  ): Promise<void> {
    const rootUrl = extractDomainFromUrl(ctx.page.url());
    const subCategoryLocator =
      "//div[@id = 'toggledCategories']//a[not(contains(@aria-label, 'Kampanj'))]";

    const subCategoryUrls = await ctx.page
      .locator(subCategoryLocator)
      .evaluateAll((list: HTMLElement[]) =>
        list.map((e) => e.getAttribute("href"))
      );
    const isLeafCategory = subCategoryUrls
      .map((u) => `${rootUrl}${u}`)
      .some((u) => ctx.page.url() == u);
    const label = isLeafCategory ? "LIST" : "INTERMEDIATE_LOWER_CATEGORY";

    await ctx.enqueueLinks({
      selector: subCategoryLocator,
      label,
    });
  }

  static async create(
    launchOptions: CrawlerLaunchOptions
  ): Promise<ChilliCrawlerDefinition> {
    const options = await createCrawlerDefinitionOption(launchOptions);
    // Next page buttons are dynamically rendered, so we need to scroll slower
    options.dynamicProductCardLoading = true;

    return new ChilliCrawlerDefinition({ ...options, launchOptions });
  }
}

async function extractImagesFromProductPage(page: Page): Promise<string[]> {
  const imageThumbnailLocator = page.locator("main div.a0j > div.z div.cr img");

  try {
    await imageThumbnailLocator.waitFor({ timeout: 10000 });
  } catch (e) {
    // Probably no images thumbnails -> do nothing and just scrape the main image
  }

  const imagesCount = await imageThumbnailLocator.count();
  for (let i = 0; i < imagesCount; i++) {
    const currentThumbnail = imageThumbnailLocator.nth(i);
    await currentThumbnail.click();
    await page.waitForTimeout(200);
  }
  const images = await page
    .locator("main div.a0j > div.z div.ht img")
    .evaluateAll((list: HTMLElement[]) =>
      list.map((element) => <string>element.getAttribute("src"))
    );

  return images;
}
