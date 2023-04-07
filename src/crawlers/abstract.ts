import {
  CheerioCrawlingContext,
  CrawlingContext,
  createCheerioRouter,
  createPlaywrightRouter,
  Dataset,
  log,
  PlaywrightCrawlingContext,
  Router,
  RouterHandler,
} from "crawlee";
import { Locator, Page } from "playwright";
import {
  Category,
  DetailedProductInfo,
  ListingProductInfo,
} from "../types/offer";
import { extractRootUrl } from "../utils";
import { v4 as uuidv4 } from "uuid";

export interface CrawlerDefinitionOptions {
  /**
   * Keeps the detailed data about products, the one extracted from a product page
   */
  detailsDataset: Dataset;

  /**
   * Keeps shallow data about products, extracted form product listings (ex: category pages)
   */
  listingDataset: Dataset;

  /**
   * Selector for the urls of individual product pages
   */
  detailsUrlSelector?: string; // undefined if we don't implement category scraping

  /**
   * Selector for next pages within the product listing / category
   */
  listingUrlSelector?: string; // undefined if we don't implement category scraping

  /**
   * Selector for individual product cards to be scraped for information available as part of the listings
   */
  productCardSelector?: string; // undefined if we don't implement category scraping

  /**
   * Selector for the cookie consent button
   */
  cookieConsentSelector?: string;

  /**
   * Whether we should consider that the category page dynamically loads in the DOM only visible products
   *
   * If that's the case, we need to fetch the elements after every scroll
   */
  dynamicProductCardLoading?: boolean;

  /**
   * Options to control the crawler behavior
   */
  launchOptions?: CrawlerLaunchOptions;
}

export interface CrawlerLaunchOptions {
  /**
   * Option to ignore enquing variants of a product
   */
  ignoreVariants?: boolean;
}

export interface CheerioCrawlerDefinitionOptions {
  /**
   * Keeps the detailed data about products, the one extracted from a product page
   */
  detailsDataset: Dataset;
}

/**
 * General definition of what we need to do to x a new custom implementation for a given website.
 *
 * It defines the way in which both listing and individual pages should be scraped to gain information.
 */
export interface CrawlerDefinition<Context extends CrawlingContext> {
  crawlDetailPage(ctx: Context): Promise<void>;
  get detailsDataset(): Dataset;
  get router(): Router<Context>;
}

