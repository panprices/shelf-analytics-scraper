import { Locator, Page } from "playwright";
import { Dictionary, log, PlaywrightCrawlingContext } from "crawlee";
import {
  AbstractCrawlerDefinition,
  AbstractCrawlerDefinitionWithVariants,
  CrawlerDefinitionOptions,
  CrawlerLaunchOptions,
} from "../abstract";
import {
  Category,
  DetailedProductInfo,
  IndividualReview,
  ListingProductInfo,
  OfferMetadata,
  ProductReviews,
  SchemaOrg,
} from "../../types/offer";
import { extractNumberFromText } from "../../utils";
import { extractImagesFromDetailedPage } from "./base-homeroom";

export class HomeroomCrawlerDefinition extends AbstractCrawlerDefinitionWithVariants {
  protected override categoryPageSize: number = 58;
  private cookiesHandled: boolean = false;

  public constructor(options: CrawlerDefinitionOptions) {
    super(options, "same_tab");
  }

  override async crawlListPage(ctx: PlaywrightCrawlingContext): Promise<void> {
    const categoryUrl = ctx.page.url();
    if (!categoryUrl.includes("?page=")) {
      // Initial category page => Calculate the number of pages
      // and enqueue all pages to scrape.
      const nrProductsText = await ctx.page
        .locator("div.product-list-inner div.drop-list-container")
        .textContent();
      if (!nrProductsText) {
        throw new Error(
          "Cannot extract nrProductsText. Category url might be broken."
        );
      }

      const nrProducts = extractNumberFromText(nrProductsText);
      const nrPages = Math.ceil(nrProducts / this.categoryPageSize);

      const urlsToExplore = [];
      for (let i = 1; i <= nrPages; i++) {
        const url = categoryUrl.split("?")[0] + `?page=${i}`;
        urlsToExplore.push(url);

        await ctx.enqueueLinks({
          urls: [url],
          label: "LIST",
          userData: {
            ...ctx.request.userData,
            pageNumber: i,
          },
        });
      }

      log.info(
        `Category has ${nrProducts} products. Enqueued ${nrPages} pages to explore.`
      );

      return;
    }

    await super.crawlListPage(ctx);
  }

  /**
   *
   * Crawl the detail page.
   * If there are dropdown (size) variants, we would also scrape the "productGroup"
   * info as the 1st variant.
   * This is due to the need of getting prices for previously matched products
   * whose urls are the productGroup urls.
   */
  override async crawlDetailPage(
    ctx: PlaywrightCrawlingContext
  ): Promise<void> {
    await this.crawlSingleDetailPage(ctx, ctx.page.url(), 0);

    const nrDropdownVariants = await this.getOptionsCountForParamIndex(ctx, 0);
    const hasDropdownVariants = nrDropdownVariants > 0;
    if (hasDropdownVariants) {
      await this.crawlDetailPageWithVariantsLogic(ctx);
    }

    // Enqueue the colour variant groups where you have a.href:
    await ctx.enqueueLinks({
      selector: "div.product-info ul.color-picker-list a",
      label: "DETAIL",
      userData: ctx.request.userData,
    });
  }

