import {
  AbstractCrawlerDefinition,
  CrawlerDefinitionOptions,
  CrawlerLaunchOptions,
} from "../abstract";
import { Locator, Page, selectors } from "playwright";
import { Dataset, Dictionary, log, PlaywrightCrawlingContext } from "crawlee";
import {
  Category,
  DetailedProductInfo,
  IndividualReview,
  ListingProductInfo,
  OfferMetadata,
  ProductReviews,
} from "../../types/offer";
import { extractDomainFromUrl } from "../../utils";
import { isProductPage, getVariantUrlsFromSchemaOrg } from "./base-chill";
import { PageNotFoundError } from "../../types/errors";

export class TrademaxCrawlerDefinition extends AbstractCrawlerDefinition {
  protected override categoryPageSize: number = 36;

  constructor(options: CrawlerDefinitionOptions) {
    super(options);

    this._router.addHandler("INTERMEDIATE_LOWER_CATEGORY", (_) =>
      this.crawlIntermediateLowerCategoryPage(_)
    );
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

  /**
   * Need to override this so that since 1 product may have multiple colour variants
   * => Multiple products from 1 original url, each has their own GTIN/SKU.
   */
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

    const variantUrls = await getVariantUrlsFromSchemaOrg(ctx.page);
    if (variantUrls) {
      await ctx.enqueueLinks({
        urls: variantUrls,
        label: "DETAIL",
        userData: ctx.request.userData,
      });
    }

    // Enqueue the main variant group where you have a.href:
    await ctx.enqueueLinks({
      selector: "div#possibleVariants a",
      label: "DETAIL",
      userData: ctx.request.userData,
    });

    // Check for secondary variant group where you don't have a.href.
    // Try to click buttons and enqueue new links:
    const secondaryVariantButtons = ctx.page.locator(
      "div[data-cy='product_variant_link']"
    );
    const secondaryVariantButtonsCount = await secondaryVariantButtons.count();
    console.log("Variant counts: " + secondaryVariantButtonsCount);
    // Always have one button grayed out which is the current selected variant,
    // so we only try to enqueue more if there are at least 1 more.
    if (secondaryVariantButtonsCount >= 2) {
      for (let i = 0; i < secondaryVariantButtonsCount; i++) {
        await secondaryVariantButtons.nth(i).click();
        await ctx.page.waitForTimeout(1500);

        await ctx.enqueueLinks({
          urls: [ctx.page.url()],
          label: "DETAIL",
          userData: ctx.request.userData,
        });
      }
    }
  }

