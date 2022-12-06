import { Locator, Page } from "playwright";
import { log, PlaywrightCrawlingContext } from "crawlee";

import { AbstractCrawlerDefinition } from "../abstract";
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
import { extractNumberFromText } from "../../utils";

export class UnolivingCrawlerDefinition extends AbstractCrawlerDefinition {
  override async scrollToBottom(ctx: PlaywrightCrawlingContext): Promise<void> {
    const page = ctx.page;

    while (true) {
      await this.handleCookieConsent(page);
      await super.scrollToBottom(ctx);

      // wait for consistency
      await new Promise((f) => setTimeout(f, 500));
      const loadMoreButton = page.locator("button.ais-InfiniteHits-loadMore");

      try {
        await loadMoreButton.click({ timeout: 5000 });
      } catch (error) {
        // No more expand button to click => break
        break;
      }
    }
  }

  async extractCardProductInfo(
    categoryUrl: string,
    productCard: Locator
  ): Promise<ListingProductInfo> {
    const productName = await this.extractProperty(
      productCard,
      "div.product-item-name",
      (node) => node.textContent()
    ).then((text) => text?.trim());
    if (!productName) throw new Error("Cannot find productName of productCard");

    const url = await this.extractProperty(
      productCard,
      "div.product-item-name a",
      (node) => node.getAttribute("href")
    );
    if (!url) throw new Error("Cannot find url of productCard");

    const currentProductInfo: ListingProductInfo = {
      name: productName,
      url,
      popularityIndex: -1, // will be overwritten later
      categoryUrl,
    };

    return currentProductInfo;
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    const productNameSelector = "div.product-info-main h1.page-title";
    await page.waitForSelector(productNameSelector);

    const productName = await this.extractProperty(
      page,
      productNameSelector,
      (node) => node.textContent()
    ).then((text) => text?.trim());
    if (!productName) {
      throw new Error("Cannot extract productName");
    }

    const brand = await this.extractProperty(
      page,
      "div.product-info-main h2.pdp__brand__title",
      (node) => node.textContent()
    ).then((text) => text?.trim());

    // Description: Finding div that has h2 = Produktinformation -> take that
    const description = await extractDescriptionFromProductDetailsPage(page);

    const priceText = await this.extractProperty(
      page,
      "div.product-info-main span[data-price-type='finalPrice']",
      (node) => node.getAttribute("data-price-amount")
    );
    if (!priceText) {
      throw new Error("Cannot extract price");
    }
    const price = parseFloat(priceText);

    const originalPriceText = await this.extractProperty(
      page,
      "div.product-info-main span[data-price-type='oldPrice']",
      (node) => node.getAttribute("data-price-amount")
    );
    const originalPrice = originalPriceText
      ? parseFloat(originalPriceText)
      : undefined;
    const isDiscounted = originalPrice !== undefined;

    const metadata: OfferMetadata = {};
    const schemaOrgString = await page
      .locator(
        "//script[@type='application/ld+json' and contains(text(), 'schema.org') and contains(text(), 'Product')]"
      )
      .textContent();
    if (!schemaOrgString) {
      throw new Error("Cannot extract schema.org data");
    }
    const schemaOrg = JSON.parse(schemaOrgString);
    metadata.schemaOrg = schemaOrg;

    const gtin = metadata.schemaOrg?.gtin;
    const sku = metadata.schemaOrg?.sku;
    const imageUrls = metadata.schemaOrg?.image ?? [];

    let availability;
    try {
      availability = schemaOrg.offers.availability.includes("InStock")
        ? "in_stock"
        : "out_of_stock";
    } catch (error) {
      throw new Error("Cannot extract availability of product");
    }

    const reviews: "unavailable" | ProductReviews = "unavailable";

    const specContents = await page
      .locator("ul.features-list li")
      .allTextContents()
      .then((texts) => texts.filter((text) => text.includes(":")));

    const specKeys = specContents.map((text) => text.split(":")[0].trim());
    const specVals = specContents.map((text) => text.split(":")[1].trim());

    let specifications: Specification[];
    if (specKeys.length === specVals.length) {
      specifications = specKeys.map((key, i) => {
        return { key, value: specVals[i] };
      });
    } else {
      specifications = [];
      log.error(
        "Cannot extract specifications: specKeys and specVals length mismatch"
      );
    }

    const categoryTree = await this.extractCategoryTree(
      page.locator("div.breadcrumbs li a"),
      1
    );

    const productInfo = {
      brand,
      name: productName,
      description,
      url: page.url(),
      price: price,
      currency: "DKK",
      isDiscounted,
      originalPrice,

      gtin,
      sku,
      articleNumber: sku,

      availability,
      images: imageUrls,
      reviews,
      specifications,
      categoryTree,
      metadata,
    };

    return productInfo;
  }

  static async create(): Promise<UnolivingCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets();

    return new UnolivingCrawlerDefinition({
      detailsDataset,
      listingDataset,
      // listingUrlSelector: "button.ais-InfiniteHits-loadMore",
      detailsUrlSelector: "ol li.plp__grid-item div.product-item-name a",
      productCardSelector: "ol li.plp__grid-item",
      cookieConsentSelector: "button.coi-banner__accept",
      dynamicProductCardLoading: false,
    });
  }
}

async function extractDescriptionFromProductDetailsPage(page: Page) {
  const infoTabTitles = await page
    .locator("div.pdp__accordion div[data-role='collapsible']")
    .allTextContents();
  const infoTabContentLocator = await page.locator(
    "div.pdp__accordion div[data-role='content']"
  );

  // if (infoTabTitles.length !== infoTabContents.length) {
  //   log.error(
  //     "Cannot extract description: number of infoTabTitles and infoTabContents mismatch"
  //   );
  //   return undefined;
  // }

  const descriptionIndex = infoTabTitles.findIndex(
    (text) => text.trim() === "Produktinformation"
  );
  if (descriptionIndex < 0) {
    log.error(
      "Cannot extract description: cannot find 'Produktinformation' content tab"
    );
    return undefined;
  }

  return await infoTabContentLocator
    .nth(descriptionIndex)
    .locator("p")
    .allTextContents()
    .then((allText) => allText.join("\n").trim());
}