  override async extractProductDetails(
    page: Page
  ): Promise<DetailedProductInfo> {
    const productNameSelector = "h1.product-title";
    await page.waitForSelector(productNameSelector);
    if (!this.cookiesHandled) {
      // If we did not see cookies yet give it one more second to avoid being blocked by the overlay later
      await page.waitForTimeout(1000);
    }
    await this.handleCookieConsent(page);

    const productName = await this.extractProperty(
      page,
      productNameSelector,
      (node) => node.textContent()
    ).then((text) => text?.trim());
    if (!productName) {
      throw new Error("Cannot extract productName");
    }

    const metadata: OfferMetadata = {};
    const breadcrumbLocator = page.locator("ul.breadcrumbs > li > a");
    const categoryTree = await this.extractCategoryTree(breadcrumbLocator);

    const price = await this.extractPriceFromProductPage(page);
    const currency = "SEK";

    const isDiscounted = (await page.locator("p.original-price").count()) > 0;
    if (isDiscounted) {
      metadata.originalPrice = Number(
        (<string>await page.locator("p.original-price").textContent()).replace(
          /\s/g,
          ""
        )
      );
    }

    const images = await extractImagesFromDetailedPage(page);

    const description = await this.extractDescriptionFromDetailedPage(page);

    if (!description.includes("Artikelnummer:")) {
      throw new Error("Cannot extract sku.");
    }
    const sku = description
      .split("Artikelnummer:")
      .pop()!
      .split("\n")[0]
      .trim();

    const brand = (await this.extractProperty(
      page,
      "//h2[contains(@class, 'long-description-title')]/a[2]",
      (node) => node.textContent()
    ))!.trim();
    const schemaOrgString = <string>(
      await page
        .locator(
          "//script[@type='application/ld+json' " +
            "and contains(text(), 'schema.org') " +
            "and contains(text(), 'Product')]"
        )
        .textContent()
    );
    const schemaOrg: SchemaOrg = JSON.parse(schemaOrgString);
    metadata.schemaOrg = schemaOrg;

    const specifications = await page.locator(
      "//div[contains(@class, 'infos')]"
    );
    const specificationsCount = await specifications.count();
    const specArray = [];
    for (let i = 0; i < specificationsCount; i++) {
      const spec = await specifications
        .nth(i)
        .textContent()
        .then((s) => s?.trim());

      if (spec && spec.split("\n").length > 1) {
        specArray.push({
          key: spec.split("\n")[0].trim(),
          value: spec.split("\n")[1].trim(),
        });
      }
    }
    const buyButtonLocator = page.locator("//button//span[text() = 'Handla']");
    const availability =
      (await buyButtonLocator.count()) > 0 ? "in_stock" : "out_of_stock";

    const reviewsSectionAvailable = await page
      .locator("//div[@class = 'reviews-container']")
      .isVisible();
    let reviews: ProductReviews | "unavailable";

    try {
      if (reviewsSectionAvailable) {
        const reviewSelector = page.locator("//ul[@class = 'review-list']/li");
        const visibleReviewCount = await reviewSelector.count();
        const recentReviews: IndividualReview[] = [];
        for (let i = 0; i < visibleReviewCount; i++) {
          const reviewLocator = reviewSelector.nth(i);

          const reviewTitle = await this.extractProperty(
            reviewLocator,
            ".review-title",
            (node) => node.textContent()
          );
          const reviewText = await this.extractProperty(
            reviewLocator,
            ".review-text",
            (node) => node.textContent()
          );

          const reviewValue = await this.extractProperty(
            reviewLocator,
            ".stars-filled",
            (node) => node.getAttribute("style")
          )
            .then((s) => Number(/width:(\d+)%;/g.exec(s!)![1]))
            .then((v) => (v / 100) * 5);

          recentReviews.push({
            content: reviewTitle + "\n" + reviewText,
            score: reviewValue,
          });
        }

        reviews = {
          reviewCount: Number(
            await this.extractProperty(
              page,
              "//div[@class = 'product-info']//span[contains(@class, 'product-rating')]/a/span",
              (node) => node.textContent()
            )
          ),
          averageReview: Number(
            (<string>(
              await this.extractProperty(
                page,
                "//div[contains(@class, 'ratings')]/p/strong",
                (node) =>
                  node.textContent().then((s) => s!.replace("av 5", "").trim())
              )
            ))?.trim()
          ),
          recentReviews,
        };
      } else {
        reviews = "unavailable";
      }
    } catch {
      reviews = "unavailable";
    }

    // Change the url here for variants.
    // This is due to choosing variants from the dropdown doesn't change the url,
    // so we have to change it manually.
    // https://www.homeroom.se/venture-home/abc/1651926-01
    // -> https://www.homeroom.se/venture-home/abc/{sku-of-this-variant}
    const urlParts = page.url().split("/");
    urlParts.pop();
    const variantUrl = urlParts.join("/") + "/" + sku;
    log.info("Variant url: " + variantUrl);

    const sizeButton = page.locator(
      ".product-info button.variant-midnight.cta"
    );
    const sizeSelectorExists = (await sizeButton.count()) > 0;
    if (sizeSelectorExists) {
      const contentsLocator = sizeButton.locator(".contents");
      const sizeText = await contentsLocator.innerText();
      if (sizeText !== "Storlek") {
        specArray.push({
          key: "Storlek",
          value: sizeText,
        });
      }
    }

    const colorHeader = page.locator("h5.selected-color");
    const colorExists = (await colorHeader.count()) > 0;
    if (colorExists) {
      const colorText = await colorHeader
        .innerText()
        .then((t) => t.split(":")[1].trim());
      specArray.push({
        key: "Färg",
        value: colorText,
      });
    }

    return {
      name: productName,
      price,
      currency,
      images,
      description,
      categoryTree,
      sku,
      mpn: sku,
      metadata,
      specifications: specArray,
      brand,
      isDiscounted,
      url: variantUrl,
      reviews,
      availability,
    };
  }
  async extractPriceFromProductPage(page: Page): Promise<number | undefined> {
    let priceString;
    try {
      priceString = await page
        .locator("div.price > p")
        .first()
        .textContent({ timeout: 10000 });
    } catch (e) {
      log.info("Cannot extract price: Product is probably out of stock", {
        url: page.url(),
      });
      return undefined;
    }
    if (!priceString || priceString.includes("Slutsåld!")) {
      log.info("Cannot extract price: Product is out of stock", {
        url: page.url(),
      });
      return undefined;
    }

    priceString = priceString.trim().replace(/\s+/g, " ");
    let price: number, currency;
    const parts = priceString.split(" ");
    currency = (<string>parts[parts.length - 1]).trim();
    price = parseInt(priceString.replace(currency, "").replace(/\s/g, ""));

    return price;
  }