  async extractCardProductInfo(
    categoryUrl: string,
    productCard: Locator
  ): Promise<ListingProductInfo> {
    const name = <string>(
      await this.extractProperty(
        productCard,
        "..//h3[contains(@class, 'ProductCardTitle__global')]",
        (node) => node.textContent()
      )
    );
    const url = <string>(
      await this.extractProperty(productCard, "..//a[1]", (node) =>
        node.getAttribute("href")
      )
    );

    const categoryTree = await this.extractCategoryTreeFromCategoryPage(
      productCard.page().locator("div#breadcrumbs a"),
      1,
      productCard.page().locator("div#breadcrumbs > div > span")
    );

    const result: ListingProductInfo = {
      name,
      url,
      categoryUrl,
      popularityCategory: categoryTree,
    };

    return result;
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    if (!isProductPage(page.url())) {
      throw new PageNotFoundError("Page not found");
    }

    await page.waitForSelector("h1[data-cy='product_title']");
    await this.handleCookieConsent(page);

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

    const product_name = await page
      .locator("h1[data-cy='product_title']")
      .textContent();
    const price_text = await page
      .locator("div#productInfoPrice div[data-cy='current-price']")
      .textContent();
    const price = Number(price_text?.replace(" ", ""));

    const imagesPreviewLocator = await page.locator(
      "//div[contains(@class, 'ProductInfoSliderNavigation__global')]//div[contains(@class, 'slick-track')]//div[contains(@class, 'slick-slide')]"
    );
    const imagesCount = await imagesPreviewLocator.count();
    for (let i = 0; i < imagesCount; i++) {
      const currentImagePreview = imagesPreviewLocator.nth(i);
      await currentImagePreview.click();
      await page.waitForTimeout(50);
    }
    const images = await page
      .locator("div#productInfoImage figure img")
      .evaluateAll((list: HTMLElement[]) =>
        list.map((element) => <string>element.getAttribute("src"))
      );

    const breadcrumbLocator = page.locator("div#breadcrumbs a");
    const categoryTree = await this.extractCategoryTree(breadcrumbLocator, 1);

    const brand = await this.extractProperty(
      page,
      "//span[contains(strong/text(), ('Varumärke'))]/span/a",
      (node) => node.textContent()
    );
    const originalPriceString = await this.extractProperty(
      page,
      "xpath=(//div[contains(@class, 'productInfoContent--buySectionBlock')]//div[@data-cy = 'original-price'])[1]",
      (node) => node.textContent()
    );

    let articleNumber = undefined,
      specArray = [];
    try {
      const specificationsExpander = page.locator(
        "//div[contains(@class, 'accordion--title') and .//span/text() = 'Specifikationer']"
      );
      await specificationsExpander.click({ timeout: 5000 });
      await page.waitForSelector(
        "//div[contains(@class, 'articleNumber')]/span"
      );
      articleNumber = await this.extractProperty(
        page,
        "//div[contains(@class, 'articleNumber')]/span",
        (node) => node.textContent()
      ).then((text) => text?.trim());
      const specifications = specificationsExpander.locator("..//tr");
      const specificationsCount = await specifications.count();
      specArray = [];
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
    } catch (e) {
      log.info(`Specification not found for product with url: ${page.url()}`);
    }

    let description;
    try {
      const descriptionExpander = page.locator(
        "//div[contains(@class, 'accordion--title') and .//span/text() = 'Produktinformation']"
      );
      await descriptionExpander.click({ timeout: 5000 });

      description = <string>(
        await this.extractProperty(
          descriptionExpander,
          "..//div[contains(@class, 'accordion--content')]",
          (node) => node.textContent()
        )
      );
    } catch (e) {
      log.info(`Description not found for product with url: ${page.url()}`);
      description = "unavailable";
    }

    let reviewSummary: ProductReviews | "unavailable";
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
        .click({ timeout: 5000 });

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
      reviewSummary = "unavailable";
    }

    const addToCartLocator = page.locator("#A2C_ACTION");
    const availability =
      (await addToCartLocator.count()) > 0 ? "in_stock" : "out_of_stock";

    const intermediateResult: DetailedProductInfo = {
      name: <string>product_name,
      price,
      currency: "SEK",
      images,
      description,
      url: page.url(),
      isDiscounted: originalPriceString !== undefined,
      brand,
      categoryTree,
      reviews: reviewSummary,

      sku: articleNumber,
      mpn,

      specifications: specArray,
      availability,
      metadata,
    };

    if (originalPriceString) {
      intermediateResult.originalPrice = Number(
        originalPriceString.replace("SEK", "").replace(/\s/g, "")
      );
    }

    return intermediateResult;
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
    launchOptions?: CrawlerLaunchOptions
  ): Promise<TrademaxCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets();

    return new TrademaxCrawlerDefinition({
      detailsDataset,
      listingDataset,
      listingUrlSelector: "//div[@data-cy = 'pagination_controls']/a",
      detailsUrlSelector: "//a[contains(@class, 'ProductCard_card__global')]",
      productCardSelector: "//a[contains(@class, 'ProductCard_card__global')]",
      cookieConsentSelector: "#onetrust-accept-btn-handler",
      dynamicProductCardLoading: false,
      launchOptions,
    });
  }
}
