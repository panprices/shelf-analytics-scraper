import { Locator, Page } from "playwright";
import { Dictionary, log, PlaywrightCrawlingContext } from "crawlee";

import { AbstractCrawlerDefinition, CrawlerLaunchOptions } from "../abstract";
import {
  Category,
  DetailedProductInfo,
  IndividualReview,
  ListingProductInfo,
  OfferMetadata,
  ProductReviews,
  SchemaOrg,
  Specification,
} from "../../types/offer";
import {
  createCrawlerDefinitionOption,
  extractCardProductInfo as baseExtractCardProductInfo,
  extractProductDetails as baseExtractProductDetails,
  getVariantUrlsFromSchemaOrg,
  isProductPage,
} from "./base-chill";
import { extractDomainFromUrl } from "../../utils";

export class FurnitureboxCrawlerDefinition extends AbstractCrawlerDefinition {
  async extractCardProductInfo(
    categoryUrl: string,
    productCard: Locator
  ): Promise<ListingProductInfo> {
    return baseExtractCardProductInfo(this, categoryUrl, productCard);
  }

  override async crawlDetailPage(
    ctx: PlaywrightCrawlingContext
  ): Promise<void> {
    await super.crawlDetailPage(ctx);

    if (this.launchOptions?.ignoreVariants) {
      return;
    }
    if (!isProductPage(ctx.page.url())) {
      return;
    }

    // Enqueue the variant groups where you have a.href:
    await ctx.enqueueLinks({
      selector: "div#possibleVariants a",
      label: "DETAIL",
      userData: ctx.request.userData,
    });
    await ctx.enqueueLinks({
      selector: "div#variantPropertySelectors a",
      label: "DETAIL",
      userData: ctx.request.userData,
    });

    // Enqueue variants from schema.org:
    const variantUrls = await getVariantUrlsFromSchemaOrg(ctx.page);
    if (variantUrls) {
      await ctx.enqueueLinks({
        urls: variantUrls,
        label: "DETAIL",
        userData: ctx.request.userData,
      });
    }

    // DEPRECATED: Check for secondary variant group where you don't have a.href.
    // This was implemented before we use getVariantUrlsFromSchemaOrg.
    // Still keep it here in case we need to use it again, since Toan has
    // found a case where schema.org doesn't give us all variants.
    // See this for example: https://www.furniturebox.se/mobler/koksmobler/matstolar/altea-matstol-manchester-gra-p338053

    // NOTE: beware of performance issues with this. Since we have to click
    // buttons to open variant groups to know the url, we have to click a lot.
    // For example if there are 4 variants -> have to click
    // 4 variant pages * 3 choose-other-variant-buttons  = 12 times

    // const secondaryVariantOpenMenuButton = ctx.page.locator(
    //   "div#productIncludedAddonsBlock div[role='button']"
    // );
    // const secondaryVariantButtons = ctx.page.locator(
    //   "div.PJfd6 button[data-cy='selector_option_button']"
    // );

    // if ((await secondaryVariantOpenMenuButton.count()) > 0) {
    //   console.log(
    //     "Open menu button" + (await secondaryVariantOpenMenuButton.count())
    //   );
    //   // Click the menu button to open the menu:
    //   await secondaryVariantOpenMenuButton.first().click();
    //   await ctx.page.waitForTimeout(1500);

    //   const secondaryVariantButtonsCount =
    //     await secondaryVariantButtons.count();
    //   console.log("Secondary Count: " + secondaryVariantButtonsCount);
    //   for (let i = 0; i < secondaryVariantButtonsCount; i++) {
    //     if (i > 0) {
    //       // Click the menu button to open the menu again:
    //       await secondaryVariantOpenMenuButton.first().click();
    //       await ctx.page.waitForTimeout(1500);
    //     }
    //     await secondaryVariantButtons.nth(i).click();
    //     await ctx.page.waitForTimeout(1500);

    //     await ctx.enqueueLinks({
    //       urls: [ctx.page.url()],
    //       label: "DETAIL",
    //       userData: ctx.request.userData,
    //     });
    //   }
    // }
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
        "//main//div[contains(@class, 'ac') and .//span/text()='Specifikationer']//div//span[contains(@class, 'lh')]"
      );
      articleNumber = await this.extractProperty(
        page,
        "//main//div[contains(@class, 'ac') and .//span/text()='Specifikationer']//div//span[contains(@class, 'lh')]",
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

  /**
   * Crawl category page for subCategoryUrls.
   *
   * 2 methods are used to identify a leaf category page: either
   * (1) cannot find any sub-category link to scrape, or
   * (2) the current page is also a
   *
   * For (1), see this page: https://www.furniturebox.se/forvaring/smaforvaring/forvaringslada?kampanj
   * For (2), see this page: https://www.furniturebox.se/mobler/vardagsrumsmobler/vardagsrumsbord/soffbord
   */
  override async crawlIntermediateCategoryPage(
    ctx: PlaywrightCrawlingContext
  ): Promise<void> {
    const rootUrl = extractDomainFromUrl(ctx.page.url());
    const subCategoriesSelector = "div#toggleCategoriesSlider a";

    // Wait for page to load:
    try {
      await ctx.page
        .locator(subCategoriesSelector)
        .nth(0)
        .waitFor({ timeout: 10000 });
    } catch {
      // Probably a top level category instead -> scrape it specially:
      if (await isTopLevelCategoryPage(ctx.page)) {
        await this.crawlTopLevelCategoryPage(ctx);
        return;
      }
      // Else: is a leaf category page -> save the category url
      await ctx.enqueueLinks({
        urls: [ctx.page.url()],
        label: "LIST",
      });
    }

    const subCategoriesLocator = ctx.page.locator(subCategoriesSelector);
    const subCategoriesCount = await subCategoriesLocator.count();
    const subCategoriesUrlPromises = [...Array(subCategoriesCount).keys()].map(
      (i) => {
        const currentSubCategory = subCategoriesLocator.nth(i);
        return currentSubCategory.getAttribute("href");
      }
    );

    const subCategoryUrls = (
      await Promise.all(subCategoriesUrlPromises)
    ).filter((url) => !url?.includes("?kampanj"));

    const isLeafCategory = subCategoryUrls
      .map((u) => `${rootUrl}${u}`)
      .some((u) => ctx.page.url() === u);

    if (isLeafCategory) {
      // Save the category url
      await ctx.enqueueLinks({
        urls: [ctx.page.url()],
        label: "LIST",
      });
    } else {
      // Fetch recursively
      await ctx.enqueueLinks({
        selector: subCategoriesSelector,
        label: "INTERMEDIATE_CATEGORY",
      });
    }
  }

  /**
   * Scrape sub-categories of top level category page.
   *
   * The top level category page is a bit different in CSS selector compared to
   * 2nd levels and beyond.
   *
   * For example, see https://www.furniturebox.se/mobler
   * vs https://www.furniturebox.se/mobler/bord
   */
  async crawlTopLevelCategoryPage(
    ctx: PlaywrightCrawlingContext
  ): Promise<void> {
    const subCategoriesIdentifier = "div#subCategories a";
    // Wait for page to load:
    await ctx.page
      .locator(subCategoriesIdentifier)
      .nth(0)
      .waitFor({ timeout: 5000 });

    await ctx.enqueueLinks({
      selector: subCategoriesIdentifier,
      label: "INTERMEDIATE_CATEGORY",
    });
  }

  static async create(
    launchOptions: CrawlerLaunchOptions
  ): Promise<FurnitureboxCrawlerDefinition> {
    const options = await createCrawlerDefinitionOption(launchOptions);
    // Next page buttons are dynamically rendered, so we need to scroll slower
    options.dynamicProductCardLoading = true;

    return new FurnitureboxCrawlerDefinition({ ...options, launchOptions });
  }
}

async function isTopLevelCategoryPage(page: Page) {
  const subCategoriesIdentifier = "div#subCategories a";
  // Wait for page to load:
  try {
    await page
      .locator(subCategoriesIdentifier)
      .nth(0)
      .waitFor({ timeout: 5000 });
  } catch {
    // Cannot find subCategoriesIdentifier -> not TopLevelCategory
    return false;
  }

  return true;
}

async function extractImagesFromProductPage(page: Page): Promise<string[]> {
  const imageThumbnailLocator = page.locator("main div.fo div.a0g img");

  try {
    await imageThumbnailLocator.waitFor({ timeout: 10000 });
  } catch (e) {
    // Probably no images thumbnails -> do nothing and just scrape the main image
  }

  const imagesCount = await imageThumbnailLocator.count();
  for (let i = 0; i < imagesCount; i++) {
    const currentThumbnail = imageThumbnailLocator.nth(i);
    await currentThumbnail.click();
    await page.waitForTimeout(50);
  }
  const images = await page
    .locator("main div.fo div.d4 img")
    .evaluateAll((list: HTMLElement[]) =>
      list.map((element) => <string>element.getAttribute("src"))
    );

  return images;
}