  async extractCardProductInfo(
    categoryUrl: string,
    productCard: Locator
  ): Promise<ListingProductInfo> {
    const name = <string>(
      await this.extractProperty(
        productCard,
        "..//span[contains(@class, 'name')]",
        (node) => node.textContent()
      )
    );
    const url = <string>(
      await this.extractProperty(productCard, "xpath=./a[1]", (node) =>
        node.getAttribute("href")
      )
    );

    const categoryTree = await this.extractCategoryTreeFromCategoryPage(
      productCard.page().locator("ul.breadcrumbs > li > a"),
      0,
      productCard.page().locator(".content-wrapper-category-header h1")
    );

    const currentProductInfo: ListingProductInfo = {
      name,
      url,
      categoryUrl,
      popularityCategory: categoryTree,
    };

    return currentProductInfo;
  }

  async selectOptionForParamIndex(
    ctx: PlaywrightCrawlingContext<Dictionary<any>>,
    paramIndex: number,
    optionIndex: number
  ): Promise<void> {
    await this.handleCookieConsent(ctx.page);

    const dropDownButtonLocator = ctx.page
      .locator(".size-picker .type-outline")
      .nth(paramIndex);
    await dropDownButtonLocator.click({ force: true });
    await ctx.page.waitForSelector("table.picker-sizes tbody tr");
    await ctx.page
      .locator("table.picker-sizes tbody tr:not(.no-stock)")
      .nth(optionIndex)
      .click();
    await ctx.page.waitForTimeout(3000);
  }
  async hasSelectedOptionForParamIndex(
    _: PlaywrightCrawlingContext<Dictionary<any>>,
    __: number
  ): Promise<boolean> {
    return false;
  }
  async getOptionsCountForParamIndex(
    ctx: PlaywrightCrawlingContext<Dictionary<any>>,
    paramIndex: number
  ): Promise<number> {
    const dropDownButtonLocator = ctx.page
      .locator(".size-picker .type-outline")
      .nth(paramIndex);
    const hasDropDrownVariants = (await dropDownButtonLocator.count()) > 0;
    if (hasDropDrownVariants) {
      // Open sidebar:
      await dropDownButtonLocator.click();
      await ctx.page.waitForSelector("table.picker-sizes tbody tr");

      // Only count valid options, aka options that are not out of stock:
      const optionsCount = await ctx.page
        .locator("table.picker-sizes tbody tr:not(.no-stock)")
        .count();

      // Turn off sidebar:
      await ctx.page
        .locator("div.overlay-inner .overlay-header button")
        .click();
      await ctx.page.waitForTimeout(3000);

      return optionsCount;
    }

    return 0;
  }
  async checkInvalidVariant(
    _: PlaywrightCrawlingContext<Dictionary<any>>,
    __: number[]
  ): Promise<boolean> {
    return false;
  }

