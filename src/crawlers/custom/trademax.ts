import {
  AbstractCrawlerDefinition,
  AbstractCrawlerDefinitionWithVariants,
  CrawlerDefinitionOptions,
  CrawlerLaunchOptions,
  VariantCrawlingStrategy,
} from "../abstract.js";
import { Locator, Page } from "playwright";
import { Dictionary, log, PlaywrightCrawlingContext } from "crawlee";
import {
  DetailedProductInfo,
  IndividualReview,
  ListingProductInfo,
  OfferMetadata,
  ProductReviews,
  Specification,
} from "../../types/offer.js";
import {
  extractCardProductInfo as baseExtractCardProductInfo,
  createCrawlerDefinitionOption,
  extractImageFromProductPage,
} from "./base-chill.js";
import { TrademaxErrorAssertion } from "../../error-handling/detail-error-assertion/trademax.js";
import { findElementByCSSProperties } from "../scraper-utils.js";

export class TrademaxCrawlerDefinition extends AbstractCrawlerDefinitionWithVariants {
  protected override categoryPageSize: number = 36;

  constructor(
    options: CrawlerDefinitionOptions,
    variantCrawlingStrategy: VariantCrawlingStrategy
  ) {
    super(options, variantCrawlingStrategy);

    this.__detailPageErrorAssertions = [
      ...this.__detailPageErrorAssertions,
      new TrademaxErrorAssertion(),
    ];
  }

  override async crawlListPage(ctx: PlaywrightCrawlingContext): Promise<void> {
    await super.crawlListPage(ctx);

    const categoryUrl = ctx.page.url();
    if (!categoryUrl.includes("?page=")) {
      // Initial category page
      // => Find the number of pages and enqueue all pages to scrape.
      try {
        await ctx.page.waitForSelector(this.listingUrlSelector!);
        const paginationLinks = ctx.page.locator(this.listingUrlSelector!);

        const lastPageLink = paginationLinks.nth(
          (await paginationLinks.count()) - 2
        );
        const lastPageNumberText = await lastPageLink.textContent();
        if (!lastPageNumberText) {
          log.debug("No last page found - category only has 1 page");
          return;
        }

        const nrPages = parseInt(lastPageNumberText);
        for (let i = 2; i <= nrPages; i++) {
          const url = categoryUrl.split("?")[0] + `?page=${i}`;

          await ctx.enqueueLinks({
            urls: [url],
            label: "LIST",
            userData: {
              ...ctx.request.userData,
              pageNumber: i,
            },
          });
        }

        log.info(`Enqueued ${nrPages} category pages to explore.`);
      } catch (e) {
        log.debug("No pagination found - category only has 1 page");
      }
    }
  }

