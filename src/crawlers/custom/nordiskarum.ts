import { Locator, Page } from "playwright";
import { log, PlaywrightCrawlingContext } from "crawlee";

import { AbstractCrawlerDefinition, CrawlerLaunchOptions } from "../abstract";
import {
  Category,
  DetailedProductInfo,
  ListingProductInfo,
  Specification,
} from "../../types/offer";

export class NordiskaRumCrawlerDefinition extends AbstractCrawlerDefinition {
  protected override categoryPageSize: number = 12;

  override async crawlListPage(ctx: PlaywrightCrawlingContext): Promise<void> {
    // Crawl list page in parallel since each page takes too long to load:
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

        const nrPages = parseInt(lastPageNumberText.trim());
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

    await super.crawlListPage(ctx);
  }

  async extractCardProductInfo(
    categoryUrl: string,
    productCard: Locator
  ): Promise<ListingProductInfo> {
    const productName = await this.extractProperty(
      productCard,
      "a.sf-product-card__link h3",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    if (!productName) throw new Error("Cannot find productName of productCard");

    const url = await this.extractProperty(
      productCard,
      "> a.sf-product-card__link",
      (node) => node.getAttribute("href")
    );
    if (!url) throw new Error("Cannot find url of productCard");

    const categoryTree = await this.extractCategoryTreeFromCategoryPage(
      productCard
        .page()
        .locator(
          "li.sf-breadcrumbs__list-item a:not(.sf-breadcrumbs__breadcrumb--current)"
        ),
      1,
      productCard
        .page()
        .locator(
          "li.sf-breadcrumbs__list-item a.sf-breadcrumbs__breadcrumb--current"
        )
    );

    return {
      name: productName,
      url,
      categoryUrl,
      popularityCategory: categoryTree,
    };
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    // Their website is very slow at loading the images
    page.setDefaultTimeout(90000);

    // Wait for images
    await page
      .locator(".m-product-gallery ul.glide__slides img:not(.noscript)")
      .first()
      .waitFor({ state: "attached" })
      .catch(() => {
        log.warning("Cannot find product images", { url: page.url() });
      });

    const productName = await this.extractProperty(
      page,
      "div.product__info .sf-product-name",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    if (!productName) throw new Error("Cannot extract productName");

    const description = await this.extractProperty(
      page,
      "div.product__info .product__description",
      (node) => node.first().textContent()
    ).then((text) => text?.trim());

    const price = await this.extractPriceFromProductDetailsPage(page);
    const originalPrice = await this.extractOriginalPriceFromProductDetailsPage(
      page
    ).catch(() => {
      log.warning("Cannot extract original price", { url: page.url() });
      return undefined;
    });
    const isDiscounted = !!originalPrice;

    const images = await this.extractProductImagesFromProductDetailsPage(page);

    const availabilitySchemaOrg = await this.extractProperty(
      page,
      "meta[itemprop='availability']",
      (node) => node.getAttribute("content")
    ).then((text) => text?.trim());

    // default to in stock since we haven't found any out of stock products on their website
    let availability = "in_stock";
    if (availabilitySchemaOrg) {
      availability = availabilitySchemaOrg.includes("InStock")
        ? "in_stock"
        : "out_of_stock";
    }

    const skuText = await this.extractProperty(
      page,
      "div.product__info .product__sku",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    const sku = skuText?.replace("Artikelnummer:", "").trim();

    const specKeys = await page
      .locator("div.product__info .sf-property__name")
      .allTextContents()
      .then((textContents) => textContents.map((text) => text.trim()));
    const specVals = await page
      .locator("div.product__info .sf-property__value")
      .allTextContents()
      .then((textContents) => textContents.map((text) => text.trim()));
    if (specKeys.length !== specVals.length) {
      log.warning("Cannot extract specs: number of keys and vals mismatch.");
    }

    const specifications: Specification[] = [];
    for (let i = 0; i < specKeys.length; i++) {
      specifications.push({ key: specKeys[i], value: specVals[i] });
    }
    const brand = specifications.find((spec) =>
      spec.key.includes("Varumärke")
    )?.value;

    const categoryTree = await this.extractCategoryTree(
      page.locator(
        "li.sf-breadcrumbs__list-item a:not(.sf-breadcrumbs__breadcrumb--current)"
      ),
      1
    );

    return {
      name: productName,
      url: page.url(),

      brand,
      description,
      price,
      originalPrice,
      isDiscounted,
      currency: "SEK",
      images,
      categoryTree,

      gtin: undefined,
      sku,
      mpn: sku,

      availability,
      reviews: "unavailable",
      specifications,

      metadata: {},
    };
  }

  async extractOriginalPriceFromProductDetailsPage(page: Page) {
    let priceText = await this.extractProperty(
      page,
      "div.product__info .sf-price__old",
      (node) => node.textContent()
    ).then((text) => text?.trim());

    if (!priceText) {
      return undefined;
    }

    const originalPrice = parseInt(
      priceText.toLowerCase().replace("kr", "").replace(/\s/g, "")
    );
    return originalPrice;
  }

  async extractPriceFromProductDetailsPage(page: Page) {
    let priceText = await this.extractProperty(
      page,
      "div.product__info .sf-price__regular",
      (node) => node.textContent()
    ).then((text) => text?.trim());

    if (!priceText) {
      priceText = await this.extractProperty(
        page,
        "div.product__info .sf-price__special",
        (node) => node.textContent()
      ).then((text) => text?.trim());
    }

    if (!priceText) {
      throw new Error("Cannot extract price");
    }

    const price = parseInt(
      priceText
        .toLowerCase()
        .replace("kr", "")
        .replace(/\s/g, "")
        .replace(",", "")
    );
    return price;
  }

  async extractProductImagesFromProductDetailsPage(
    page: Page
  ): Promise<string[]> {
    // Try to extract from thumbnails:
    const imageLocator = page.locator(
      ".m-product-gallery ul.glide__slides img:not(.noscript)"
    );
    const imageCount = await imageLocator.count();
    const images = [];
    for (let i = 0; i < imageCount; ++i) {
      // Try to get the image but catch the exception in case it happens
      const imgUrl = await imageLocator
        .nth(i)
        .getAttribute("src")
        .catch(() => {
          log.warning("Cannot extract image url", { url: page.url() });
          return null;
        });
      if (imgUrl) {
        images.push(imgUrl);
      }
    }

    // Deduplicate images
    return [...new Set(images)];
  }

  async extractCategoryTreeOfCategorypage(page: Page): Promise<Category[]> {
    const breadcrumbLocator = page.locator("div.breadcrumbs li");
    const breadcrumbCount = await breadcrumbLocator.count();
    const categoryTree = [];
    const startingIndex = 1; // ignore 1st breadcrum which is the homepage

    for (let i = startingIndex; i < breadcrumbCount; i++) {
      const name = (<string>(
        await breadcrumbLocator.nth(i).textContent()
      )).trim();

      const url =
        i === breadcrumbCount - 1
          ? page.url()
          : <string>(
              await breadcrumbLocator.nth(i).locator("a").getAttribute("href")
            );

      categoryTree.push({
        name,
        url,
      });
    }

    return categoryTree;
  }

  static async create(
    launchOptions?: CrawlerLaunchOptions
  ): Promise<NordiskaRumCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets();

    return new NordiskaRumCrawlerDefinition({
      detailsDataset,
      listingDataset,
      listingUrlSelector: "nav.sf-pagination a.sf-link",
      detailsUrlSelector: ".sf-product-card > a.sf-product-card__link",
      productCardSelector: ".sf-product-card",
      cookieConsentSelector: "button#CybotCookiebotDialogBodyLevelButtonAccept",
      launchOptions,
    });
  }
}
