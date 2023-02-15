import {
  CheerioCrawlingContext,
  CrawlingContext,
  createCheerioRouter,
  createPlaywrightRouter,
  Dataset,
  log,
  PlaywrightCrawlingContext,
  RequestOptions,
  Router,
  RouterHandler,
} from "crawlee";
import { Locator, Page } from "playwright";
import {
  Category,
  DetailedProductInfo,
  ListingProductInfo,
} from "../types/offer";
import { appendObjectToFile, extractRootUrl } from "../utils";
import { v4 as uuidv4 } from "uuid";
import { createHash } from "crypto";
import { CategoryLabel } from "../types/categories";

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
  detailsUrlSelector: string;

  /**
   * Selector for next pages within the product listing / category
   */
  listingUrlSelector?: string;

  /**
   * Selector for individual product cards to be scraped for information available as part of the listings
   */
  productCardSelector: string;

  /**
   * Selector for the cookie consent button
   */
  cookieConsentSelector?: string;

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

  /**
   * Take a screenshot of the page
   */
  takeScreenshot?: boolean;
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

  protected readonly detailsUrlSelector: string;
  protected readonly listingUrlSelector?: string;
  protected readonly productCardSelector: string;
  protected readonly cookieConsentSelector?: string;
  protected readonly dynamicProductCardLoading: boolean;
  protected readonly launchOptions?: CrawlerLaunchOptions;

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

    this.detailsUrlSelector = options.detailsUrlSelector;
    this.listingUrlSelector = options.listingUrlSelector;
    this.productCardSelector = options.productCardSelector;
    this.cookieConsentSelector = options.cookieConsentSelector;
    this.dynamicProductCardLoading = options.dynamicProductCardLoading ?? true;
    this.launchOptions = options?.launchOptions;

    this.productInfos = new Map<string, ListingProductInfo>();
  }

  /**
   * Get details about an individual product by looking at the product page
   *
   * This method also saves to a crawlee `Dataset`. In the future it has to save to an external storage like firestore
   * @param ctx
   */
  async crawlDetailPage(ctx: PlaywrightCrawlingContext): Promise<void> {
    log.info(`Looking at product with url ${ctx.page.url()}`);

    if (this.launchOptions?.takeScreenshot) {
      await ctx.page.screenshot({
        path: `./screenshots/${createHash("sha256")
          .update(ctx.page.url())
          .digest("hex")}.png`,
        fullPage: true,
      });
    }

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
    await ctx.page.locator(this.productCardSelector).nth(0).waitFor();

    await this.scrollToBottom(ctx);

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

      if (this.dynamicProductCardLoading) {
        await this.registerProductCards(ctx);
      }
    }
    await this.registerProductCards(ctx);

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

    const productCardSelector = this.productCardSelector;
    const detailsUrlSelector = this.detailsUrlSelector;
    const articlesLocator = page.locator(productCardSelector);
    const articlesCount = await articlesLocator.count();
    for (let j = 0; j < articlesCount; j++) {
      const currentProductCard = articlesLocator.nth(j);

      const currentProductInfo = await this.extractCardProductInfo(
        page.url(),
        currentProductCard
      );

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
    extractor: (node: Locator) => Promise<string | null>,
    categoryLabel?: CategoryLabel
  ): Promise<string | undefined> {
    const tag = await rootElement.locator(path);
    const elementExists = (await tag.count()) > 0;
    if (!elementExists) {
      return undefined;
    }

    if (categoryLabel && (rootElement as Page).url) {
      const handles = await tag.elementHandles();
      for (const handle of handles) {
        const box = await handle.boundingBox();
        if (!box) continue;
        const id = createHash("sha256")
          .update((rootElement as Page).url())
          .digest("hex");
        appendObjectToFile("bounding-boxes.json", {
          image_id: `${id}.png`,
          category_id: categoryLabel,
          bbox: [box.x, box.y, box.width, box.height],
          id: id,
        });
      }
    }

    const intermediateResult: string | null = tag ? await extractor(tag) : null;
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
    if (this.cookieConsentSelector === undefined) {
      return;
    }

    const cookieConsentButton = page
      .locator(this.cookieConsentSelector)
      .first();
    const receivedCookieConsent = await cookieConsentButton.isVisible();
    if (receivedCookieConsent) {
      await cookieConsentButton.click();
    }
  }

  async extractCategoryTree(
    breadcrumbLocator: Locator,
    startingIndex: number = 0
  ): Promise<Category[]> {
    const breadcrumbCount = await breadcrumbLocator.count();
    const categoryTree = [];
    for (let i = startingIndex; i < breadcrumbCount; i++) {
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
  ): Promise<ListingProductInfo>;

  get router(): RouterHandler<PlaywrightCrawlingContext> {
    return this._router;
  }

  get detailsDataset(): Dataset {
    return this._detailsDataset;
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