export abstract class AbstractCrawlerDefinition
  implements CrawlerDefinition<PlaywrightCrawlingContext>
{
  protected readonly _router: RouterHandler<PlaywrightCrawlingContext>;
  protected readonly _detailsDataset: Dataset;
  private readonly _listingDataset: Dataset;

  protected readonly listingUrlSelector?: string;
  protected readonly productCardSelector?: string;
  protected readonly launchOptions?: CrawlerLaunchOptions;

  protected readonly crawlerOptions: CrawlerDefinitionOptions;

  /**
   * Number of products displayed on a category page
   */
  protected readonly categoryPageSize?: number;

  private readonly productInfos: Map<string, ListingProductInfo>;

  protected constructor(options: CrawlerDefinitionOptions) {
    this._router = createPlaywrightRouter();
    const crawlerDefinition = this;
    this._router.addHandler("DETAIL", (_) =>
      crawlerDefinition.crawlDetailPage(_)
    );
    this._router.addHandler("LIST", (_) => crawlerDefinition.crawlListPage(_));
    this._router.addHandler("INTERMEDIATE_CATEGORY", (_) =>
      crawlerDefinition.crawlIntermediateCategoryPage(_)
    );

    this._detailsDataset = options.detailsDataset;
    this._listingDataset = options.listingDataset;

    this.listingUrlSelector = options.listingUrlSelector;
    this.productCardSelector = options.productCardSelector;
    this.launchOptions = options?.launchOptions;
    this.crawlerOptions = options;

    this.productInfos = new Map<string, ListingProductInfo>();
  }

  /**
   * Get details about an individual product by looking at the product page
   *
   * This method also saves to a crawlee `Dataset`. In the future it has to save to an external storage like firestore
   *
   * @param ctx
   */
  async crawlDetailPage(ctx: PlaywrightCrawlingContext): Promise<void> {
    log.info(`Looking at product with url ${ctx.page.url()}`);
    const productDetails = await this.extractProductDetails(ctx.page);
    const request = ctx.request;

    await this._detailsDataset.pushData(<DetailedProductInfo>{
      ...request.userData,
      ...productDetails,
      fetchedAt: new Date().toISOString(),
      retailerDomain: extractRootUrl(ctx.page.url()),
    });
  }

  /**
   * Abstract method for creating a `ProductInfo` object by scraping an individual product (DETAIL) page.
   *
   * This method has to be implemented for each of the sources we want to scrape
   * @param page
   */
  abstract extractProductDetails(page: Page): Promise<DetailedProductInfo>;

  /**
   * Entry point for the listing pages logic.
   *
   * We scroll to the bottom of the page and progressively add identified products. This way we address the issue of
   * lazy loading web pages and various recycle views that could prevent us for getting a full picture of the products
   * in the listing by only looking at one window of the page.
   *
   * @param ctx
   */
  async crawlListPage(ctx: PlaywrightCrawlingContext): Promise<void> {
    if (!this.productCardSelector) {
      log.info("No product card selector defined, skipping");
      return;
    }

    await ctx.page.locator(this.productCardSelector).nth(0).waitFor();

    await this.scrollToBottom(ctx);
    await this.registerProductCards(ctx);

    if (this.listingUrlSelector) {
      await ctx.enqueueLinks({
        selector: this.listingUrlSelector,
        label: "LIST",
      });
    }
  }

  async crawlIntermediateCategoryPage(
    _: PlaywrightCrawlingContext
  ): Promise<void> {
    throw new Error(
      "Intermediate category crawling not implemented for the given website"
    );
  }

  /**
   * This method also assigns the `popularityIndex` property to products. The idea is that a product arrives here
   * in the order it is found while scraping the listing page, so its popularity index is
   * (the number of products we have already registered in the map before its arrival) + 1.
   * Plus one so that we start counting from 1.
   *
   * @param url
   * @param product
   */
  handleFoundProductFromCard(url: string, product: ListingProductInfo): number {
    if (this.productInfos.has(url)) {
      return this.productInfos.get(url)!.popularityIndex;
    }

    product.popularityIndex = this.productInfos.size + 1;
    this.productInfos.set(url, product);
    return product.popularityIndex;
  }

  /**
   * Performs one sweep through the page towards the bottom.
   *
   * This method should be overrided for infinite scroll sources such as homeroom
   * @param ctx
   */
  async scrollToBottom(ctx: PlaywrightCrawlingContext) {
    const page = ctx.page;

    const startY = await page.evaluate(async () => {
      return window.scrollY + window.innerHeight;
    });

    const scrollHeight = await page.evaluate(() => document.body.scrollHeight);

    for (
      let currentScrollY = startY;
      currentScrollY < scrollHeight;
      currentScrollY += 500
    ) {
      await page.evaluate(
        (scrollPosition: number) => window.scrollTo(0, scrollPosition),
        currentScrollY
      );
      await new Promise((f) => setTimeout(f, 200));

      if (this.crawlerOptions.dynamicProductCardLoading) {
        await this.registerProductCards(ctx);
      }
    }

    // Scroll slightly up. This is needed to avoid the view staying at the bottom after new elements are loaded
    // for infinite scroll pages
    await page.evaluate(() =>
      window.scrollTo(
        0,
        document.body.scrollHeight - (window.innerHeight + 100)
      )
    );
  }

  async registerProductCards(ctx: PlaywrightCrawlingContext) {
    const page = ctx.page;
    const enqueueLinks = ctx.enqueueLinks;

    if (!this.productCardSelector) {
      log.info("Category crawling not enabled, skipping");
      return;
    }

    const productCardSelector = this.productCardSelector;
    const articlesLocator = page.locator(productCardSelector);
    const articlesCount = await articlesLocator.count();
    for (let j = 0; j < articlesCount; j++) {
      const currentProductCard = articlesLocator.nth(j);

      const currentProductInfo = await this.extractCardProductInfo(
        page.url(),
        currentProductCard
      );

      if (!currentProductInfo) {
        // if category crawling is disabled for this scraper, we should not reach this point
        // check that `productCardSelector` is undefined
        log.error(
          `Could not extract product info from card ${j} on page ${page.url()}`
        );
        continue;
      }

      if (currentProductInfo.url.startsWith("/")) {
        const currentUrl = new URL(page.url());

        currentProductInfo.url = `${currentUrl.protocol}//${currentUrl.host}${currentProductInfo.url}`;
      }
      currentProductInfo.url = new URL(currentProductInfo.url).href; // encode the url

      const pageNumber = ctx.request.userData.pageNumber;
      if (pageNumber && this.categoryPageSize) {
        currentProductInfo.popularityIndex =
          (pageNumber - 1) * this.categoryPageSize + j + 1;
      } else {
        currentProductInfo.popularityIndex = this.handleFoundProductFromCard(
          currentProductInfo.url,
          currentProductInfo
        );
      }

      await enqueueLinks({
        urls: [currentProductInfo.url],
        label: "DETAIL",
        userData: currentProductInfo,
      });
    }
  }

  async extractProperty(
    rootElement: Locator | Page,
    path: string,
    extractor: (node: Locator) => Promise<string | null | undefined>
  ): Promise<string | undefined> {
    const tag = await rootElement.locator(path);
    const elementExists = (await tag.count()) > 0;
    if (!elementExists) {
      return undefined;
    }

    const intermediateResult: string | null | undefined = tag
      ? await extractor(tag)
      : null;
    return intermediateResult !== null ? intermediateResult : undefined;
  }

  async extractImageFromSrcSet(node: Locator): Promise<string | null> {
    const srcset = await node.getAttribute("srcset");
    if (!srcset) {
      return null;
    }
    return srcset.split(",")[0].split(" ")[0];
  }

  async handleCookieConsent(page: Page): Promise<void> {
    if (this.crawlerOptions.cookieConsentSelector === undefined) {
      return;
    }

    await AbstractCrawlerDefinition.clickOverlayButton(
      page,
      this.crawlerOptions.cookieConsentSelector
    );
  }

  static async clickOverlayButton(
    page: Page,
    buttonSelector: string
  ): Promise<boolean> {
    const button = page.locator(buttonSelector).first();
    const buttonVisible = await button.isVisible();
    if (buttonVisible) {
      await button.click();
      return true;
    }
    return false;
  }

  async extractCategoryTree(
    breadcrumbLocator: Locator,
    startIndex: number = 0
  ): Promise<Category[]> {
    const breadcrumbCount = await breadcrumbLocator.count();
    const categoryTree = [];
    for (let i = startIndex; i < breadcrumbCount; i++) {
      const name = (<string>(
        await breadcrumbLocator.nth(i).textContent()
      )).trim();
      const url = <string>await breadcrumbLocator
        .nth(i)
        .getAttribute("href")
        .then((url) => {
          if (url?.endsWith("/")) {
            return url?.slice(0, -1);
          }
          return url;
        });

      categoryTree.push({
        name,
        url,
      });
    }

    return categoryTree;
  }

  /**
   * Extracts the information about a product from a product card.
   *
   * It is specific to each source, and should be implemented in a specific class.
   *
   * @param categoryUrl
   * @param productCard
   */
  abstract extractCardProductInfo(
    categoryUrl: string,
    productCard: Locator
  ): Promise<ListingProductInfo | undefined>;

  get router(): RouterHandler<PlaywrightCrawlingContext> {
    return this._router;
  }

  get detailsDataset(): Dataset {
    return this._detailsDataset;
  }

  async extractSchemaOrgFromAttributes(
    page: Page
  ): Promise<{ [key: string]: any }> {
    const schemaOrgProduct = await page.locator(
      '//*[@itemtype="http://schema.org/Product"]'
    );

    const propsLocator = schemaOrgProduct.locator("//*[@itemprop]");

    return await propsLocator.evaluateAll((nodes) => {
      return nodes
        .map((node) => {
          let content = node.getAttribute("content");
          let prop = node.getAttribute("itemprop") as string;

          if (!content) {
            content = node.textContent;
          }
          return {
            [prop]: content,
          };
        })
        .reduce((acc, curr) => ({ ...acc, ...curr }), {});
    });
  }

  static async openDatasets(): Promise<[Dataset, Dataset]> {
    // Open a new dataset with unique name (using uuidv4) so that
    // each scraper instance has its own queue.
    const detailsDataset = await Dataset.open(
      "__CRAWLEE_TEMPORARY_detailsDataset_" + uuidv4()
    );
    const listingDataset = await Dataset.open(
      "__CRAWLEE_TEMPORARY_listingDataset_" + uuidv4()
    );

    return [detailsDataset, listingDataset];
  }
}