  async extractCardProductInfo(
    categoryUrl: string,
    productCard: Locator
  ): Promise<ListingProductInfo> {
    return baseExtractCardProductInfo(this, categoryUrl, productCard);
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    await this.handleCookieConsent(page);
    const rootLocator = page.locator("html");

    const mainLocator = await findElementByCSSProperties(
      rootLocator,
      {
        columnGap: "40px",
      },
      "div"
    ).then((l) => l?.nth(0));
    if (!mainLocator) {
      throw new Error("Cannot extract mainLocator");
    }

    const productName = await findElementByCSSProperties(
      mainLocator,
      {
        fontSize: "20px",
        fontWeight: "800",
      },
      "h1"
    )
      .then((l) => l?.innerText())
      .then((text) => text?.trim().split("\n")[0]);
    if (!productName) {
      throw new Error("Cannot extract productName");
    }

    const priceText = await findElementByCSSProperties(
      mainLocator,
      {
        fontWeight: "800",
        paddingTop: "2px",
      },
      "div"
    )
      .then((l) => l?.textContent())
      .then((text) => text?.trim());
    const price = priceText
      ? parseInt(
          priceText?.replace("SEK", "").replace(":-", "").replace(/\s/g, "")
        )
      : undefined;

    const images = await extractImageFromProductPage(page, mainLocator);

    const breadcrumbLocator = page.locator("main nav span a");
    const categoryTree = await this.extractCategoryTree(breadcrumbLocator, 1);

    const brandLocator = await findElementByCSSProperties(
      mainLocator,
      {
        fontWeight: "600",
      },
      "p"
    );

    const brand = await brandLocator
      ?.textContent()
      .then((text) => text?.trim());
    const brandUrl =
      (await brandLocator?.locator("xpath=..").getAttribute("href")) ??
      undefined;

    const originalPriceString = await findElementByCSSProperties(
      mainLocator,
      { textDecorationLine: "line-through" },
      "span"
    ).then((l) => l?.textContent());
    const isDiscounted = originalPriceString !== undefined;
    const originalPrice = originalPriceString
      ? parseInt(
          originalPriceString
            .replace("SEK", "")
            .replace(":-", "")
            .replace(/\s/g, "")
        )
      : undefined;

    let articleNumber = undefined,
      specifications: Specification[] = [];
    try {
      const specificationsExpander = page.locator(
        "//main//div[./h3/span/text()='Specifikationer']"
      );
      await specificationsExpander.click({ timeout: 5000 });
      await page.waitForSelector(
        "//main//div[./h3/span/text()='Specifikationer']//div//span[2]"
      );
      articleNumber = await this.extractProperty(
        page,
        "//main//div[./h3/span/text()='Specifikationer']//div//span[2]",
        (node) => node.textContent()
      ).then((text) => text?.trim());

      specifications = await this.extractSpecificationsFromTable(
        specificationsExpander.locator("//tr/td[1]"),
        specificationsExpander.locator("//tr/td[2]")
      );
    } catch (e) {
      log.info(`Specification not found for product with url: ${page.url()}`);
      log.debug(`Scrape specification error`, { e });
    }

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

    let reviewSummary: ProductReviews | undefined;
    try {
      const averageReviewString = await this.extractProperty(
        page,
        "//div[contains(@class, 'accordionRatingContainer')]/span[1]",
        (node) => node.textContent()
      );
      const averageReview = Number(averageReviewString);

      const reviewCountString = <string>(
        await this.extractProperty(
          page,
          "//div[contains(@class, 'accordionRatingContainer')]/span[2]",
          (node) => node.textContent()
        )
      );
      const reviewCount = Number(
        reviewCountString.substring(1, reviewCountString.length - 1)
      );

      await page
        .locator(
          "//div[contains(@class, 'accordion--title') and .//span/text() = 'Recensioner']"
        )
        .click({ timeout: 10000 });

      await page.locator("#ReviewsDropDownSorting").click();
      await page.locator(".ReviewSortingDropDown").waitFor();

      await page.locator("#mostRecentReviewSorting").click();
      await page
        .locator(
          "//div[@id = 'ReviewsDropDownSorting']/span[text() = 'Senast inkommet']"
        )
        .waitFor();
      // wait to load the new reviews
      await new Promise((f) => setTimeout(f, 500));

      const reviewsSelector = page.locator(
        "//div[contains(@class, 'reviewsList')]/div"
      );
      const expandedReviewsCount = await reviewsSelector.count();

      const recentReviews: IndividualReview[] = [];
      for (let i = 0; i < expandedReviewsCount; i++) {
        const currentReviewElement = reviewsSelector.nth(i);
        const fullStarsSelector = currentReviewElement.locator(
          "xpath=./div[2]/div[1]/div[1]//*[local-name() = 'svg' and contains(normalize-space(@class), ' ')]"
        );

        const score = await fullStarsSelector.count();
        const content = <string>(
          await this.extractProperty(
            currentReviewElement,
            "xpath=./div[2]/p",
            (node) => node.textContent()
          )
        );
        recentReviews.push({
          score,
          content,
        });
      }

      reviewSummary = {
        averageReview,
        reviewCount,
        recentReviews,
      };
    } catch (e) {
      log.debug(`Reviews not found for product with url: ${page.url()}`);
      reviewSummary = undefined;
    }

    const addToCartLocator = page.locator(
      "button[data-test-id='add-to-cart-button']"
    );
    const availability =
      (await addToCartLocator.count()) > 0 ? "in_stock" : "out_of_stock";

    const metadata: OfferMetadata = {};
    const schemaOrgString = <string>(
      await page
        .locator(
          "//script[@type='application/ld+json' and contains(text(), 'schema.org') and contains(text(), 'Product')]"
        )
        .textContent()
    );
    metadata.schemaOrg = JSON.parse(schemaOrgString);

    const mpn = metadata.schemaOrg?.mpn;
    if (articleNumber) {
      articleNumber = metadata.schemaOrg?.sku;
    }

    return {
      name: productName,
      brand,
      brandUrl,
      description,
      url: page.url(),
      price,
      currency: "SEK",
      isDiscounted,
      originalPrice,

      gtin: undefined,
      sku: articleNumber,
      mpn,

      availability,
      images,
      reviews: reviewSummary,
      specifications,
      categoryTree,
      metadata,
    };
  }

