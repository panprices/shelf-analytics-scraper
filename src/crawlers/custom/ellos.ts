import { Locator, Page } from "playwright";
import { Dictionary, log, PlaywrightCrawlingContext } from "crawlee";
import {
  AbstractCrawlerDefinition,
  AbstractCrawlerDefinitionWithVariants,
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
import { extractNumberFromText, extractDomainFromUrl } from "../../utils";
import { extractImagesFromDetailedPage } from "./base-homeroom";

export class EllosCrawlerDefinition extends AbstractCrawlerDefinitionWithVariants {
  // protected override categoryPageSize: number = 56;

  // override async crawlDetailPage(
  //   ctx: PlaywrightCrawlingContext
  // ): Promise<void> {
  //   await super.crawlDetailPage(ctx);

  //   // Enqueue the variant groups where you have a.href:
  //   await ctx.enqueueLinks({
  //     selector: "div.product-info ul.color-picker-list a",
  //     label: "DETAIL",
  //     userData: ctx.request.userData,
  //   });
  // }

  override async crawlDetailPage(
    ctx: PlaywrightCrawlingContext
  ): Promise<void> {
    await this.crawlDetailPageMindingCookies(ctx, 3);
  }

  async crawlDetailPageMindingCookies(
    ctx: PlaywrightCrawlingContext,
    retryCount: number
  ): Promise<void> {
    // const nrDropdownVariants = await this.getOptionsForParamIndex(ctx, 0);
    // const hasVariants = nrDropdownVariants > 0;

    // if (hasVariants) {
    //   for (let i = 0; i < nrDropdownVariants; i++) {
    //     await this.selectOptionForParamIndex(ctx, 0, i);
    //     await this.crawlSingleDetailPage(ctx, ctx.page.url(), i);
    //   }
    // } else {
    //   await this.crawlSingleDetailPage(ctx, ctx.page.url(), 0);
    // }

    try {
      await this.crawlSingleDetailPage(ctx, ctx.page.url(), 0);

      const nrDropdownVariants = await this.getOptionsCountForParamIndex(
        ctx,
        0
      );
      const hasVariants = nrDropdownVariants > 0;

      if (hasVariants) {
        for (let i = 0; i < nrDropdownVariants; i++) {
          await this.selectOptionForParamIndex(ctx, 0, i);

          // Start counting variants from 1 and not 0 so that we scrape the 1st variant
          // twice. The 1st time the url will be the productGroup url for HACKY solution,
          // and the 2nd time with proper url.
          await this.crawlSingleDetailPage(ctx, ctx.page.url(), i + 1);
        }
      }

      // Enqueue the variant groups where you have a.href:
      await ctx.enqueueLinks({
        selector: "div.product-info ul.color-picker-list a",
        label: "DETAIL",
        userData: ctx.request.userData,
      });
    } catch (error) {
      console.log("Caught error, handling cookies");
      await this.handleCookieConsent(ctx.page);
      if (retryCount === 0) {
        throw error;
      }

      await this.crawlDetailPageMindingCookies(ctx, retryCount - 1);
    }
  }

  // Copied from this.crawlSingleDetailPage() for quick HACKY Bygghemma/Ellos solution
  // where you set the variant = 0, 1, 2, ..., and the variant 0 will have
  // its url changed to the variantGroupUrl.
  override async crawlSingleDetailPage(
    ctx: PlaywrightCrawlingContext,
    variantGroupUrl: string,
    variant: number
  ): Promise<void> {
    const productDetails = await this.extractProductDetails(ctx.page);
    const request = ctx.request;

    await this._detailsDataset.pushData(<DetailedProductInfo>{
      fetchedAt: new Date().toISOString(),
      retailerDomain: extractDomainFromUrl(ctx.page.url()),
      ...request.userData,
      ...productDetails,
      variantGroupUrl: variantGroupUrl,
      variant: variant,
    });
  }

  override async scrollToBottom(ctx: PlaywrightCrawlingContext): Promise<void> {
    const page = ctx.page;
    const loadMoreButton = page.locator("div.load-more-button");

    while (true) {
      await super.scrollToBottom(ctx);
      await this.registerProductCards(ctx);
      await this.handleCookieConsent(page);

      try {
        await loadMoreButton.click({ timeout: 15000 });
        // wait for consistency
        await new Promise((f) => setTimeout(f, 500));
      } catch (error) {
        // No more expand button to click => break
        break;
      }
    }
  }

  // DEPRECATED: Toan tried to paralellize the category exploration just like
  // Homeroom, but encounters some issues that give us less products.
  // Apparently Ellos page show 56 products but calculate the pagination
  // with 58 products, thus we are missing 2 products per (nrPages - 1).
  // override async crawlListPage(ctx: PlaywrightCrawlingContext): Promise<void> {
  //   const categoryUrl = ctx.page.url();
  //   if (!categoryUrl.includes("?page=")) {
  //     // Initial category page => Calculate the number of pages
  //     // and enqueue all pages to scrape.
  //     const nrProductsText = await ctx.page
  //       .locator("div.product-list-inner div.product-sort")
  //       .textContent();
  //     if (!nrProductsText) {
  //       throw new Error(
  //         "Cannot extract nrProductsText. Category url might be broken."
  //       );
  //     }

  //     const nrProducts = extractNumberFromText(nrProductsText);
  //     const nrPages = Math.ceil(nrProducts / this.categoryPageSize);

  //     const urlsToExplore = [];
  //     for (let i = 1; i <= nrPages; i++) {
  //       const url = categoryUrl.split("?")[0] + `?page=${i}`;
  //       urlsToExplore.push(url);

  //       await ctx.enqueueLinks({
  //         urls: [url],
  //         label: "LIST",
  //         userData: {
  //           ...ctx.request.userData,
  //           pageNumber: i,
  //         },
  //       });
  //     }

  //     log.info(
  //       `Category has ${nrProducts} products. Enqueued ${nrPages} pages to explore.`
  //     );

  //     return;
  //   }

  //   await super.crawlListPage(ctx);
  // }

  async extractCardProductInfo(
    categoryUrl: string,
    productCard: Locator
  ): Promise<ListingProductInfo> {
    const productName = await this.extractProperty(
      productCard,
      "h2.ellos-full-product-name",
      (node) => node.textContent()
    ).then((text) => {
      // Trim and replace multiple whitespaces/endlines with single white spaces
      return text?.trim().replaceAll(/\s+/g, " ");
    });
    if (!productName) throw new Error("Cannot find productName of productCard");

    const url = await this.extractProperty(
      productCard,
      "xpath=./a[1]",
      (node) => node.getAttribute("href")
    );
    if (!url) throw new Error("Cannot find url of productCard");

    const categoryTree = await this.extractCategoryTreeFromCategoryPage(
      productCard.page().locator("ul.navigation-breadcrumb-items li a[href]"),
      0,
      productCard.page().locator(".product-list-header h1")
    );

    const currentProductInfo: ListingProductInfo = {
      name: productName,
      url,
      categoryUrl,
      popularityCategory: categoryTree,
    };

    return currentProductInfo;
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    const productName = await this.extractProperty(
      page,
      "div.product-desc h1",
      (node) => node.textContent()
    ).then((text) =>
      // Trim and replace multiple whitespaces/endlines with single white spaces
      text?.trim().replaceAll(/\s+/g, " ")
    );
    if (!productName) {
      throw new Error("Cannot extract productName");
    }

    const brand = await this.extractProperty(
      page,
      "div.product-desc a.brand",
      (node) => node.textContent()
    ).then((text) => text?.trim());

    const priceText = await this.extractProperty(
      page,
      // "div.product-desc .offer span",
      "//div[contains(@class, 'product-desc')]//strong[contains(@class, 'offer')]//span[contains(text(), 'SEK')]",
      (node) => node.textContent()
    );
    if (!priceText) {
      throw new Error("Cannot extract priceText");
    }
    const price = extractPriceFromPriceText(priceText);
    const originalPriceText = await this.extractProperty(
      page,
      "div.product-desc .offer s",
      (node) => node.textContent()
    );
    const isDiscounted = !!originalPriceText;
    const originalPrice = isDiscounted
      ? extractPriceFromPriceText(originalPriceText)
      : undefined;

    const description = await this.extractProperty(
      page,
      "div.product-details-intro",
      (node) => node.textContent()
    ).then((text) => text?.trim());

    const sku = await extractSKUFromProductPage(page);

    const schemaOrgString = await page
      .locator(
        "//script[@type='application/ld+json' and contains(text(), 'schema.org') and contains(text(), 'Product')]"
      )
      .textContent();
    if (!schemaOrgString) {
      throw new Error("Cannot extract schema.org data");
    }
    const schemaOrg = JSON.parse(schemaOrgString);

    let availability;
    try {
      availability = schemaOrg.offers.availability.includes("InStock")
        ? "in_stock"
        : "out_of_stock";
    } catch (error) {
      throw new Error("Cannot extract availability of product");
    }

    let reviews: ProductReviews | "unavailable";
    if (
      schemaOrg.aggregateRating &&
      schemaOrg.aggregateRating.ratingValue &&
      schemaOrg.aggregateRating.reviewCount
    ) {
      reviews = {
        averageReview: schemaOrg.aggregateRating.ratingValue,
        reviewCount: schemaOrg.aggregateRating.reviewCount,
        recentReviews: [],
      };
    } else {
      reviews = "unavailable";
    }

    const imageUrls = await extractImagesFromDetailedPage(page);

    const categoryTree = await this.extractCategoryTree(
      page.locator("ul.navigation-breadcrumb-items li a[href]"),
      0
    );

    // Change the url here for variants.
    // This is due to choosing variants from the dropdown doesn't change the url,
    // so we have to change it manually.
    // https://www.ellos.se/venture-home/abc/1651926-01
    // -> https://www.ellos.se/venture-home/abc/1651926-01-13
    const urlParts = page.url().split("/");
    urlParts.pop();
    const variantUrl = urlParts.join("/") + "/" + sku;
    log.info("Variant url: " + variantUrl);

    const productInfo = {
      brand,
      name: productName,
      description,
      url: variantUrl,
      price: price,
      currency: "SEK",
      isDiscounted,
      originalPrice,

      sku,
      mpn: sku,

      availability,
      images: imageUrls,
      reviews,
      specifications: [], // TODO: extract specifications
      categoryTree,
      metadata: {
        schemaOrg: schemaOrg,
      },
    };

    return productInfo;
  }

  async selectOptionForParamIndex(
    ctx: PlaywrightCrawlingContext<Dictionary<any>>,
    paramIndex: number,
    optionIndex: number
  ): Promise<void> {
    // const dropDownButtonLocator = ctx.page.locator(
    //   "button.cta-outline-variant-1-l"
    // );
    // const hasDropDrownVariants = (await dropDownButtonLocator.count()) > 0;
    // if (hasDropDrownVariants) {
    //   await dropDownButtonLocator.click();
    //   await ctx.page.waitForSelector("table.picker-sizes tbody tr");

    //   await ctx.page
    //     .locator("table.picker-sizes tbody tr:not(.no-stock)")
    //     .nth(optionIndex)
    //     .click();
    // }

    const dropDownButtonLocator = ctx.page
      .locator("button.cta.type-outline.size-l")
      .nth(paramIndex);
    await dropDownButtonLocator.click();
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
      .locator("button.cta.type-outline.size-l")
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

    // Wait for 5 more second just in case
    await ctx.page.waitForTimeout(5000);

    return currentState;
  }

  static async create(
    launchOptions: CrawlerLaunchOptions
  ): Promise<EllosCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets(
        launchOptions?.uniqueCrawlerKey
      );

    return new EllosCrawlerDefinition({
      detailsDataset,
      listingDataset,
      detailsUrlSelector: "//article[contains(@class, 'product-card')]//a",
      productCardSelector: "//article[contains(@class, 'product-card')]",
      cookieConsentSelector: "a.cta-ok",
      dynamicProductCardLoading: true,
      launchOptions,
    });
  }
}

function extractPriceFromPriceText(priceText: string) {
  return parseInt(
    priceText.replace(" ", "").replace("SEK", "").replaceAll("\u00A0", "")
  );
}
async function extractSKUFromProductPage(
  page: Page
): Promise<string | undefined> {
  const skuText = await page.locator("p.product-details-sku").textContent();
  if (!skuText) {
    log.error("Cannot extract SKU of product");
    return undefined;
  }
  // Extract SKU from string.
  // "Artikelnummer: 1705327-01-24" -> "1705327-01-24"
  try {
    const sku = skuText.split(":")[1].trim();
    return sku;
  } catch {
    log.error("Cannot extract SKU of product");
    return undefined;
  }
}