export abstract class AbstractCrawlerDefinitionWithVariants extends AbstractCrawlerDefinition {
  protected constructor(options: CrawlerDefinitionOptions) {
    super(options);
    const crawlerDefinition = this;
    this._router.addHandler("VARIANT", (_) =>
      crawlerDefinition.crawlVariant(_)
    );
  }

  override async crawlDetailPage(
    ctx: PlaywrightCrawlingContext
  ): Promise<void> {
    await this.crawlDetailPageWithVariantsLogic(ctx);
  }

  async crawlDetailPageWithVariantsLogic(
    ctx: PlaywrightCrawlingContext
  ): Promise<void> {
    if (this.launchOptions?.ignoreVariants) {
      return await this.crawlDetailPageNoVariantExploration(ctx);
    }

    const variantGroupUrl = ctx.page.url();

    console.log("Starting variant exploration... from url: ", variantGroupUrl);
    await this.exploreVariantsSpace(ctx, 0, [], variantGroupUrl);
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
    const variantIndex = ctx.request.userData.variantIndex;
    const variantGroupUrl = ctx.request.userData.variantGroupUrl;
    try {
      await this.crawlSingleDetailPage(ctx, variantGroupUrl, variantIndex);
    } catch (error) {
      if (error instanceof Error) log.warning(error.message);
      // Ignore this variant and continue to scraper other variances
    }
  }