  override async selectOptionForParamIndex(
    ctx: PlaywrightCrawlingContext<Dictionary>,
    paramIndex: number,
    optionIndex: number
  ): Promise<void> {
    const paramsImageVariantGroupCount =
      (await ctx.page.locator("main div.bw.hh a:has(img)").count()) > 0 ? 1 : 0;
    const paramsSidebarVariantGroupCount =
      (await ctx.page.locator("main div.bw.hh ul li button").count()) > 0
        ? 1
        : 0;

    if (paramIndex < paramsImageVariantGroupCount) {
      await ctx.page
        .locator("main div.bw.hh a:has(img)")
        .nth(optionIndex)
        .click({ force: true });
    } else if (
      paramIndex <
      paramsImageVariantGroupCount + paramsSidebarVariantGroupCount
    ) {
      await this.openVariantSidebar(ctx.page);
      const button = await ctx.page
        .locator("main div.bw.hh ul li button:has(div)")
        .nth(optionIndex);
      if (await button.isDisabled()) {
        // the variant is already selected -> do nothing
      } else {
        await button.click();
      }
      await this.closeVariantSidebar(ctx.page);
    }
  }
  override async hasSelectedOptionForParamIndex(
    _: PlaywrightCrawlingContext<Dictionary>,
    _paramIndex: number
  ): Promise<boolean> {
    // There is always a selected option on trademax.se
    return true;
  }
  override async getOptionsCountForParamIndex(
    ctx: PlaywrightCrawlingContext<Dictionary>,
    paramIndex: number
  ): Promise<number> {
    // Trademax only have one "choose colour from list" selector and one
    // "choose size from sidebar" selector
    const paramsImageVariantGroupCount =
      (await ctx.page.locator("main div.bw.hh a:has(img)").count()) > 0 ? 1 : 0;
    const paramsSidebarVariantGroupCount =
      (await ctx.page.locator("main div.bw.hh ul li button").count()) > 0
        ? 1
        : 0;

    if (paramIndex < paramsImageVariantGroupCount) {
      return ctx.page.locator("main div.bw.hh a:has(img)").count();
    } else if (
      paramIndex <
      paramsImageVariantGroupCount + paramsSidebarVariantGroupCount
    ) {
      await this.openVariantSidebar(ctx.page);
      const optionsCount = ctx.page
        .locator("main div.bw.hh ul li button:has(div)")
        .count();
      await this.closeVariantSidebar(ctx.page);

      return optionsCount;
    } else {
      return 0;
    }
  }
  override async checkInvalidVariant(
    _: PlaywrightCrawlingContext<Dictionary>,
    _currentOption: number[]
  ): Promise<boolean> {
    // Cannot select invalid variants on trademax
    return false;
  }

  async openVariantSidebar(page: Page): Promise<void> {
    await page.locator("main div.bw.hh ul li button").first().click();
    // Wait for the sidebar to pop up:
    await page
      .locator("main div.bw.hh ul li button:has(div)")
      .first()
      .waitFor();
    await page.waitForLoadState("networkidle");
  }
  async closeVariantSidebar(page: Page): Promise<void> {
    await page
      .locator("main div.bw.hh ul button[aria-label='Stäng']")
      .first()
      .click();
  }

  override async crawlIntermediateCategoryPage(
    ctx: PlaywrightCrawlingContext
  ): Promise<void> {
    const page = ctx.page;
    const topLevelLocators = page.locator(
      "header nav:first-of-type > ul > li > a"
    );
    for (const topLevelATag of await topLevelLocators.all()) {
      await topLevelATag.click();
      await page.waitForTimeout(2000);

      // Expand all subcategories by clicking "Visa mer" buttons:
      for (const button of await page
        .locator("header nav:last-of-type button")
        .all()) {
        const isSeeMoreButton = (await button.textContent())
          ?.toLowerCase()
          .includes("visa mer");
        if (isSeeMoreButton) {
          await button.click();
          await page.waitForTimeout(500);
        }
      }
      await ctx.enqueueLinks({
        selector: "header nav:last-of-type ul li a",
        label: "LIST",
      });
    }
  }

  static async create(
    launchOptions: CrawlerLaunchOptions
  ): Promise<TrademaxCrawlerDefinition> {
    const options = await createCrawlerDefinitionOption(launchOptions);

    return new TrademaxCrawlerDefinition(
      {
        ...options,
        dynamicProductCardLoading: false,
        launchOptions,
      },
      "same_tab"
    );
  }
}