  override async waitForChanges(
    ctx: PlaywrightCrawlingContext,
    currentState: any,
    _: number = 1000 // ms
  ) {
    // Wait for network to be idle
    await ctx.page.waitForLoadState("networkidle");

    // Wait for 1 more second just in case
    await ctx.page.waitForTimeout(1000);

    return currentState;
  }

  static async create(
    launchOptions: CrawlerLaunchOptions
  ): Promise<HomeroomCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets(
        launchOptions?.uniqueCrawlerKey
      );

    return new HomeroomCrawlerDefinition({
      detailsDataset,
      listingDataset,
      detailsUrlSelector: "//article[contains(@class, 'product-card')]//a",
      productCardSelector: "//article[contains(@class, 'product-card')]",
      cookieConsentSelector: "a.cta-ok",
      dynamicProductCardLoading: true,
      launchOptions,
    });
  }

  override async handleCookieConsent(page: Page): Promise<void> {
    const result = super.handleCookieConsent(page);
    this.cookiesHandled = true;
    return result;
  }

  // DEPRECATED: override scrollToBottom to handle infinite scroll.
  // We now use pagination with ?page=X instead
  // override async scrollToBottom(ctx: PlaywrightCrawlingContext): Promise<void> {
  //   const page = ctx.page;

  //   let buttonVisible = false;
  //   do {
  //     await super.scrollToBottom(ctx);

  //     // wait for consistency
  //     await new Promise((f) => setTimeout(f, 100));
  //     const loadMoreButton = page.locator("div.load-more-button");

  //     log.info(`Button: ${loadMoreButton}`);
  //     await this.handleCookieConsent(page);
  //     buttonVisible = await loadMoreButton.isVisible();
  //     if (!buttonVisible) {
  //       break;
  //     }

  //     const pageHeight = await page.evaluate(
  //       async () => document.body.offsetHeight
  //     );
  //     await loadMoreButton.click();
  //     let pageExpanded = false;
  //     do {
  //       log.info("Waiting for button click to take effect");
  //       await new Promise((f) => setTimeout(f, 1500));

  //       const newPageHeight = await page.evaluate(
  //         async () => document.body.offsetHeight
  //       );
  //       pageExpanded = newPageHeight > pageHeight;
  //     } while (!pageExpanded);
  //   } while (true);
  // }

  override async crawlIntermediateCategoryPage(
    ctx: PlaywrightCrawlingContext
  ): Promise<void> {
    // Open category menu
    await ctx.page.locator("ul.header-menu button").click();
    await ctx.page.waitForTimeout(5000);

    const mainCategoriesLocator = ctx.page.locator("ul.main-menu button");
    const mainCategoriesLocatorCount = await mainCategoriesLocator.count();

    for (let i = 0; i < mainCategoriesLocatorCount; i++) {
      await this.handleCookieConsent(ctx.page);

      // Open sub-category menu
      await mainCategoriesLocator.nth(i).click();
      // Extract leaf categories:

      await ctx.enqueueLinks({
        selector: "div.menu-container ul.sub-menu li a",
        label: "LIST",
      });

      // Go back to main category menu
      await ctx.page.locator("div.sub-menu-container button").click();
    }
  }

  async extractDescriptionFromDetailedPage(page: Page): Promise<string> {
    // Handle cookie consent so that we can click to expand description (if needed):
    await this.handleCookieConsent(page);

    // Try to expand description box fully if needed:
    const expandButton = page.locator(".long-description button");
    if (
      (await expandButton.isVisible()) &&
      (await expandButton.textContent())?.includes("Visa mer")
    ) {
      await expandButton.click();
    }

    const description = <string>(
      await page
        .locator("//div[contains(@class, 'long-description')]//p/span[1]")
        .textContent()
    );
    return description;
  }
}