  async crawlSingleDetailPage(
    ctx: PlaywrightCrawlingContext,
    variantGroupUrl: string,
    variant: number
  ): Promise<void> {
    const productDetails = await this.extractProductDetails(ctx.page);
    const request = ctx.request;

    await this._detailsDataset.pushData(<DetailedProductInfo>{
      fetchedAt: new Date().toISOString(),
      retailerDomain: extractRootUrl(ctx.page.url()),
      ...request.userData,
      ...productDetails,
      variantGroupUrl: variantGroupUrl,
      variant: variant,
    });
  }

  async crawlDetailPageNoVariantExploration(
    ctx: PlaywrightCrawlingContext
  ): Promise<void> {
    let isSelectionApplied = true;
    let currentParamIndex = 0;
    do {
      let paramExists =
        (await this.getOptionsForParamIndex(ctx, currentParamIndex)) > 0;
      if (!paramExists) {
        break;
      }

      let hasSelectedOption = await this.hasSelectedOptionForParamIndex(
        ctx,
        currentParamIndex
      );
      if (!hasSelectedOption) {
        isSelectionApplied = false;
        break;
      }
      currentParamIndex++;
    } while (true);

    if (!isSelectionApplied) {
      const pageState = {
        url: ctx.page.url(),
      };
      // When no parameters are selected, we ended up at the variantGroupUrl because of the hacky solution.
      // Then we start exploring the variants space, but we stop after the first variant
      await this.exploreVariantsSpace(
        ctx,
        0,
        [],
        ctx.page.url(),
        0,
        pageState,
        1
      );
    } else {
      // Avoid index 0, because that changes the URL to the variantGroupUrl. (HACKY Bygghemma solution)
      await this.crawlSingleDetailPage(ctx, ctx.page.url(), 1);
    }
  }

