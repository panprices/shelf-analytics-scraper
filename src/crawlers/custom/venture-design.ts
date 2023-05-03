import {
  AbstractCrawlerDefinition,
  AbstractCrawlerDefinitionWithVariants,
  CrawlerLaunchOptions,
} from "../abstract";
import { Locator, Page } from "playwright";
import { DetailedProductInfo, ListingProductInfo } from "../../types/offer";
import { log, PlaywrightCrawlingContext } from "crawlee";
import { extractDomainFromUrl } from "../../utils";

export class VentureDesignCrawlerDefinition extends AbstractCrawlerDefinitionWithVariants {
  override async crawlListPage(ctx: PlaywrightCrawlingContext): Promise<void> {
    const emptyPageLocator = ctx.page.locator(".coming-soon-title");
    try {
      await emptyPageLocator.waitFor({ state: "visible", timeout: 500 });
      const emptyPage = await emptyPageLocator.isVisible();
      if (emptyPage) {
        log.warning(`Empty category page: ${ctx.page.url()}`);
        return;
      }
    } catch (e) {
      log.info(`Not an empty page: ${ctx.page.url()}`);
    }

    return super.crawlListPage(ctx);
  }

  /**
   * Pagination for venture design is implemented with events in SPA (Single Page Framework) so we can't collect the
   * urls to the next pages.
   *
   * Instead, we overwrite the scrolling function to click the button for the next page when we reach the bottom
   * @param ctx
   */
  override async scrollToBottom(ctx: PlaywrightCrawlingContext): Promise<void> {
    const page = ctx.page;

    const waitForInfiniteScrollTimeout = 10000;
    let startTime, timeElapsed;
    let pageExpanded = false;

    do {
      const pageHeight = await page.evaluate(
        async () => document.body.offsetHeight
      );

      await super.scrollToBottom(ctx);
      await new Promise((f) => setTimeout(f, 1000));

      // Scroll up to trigger the next page load:
      startTime = Date.now();
      do {
        timeElapsed = Date.now() - startTime;
        for (let i = 1; i <= 4; i++) {
          await page.evaluate(
            (i) => window.scrollTo(0, document.body.scrollHeight - i * 600),
            i
          );
          await page.waitForTimeout(500);
        }

        const newPageHeight = await page.evaluate(
          async () => document.body.offsetHeight
        );
        pageExpanded = newPageHeight > pageHeight;
      } while (!pageExpanded && timeElapsed < waitForInfiniteScrollTimeout);

      if (!pageExpanded) {
        break;
      }
    } while (true);
  }

  async extractCardProductInfo(
    categoryUrl: string,
    productCard: Locator
  ): Promise<ListingProductInfo> {
    const price = 0;
    const currency = "unavailable";

    const name = <string>(
      await this.extractProperty(productCard, "h4", (node) =>
        node.textContent()
      )
    );
    const previewImageUrl = <string>(
      await this.extractProperty(productCard, "xpath=(.//img)[1]", (node) =>
        node.getAttribute("src")
      )
    );
    const url = <string>(
      await this.extractProperty(productCard, "xpath=(.//a)[1]", (node) =>
        node.getAttribute("href")
      )
    );
    return {
      name,
      categoryUrl,
      price,
      currency,
      popularityIndex: -1,
      previewImageUrl,
      url,
      isDiscounted: false,
    };
  }

  async extractImagesNoScrollSlider(page: Page): Promise<string[]> {
    const slideLocator = page.locator(".slide");
    await slideLocator.nth(0).waitFor();

    const images = [];
    const slideCount = await slideLocator.count();

    const fullImageUrl = <string>(
      await this.extractProperty(
        page,
        "div.article-detail-image >> div.v-thumb >> img",
        (node) => node.getAttribute("src")
      )
    );
    images.push(fullImageUrl);

    for (let i = 1; i < slideCount; i++) {
      await slideLocator.nth(i).click();

      const fullImageUrl = <string>(
        await this.extractProperty(
          page,
          "div.article-detail-image >> div.v-thumb >> img",
          (node) => node.getAttribute("src")
        )
      );
      images.push(fullImageUrl);
    }

    return images;
  }

