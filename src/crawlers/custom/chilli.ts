import {
  AbstractCrawlerDefinition,
  CrawlerDefinitionOptions,
} from "../abstract";
import { Locator, Page } from "playwright";
import { Dataset, log, PlaywrightCrawlingContext } from "crawlee";
import {
  DetailedProductInfo,
  IndividualReview,
  ListingProductInfo,
  OfferMetadata,
  ProductReviews,
} from "../../types/offer";
import { extractRootUrl } from "../../utils";
import { v4 as uuidv4 } from "uuid";

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
    await ctx.enqueueLinks({
      selector: "a[data-cy='product_variant_link']",
      label: "DETAIL",
    });
  }

  async extractCardProductInfo(
    categoryUrl: string,
    productCard: Locator
  ): Promise<ListingProductInfo> {
    const imageUrl = <string>(
      await this.extractProperty(
        productCard,
        "xpath=(..//img)[1]",
        this.extractImageFromSrcSet
      )
    );
    const name = <string>(
      await this.extractProperty(
        productCard,
        "..//h3[contains(@class, 'ProductCardTitle__global')]",
        (node) => node.textContent()
      )
    );
    const priceText = <string>(
      await this.extractProperty(
        productCard,
        "..//div[@data-cy = 'current-price']",
        (node) => node.first().textContent()
      )
    );
    const originalPriceText = await this.extractProperty(
      productCard,
      "..//div[@data-cy = 'original-price']",
      (node) => node.first().textContent()
    );
    const isDiscounted = originalPriceText !== undefined;
    const url = <string>(
      await this.extractProperty(productCard, "..//a[1]", (node) =>
        node.getAttribute("href")
      )
    );

    const result: ListingProductInfo = {
      name,
      previewImageUrl: imageUrl,
      price: Number(priceText.replace(/\s/g, "")),
      isDiscounted,
      url,
      currency: "SEK",
      categoryUrl,
      popularityIndex: -1,
    };
    if (isDiscounted) {
      result.originalPrice = Number(originalPriceText!.replace(/\s/g, ""));
    }

    return result;
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
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

    const sku = metadata.schemaOrg?.mpn;

    const product_name = await page
      .locator("h1[data-cy='product_title']")
      .textContent();
    const price_text = await page
      .locator("div#productInfoPrice div[data-cy='current-price']")
      .textContent();
    const price = Number(price_text?.replace(" ", ""));

    const imagesPreviewLocator = await page.locator(
      "//div[contains(@class, 'ProductInfoSliderNavigation__global')]//div[contains(@class, 'slick-track')]//div[contains(@class, 'slick-slide')]//img"
    );
    const imagesCount = await imagesPreviewLocator.count();
    for (let i = 0; i < imagesCount; i++) {
      const currentImagePreview = imagesPreviewLocator.nth(i);
      await currentImagePreview.click();
    }

    const images = await page
      .locator("div#productInfoImage div.slick-slide div.z3Vk_ img")
      .evaluateAll((list: HTMLElement[]) =>
        list.map((element) => <string>element.getAttribute("src"))
      );
    const breadcrumbLocator = page.locator("//div[@id = 'breadcrumbs']//a");
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
      articleNumber = await this.extractProperty(
        page,
        "//div[contains(@class, 'articleNumber')]/span",
        (node) => node.textContent()
      );
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
        const fullStarsSelector = currentReviewElement.locator("div.qUxh1");

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
      log.info(`Reviews not found for product with url: ${page.url()}`);
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
      articleNumber,
      sku,
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
    const rootUrl = extractRootUrl(ctx.page.url());
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

  static async create(): Promise<ChilliCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets();

    return new ChilliCrawlerDefinition({
      detailsDataset,
      listingDataset,
      listingUrlSelector: "//div[@data-cy = 'pagination_controls']/a",
      detailsUrlSelector: "//a[contains(@class, 'ProductCard_card__global')]",
      productCardSelector: "//a[contains(@class, 'ProductCard_card__global')]",
      cookieConsentSelector: "#onetrust-accept-btn-handler",
    });
  }
}