  /**
   * Depth first exploration of the variants space.
   *
   * @param ctx
   * @param parameterIndex
   * @param currentOption
   * @param variantGroupUrl
   * @param exploredVariants
   * @param pageState
   * @param limit
   */
  async exploreVariantsSpace(
    ctx: PlaywrightCrawlingContext,
    parameterIndex: number,
    currentOption: number[],
    variantGroupUrl: string,
    exploredVariants: number = 0,
    pageState?: any,
    limit?: number
  ): Promise<[any, number]> {
    if (!pageState) {
      pageState = { url: variantGroupUrl };
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
            variantGroupUrl: variantGroupUrl,
            label: "VARIANT",
          },
        });
      } else {
        ctx.request.userData = {
          ...ctx.request.userData,
          variantIndex: 0,
          variantGroupUrl: variantGroupUrl,
        };
        await this.crawlVariant(ctx);
      }

      return [newPageState, 1];
    }

    let exploredSubBranches = 0;
    for (let optionIndex = 0; optionIndex < optionsCount; optionIndex++) {
      try {
        await this.selectOptionForParamIndex(ctx, parameterIndex, optionIndex);
      } catch (e) {
        log.warning(
          "Option became unavailable, switching to product group page"
        );
        await ctx.page.goto(variantGroupUrl, { waitUntil: "domcontentloaded" });
        // select the state previous to the change
        for (let i = 0; i < currentOption.length; i++) {
          await this.selectOptionForParamIndex(ctx, i, currentOption[i]);
        }
        try {
          await this.selectOptionForParamIndex(
            ctx,
            parameterIndex,
            optionIndex
          );
        } catch (e) {
          log.warning(
            "Serious, option still unavailable from group page, skipping"
          );
          continue;
        }
      }

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
          variantGroupUrl,
          exploredVariants,
          pageState
        );
      exploredSubBranches += exploredOnSubBranch;
      exploredVariants += exploredOnSubBranch;
      if (limit && exploredVariants >= limit) {
        return [newPageState, exploredVariants];
      }
      pageState = newPageState;
    }
    return [pageState, exploredSubBranches];
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

  abstract selectOptionForParamIndex(
    _: PlaywrightCrawlingContext,
    paramIndex: number,
    optionIndex: number
  ): Promise<void>;

  abstract hasSelectedOptionForParamIndex(
    _: PlaywrightCrawlingContext,
    paramIndex: number
  ): Promise<boolean>;

  abstract getOptionsForParamIndex(
    _: PlaywrightCrawlingContext,
    paramIndex: number
  ): Promise<number>;

  abstract checkInvalidVariant(
    _: PlaywrightCrawlingContext,
    currentOption: number[]
  ): Promise<boolean>;
}

export abstract class AbstractCheerioCrawlerDefinition
  implements CrawlerDefinition<CheerioCrawlingContext>
{
  protected readonly _router: RouterHandler<CheerioCrawlingContext>;
  protected readonly _detailsDataset: Dataset;

  protected constructor(options: CheerioCrawlerDefinitionOptions) {
    this._router = createCheerioRouter();
    this._router.addHandler("DETAIL", (ctx) => this.crawlDetailPage(ctx));

    this._detailsDataset = options.detailsDataset;
  }

  async crawlDetailPage(ctx: CheerioCrawlingContext): Promise<void> {
    log.info(`Looking at product with url ${ctx.request.url}`);
    const productDetails = this.extractProductDetails(ctx);

    const request = ctx.request;

    await this._detailsDataset.pushData(<DetailedProductInfo>{
      fetchedAt: new Date().toISOString(),
      retailerDomain: extractRootUrl(ctx.request.url),
      ...request.userData,
      ...productDetails,
    });
  }

  abstract extractProductDetails(
    ctx: CheerioCrawlingContext
  ): DetailedProductInfo;

  get detailsDataset(): Dataset {
    return this._detailsDataset;
  }

  get router(): RouterHandler<CheerioCrawlingContext> {
    return this._router;
  }
}