  async extractImagesWithInfiniteScrollSlider(page: Page): Promise<string[]> {
    const previewImageSet = new Set<string>();
    const sliderLocator = page.locator(
      "//div[contains(@class, 'article-detail-image')]//div[contains(@class, 'slick-active')]//img"
    );
    await sliderLocator.nth(0).waitFor();

    const images = [];
    while (true) {
      let allPicturesSeen = true;
      const visiblePicturesCount = await sliderLocator.count();
      for (let i = 0; i < visiblePicturesCount; i++) {
        const currentImageLocator = sliderLocator.nth(i);
        const identifier = <string>(
          await currentImageLocator.getAttribute("src")
        );
        if (previewImageSet.has(identifier)) {
          continue;
        }

        allPicturesSeen = false;
        previewImageSet.add(identifier);

        await currentImageLocator.locator("xpath=..").click();
        // await new Promise(f => setTimeout(f, 500))

        const fullImageUrl = <string>(
          await this.extractProperty(
            page,
            "div.article-detail-image >> div.v-thumb >> img",
            (node) => node.getAttribute("src")
          )
        );
        images.push(fullImageUrl);
      }

      if (allPicturesSeen) {
        break;
      }

      const arrowSelector = page.locator(
        "div.article-detail-image >> button.slick-next"
      );
      await arrowSelector.click();
    }
    return images;
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    let oneImageOnly = false;
    await page
      .locator("div.v-slider")
      .waitFor({ timeout: 5000 })
      .catch((_) => {
        log.warning("Product only shows one image");
        oneImageOnly = true;
      });

    let images: string[];
    if (oneImageOnly) {
      const imageUrl = <string>(
        await this.extractProperty(page, "div.v-thumb >> img", (node) =>
          node.getAttribute("src")
        )
      );
      images = [imageUrl];
    } else {
      const scrollButtonLocator = page.locator("button.slick-next");
      const useInfiniteScrollStrategy = await scrollButtonLocator.isVisible();

      images = useInfiniteScrollStrategy
        ? await this.extractImagesWithInfiniteScrollSlider(page)
        : await this.extractImagesNoScrollSlider(page);
    }
    const description = <string>(
      await this.extractProperty(
        page,
        "//div[contains(@class, 'container') " +
          "and contains(./div[contains(@class, 'label')]/text(), 'BESKRIVNING')]/div[contains(@class, 'content')]",
        (node) => node.textContent()
      )
    );
    const breadcrumbLocator = page.locator("div.breadcrumb-container >> a");
    const categoryTree = await this.extractCategoryTree(breadcrumbLocator, 1);
    const name = <string>(
      await this.extractProperty(
        page,
        "//div[contains(@class, 'article-detail-text')]//h1[1]",
        (node) => node.textContent().then((s) => s!.trim())
      )
    );

    const specifications = page.locator(
      "//div[contains(@class, 'container') " +
        "and contains(./div[contains(@class, 'label')]/text(), 'MER INFORMATION')]/div[contains(@class, 'content')]//tr"
    );
    const specificationsCount = await specifications.count();
    const specArray = [];
    for (let i = 0; i < specificationsCount; i++) {
      const specLocator = specifications.nth(i);
      const specKey = <string>(
        await specLocator.locator("xpath=.//td[1]").textContent()
      );
      const specValue = <string>(
        await specLocator.locator("xpath=.//td[2]").textContent()
      );

      specArray.push({
        key: specKey,
        value: specValue,
      });
    }

    const gtin = await this.extractProperty(
      page,
      "//div[./h6/text() = 'GTIN:']/span",
      (node) => node.textContent().then((s) => s!.trim())
    );

    const sku = await this.extractProperty(
      page,
      "//div[./h6/text() = 'Artikelnr:']/span",
      (node) => node.textContent().then((s) => s!.trim())
    );

    return {
      images,
      url: page.url(),
      // price,
      // currency,
      isDiscounted: false,
      description,
      availability: "out_of_stock",
      // reviews,
      specifications: specArray,
      categoryTree,
      name,

      gtin,
      sku,
      mpn: sku,
    };
  }

