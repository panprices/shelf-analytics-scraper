import { Locator, Page } from "playwright";
import { Dataset, log, PlaywrightCrawlingContext } from "crawlee";
import { AbstractCrawlerDefinition } from "../abstract";
import {
  DetailedProductInfo,
  IndividualReview,
  ListingProductInfo,
  OfferMetadata,
  ProductReviews,
  SchemaOrg,
} from "../../types/offer";
import { v4 as uuidv4 } from "uuid";
import { extractRootUrl } from "../../utils";

export class HomeroomCrawlerDefinition extends AbstractCrawlerDefinition {
  override async crawlDetailPage(
    ctx: PlaywrightCrawlingContext
  ): Promise<void> {
    await super.crawlDetailPage(ctx);

    // Enqueue the variant groups where you have a.href:
    await ctx.enqueueLinks({
      selector: "div.product-info ul.color-picker-list a",
      label: "DETAIL",
    });
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    const productName = (<string>(
      await page.locator("h1.product-title").textContent()
    )).trim();

    const metadata: OfferMetadata = {};
    const breadcrumbLocator = page.locator("ul.breadcrumbs > li > a");
    const categoryTree = await this.extractCategoryTree(breadcrumbLocator);

    let priceString = <string>(
      await page.locator("div.price > p").first().textContent()
    );
    priceString = priceString.trim().replace(/\s+/g, " ");
    let price: number, currency;
    if (priceString !== "Slutsåld!") {
      const parts = priceString.split(" ");
      currency = (<string>parts[parts.length - 1]).trim();
      price = Number(priceString.replace(currency, "").replace(/\s/g, ""));
    } else {
      price = 0;
      currency = "unavailable";
    }

    const isDiscounted = (await page.locator("p.original-price").count()) > 0;
    if (isDiscounted) {
      metadata.originalPrice = Number(
        (<string>await page.locator("p.original-price").textContent()).replace(
          /\s/g,
          ""
        )
      );
    }

    const imagesSelector = page.locator(
      "//li[contains(@class, 'product-gallery-item')]//source[1]"
    );
    const imageCount = await imagesSelector.count();
    const images = [];
    for (let i = 0; i < imageCount; i++) {
      const sourceTag = imagesSelector.nth(i);
      const srcset = <string>await sourceTag.getAttribute("srcset");
      const imageUrl = srcset.split(",")[0].split(" ")[0];

      images.push(imageUrl);
    }

    const description = <string>(
      await page
        .locator("//div[contains(@class, 'long-description')]//p/span[1]")
        .textContent()
    );
    const brand = (await this.extractProperty(
      page,
      "//h2[contains(@class, 'long-description-title')]/a[2]",
      (node) => node.textContent()
    ))!.trim();
    const schemaOrgString = <string>(
      await page
        .locator(
          "//script[@type='application/ld+json' and contains(text(), 'schema.org')]"
        )
        .textContent()
    );
    const schemaOrg: SchemaOrg = JSON.parse(schemaOrgString);
    const sku = schemaOrg.sku;
    metadata.schemaOrg = schemaOrg;

    const specifications = await page.locator(
      "//div[contains(@class, 'infos')]"
    );
    const specificationsCount = await specifications.count();
    const specArray = [];
    for (let i = 0; i < specificationsCount; i++) {
      const spec = <string>await specifications
        .nth(i)
        .textContent()
        .then((s) => s!.trim());

      specArray.push({
        key: (<string>spec.split("\n")[0]).trim(),
        value: (<string>spec.split("\n")[1]).trim(),
      });
    }
    const buyButtonLocator = page.locator("//button/span[text() = 'Handla']");
    const availability =
      (await buyButtonLocator.count()) > 0 ? "in_stock" : "out_of_stock";

    const reviewsSectionAvailable = await page
      .locator("//div[@class = 'reviews-container']")
      .isVisible();
    let reviews: ProductReviews | "unavailable";
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

    return {
      name: productName,
      price,
      currency,
      images,
      description,
      categoryTree,
      sku,
      metadata,
      specifications: specArray,
      brand,
      isDiscounted,
      url: page.url(),
      reviews,
      availability,

      popularityIndex: -1, // to be replaced later
    };
  }

  async extractCardProductInfo(
    categoryUrl: string,
    productCard: Locator
  ): Promise<ListingProductInfo> {
    const brand = await this.extractProperty(
      productCard,
      "..//b[contains(@class, 'brand')]",
      (node) => node.textContent()
    );
    const name = <string>(
      await this.extractProperty(
        productCard,
        "..//span[contains(@class, 'name')]",
        (node) => node.textContent()
      )
    );
    let priceString = <string>(
      await this.extractProperty(
        productCard,
        "..//span[contains(@class, 'price-point')]",
        (node) => node.textContent()
      )
    );
    if (!priceString) {
      priceString = "0\nSEK";
    }
    const originalPriceString = await this.extractProperty(
      productCard,
      "..//s[contains(./span/@class, 'currency')]",
      (node) => node.textContent()
    );
    const imageUrl = await this.extractProperty(
      productCard,
      "xpath=(..//picture/source)[1]",
      this.extractImageFromSrcSet
    );
    const url = <string>(
      await this.extractProperty(productCard, "xpath=./a[1]", (node) =>
        node.getAttribute("href")
      )
    );

    const currentProductInfo: ListingProductInfo = {
      brand,
      name,
      url,
      previewImageUrl: <string>imageUrl,
      popularityIndex: -1,
      isDiscounted: originalPriceString !== null,
      price: Number(priceString.trim().split("\n")[0].replace(/\s/g, "")),
      currency: priceString.trim().split("\n")[1].trim(),
      categoryUrl,
    };
    if (originalPriceString) {
      currentProductInfo.originalPrice = Number(
        originalPriceString.trim().split("\n")[0].replace(/\s/g, "")
      );
    }

    return currentProductInfo;
  }

  static async create(): Promise<HomeroomCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets();

    return new HomeroomCrawlerDefinition({
      detailsDataset,
      listingDataset,
      detailsUrlSelector: "//article[contains(@class, 'product-card')]//a",
      productCardSelector: "//article[contains(@class, 'product-card')]",
      cookieConsentSelector: "a.cta-ok",
    });
  }

  override async scrollToBottom(ctx: PlaywrightCrawlingContext): Promise<void> {
    const page = ctx.page;

    let buttonVisible = false;
    do {
      await super.scrollToBottom(ctx);

      // wait for consistency
      await new Promise((f) => setTimeout(f, 100));
      const loadMoreButton = page.locator("div.load-more-button");

      log.info(`Button: ${loadMoreButton}`);
      await this.handleCookieConsent(page);
      buttonVisible = await loadMoreButton.isVisible();
      if (!buttonVisible) {
        break;
      }

      const pageHeight = await page.evaluate(
        async () => document.body.offsetHeight
      );
      await loadMoreButton.click();
      let pageExpanded = false;
      do {
        log.info("Waiting for button click to take effect");
        await new Promise((f) => setTimeout(f, 1500));

        const newPageHeight = await page.evaluate(
          async () => document.body.offsetHeight
        );
        pageExpanded = newPageHeight > pageHeight;
      } while (!pageExpanded);
    } while (true);
  }

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
}