  override async crawlIntermediateCategoryPage(
    ctx: PlaywrightCrawlingContext
  ): Promise<void> {
    /* Entry point:
      "https://www.venturedesign.se/innemobler",
      "https://www.venturedesign.se/utemobler",
      "https://www.venturedesign.se/nyheter",
    */

    // If in top level category, enqueue subcategories
    await ctx.enqueueLinks({
      selector: ".categories-with-icons-item a",
      label: "INTERMEDIATE_CATEGORY",
    });

    try {
      await this.enqueueSubCategoryLinks(ctx);
    } catch (e) {
      log.warning("No subcategories found", { url: ctx.page.url() });
    }
  }

  /**
   * Enqueues subcategory links
   * Example page: https://www.venturedesign.se/utemobler/loungegrupper
   */
  async enqueueSubCategoryLinks(ctx: PlaywrightCrawlingContext) {
    const rootUrl = new URL(ctx.page.url()).origin;
    const subCategoriesIdentifier =
      "//div[contains(@class, 'subcategories')]/a";

    await ctx.page
      .locator(subCategoriesIdentifier)
      .nth(0)
      .waitFor({ timeout: 15000 });

    const subCategoriesLocator = ctx.page.locator(subCategoriesIdentifier);
    const subCategoriesCount = await subCategoriesLocator.count();
    const subCategoriesUrlPromises = await [
      ...Array(subCategoriesCount).keys(),
    ].map((i) => {
      const currentSubCategory = subCategoriesLocator.nth(i);
      return currentSubCategory.getAttribute("href");
    });

    const subCategoryUrls = await Promise.all(subCategoriesUrlPromises);

    const isLeafCategory = subCategoryUrls
      .map((u) => `${rootUrl}${u}`)
      .some((u) => ctx.page.url() == u);

    if (isLeafCategory) {
      await ctx.enqueueLinks({
        urls: [ctx.page.url()],
        label: "LIST",
      });
    } else {
      await ctx.enqueueLinks({
        selector: subCategoriesIdentifier,
        label: "INTERMEDIATE_CATEGORY",
      });
    }
  }

  override async crawlDetailPage(
    ctx: PlaywrightCrawlingContext
  ): Promise<void> {
    // The group URL is also the first variant so we scrape it
    await this.crawlSingleDetailPage(ctx, ctx.page.url(), 0);

    const hasVariants = (await this.getOptionsForParamIndex(ctx, 0)) > 0;
    if (hasVariants) {
      await super.crawlDetailPage(ctx);
    }
  }

  override async selectOptionForParamIndex(
    ctx: PlaywrightCrawlingContext,
    paramIndex: number,
    optionIndex: number
  ) {
    const selector = ctx.page.locator(".row-dimensions select").nth(paramIndex);
    await selector.selectOption({ index: optionIndex });
  }

  override async hasSelectedOptionForParamIndex(
    _: PlaywrightCrawlingContext,
    __: number
  ): Promise<boolean> {
    // There is always a selected option, there is no "group product" in Venture Design
    return true;
  }

  override async getOptionsForParamIndex(
    ctx: PlaywrightCrawlingContext,
    paramIndex: number
  ): Promise<number> {
    return await ctx.page
      .locator(".row-dimensions select")
      .nth(paramIndex)
      .locator("option")
      .count();
  }

  override async checkInvalidVariant(
    _: PlaywrightCrawlingContext,
    __: number[]
  ): Promise<boolean> {
    // Impossible for Venture Design to have invalid variants
    return false;
  }

  static async create(
    launchOptions?: CrawlerLaunchOptions
  ): Promise<VentureDesignCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets();
    return new VentureDesignCrawlerDefinition({
      detailsDataset,
      listingDataset,
      detailsUrlSelector: "article.article >> a",
      productCardSelector: "article.article",
      launchOptions,
    });
  }
}
