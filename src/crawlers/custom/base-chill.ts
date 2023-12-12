/**
 * Common scraping functions for Chilli-like retailers
 * including: chilli.se, furniturebox.se, trademax.se
 */

import { log } from "crawlee";
import { Locator, Page } from "playwright";
import {
  Category,
  DetailedProductInfo,
  IndividualReview,
  ListingProductInfo,
  OfferMetadata,
  ProductReviews,
} from "../../types/offer";
import {
  AbstractCrawlerDefinition,
  CrawlerDefinitionOptions,
  CrawlerLaunchOptions,
} from "../abstract";
import { PageNotFoundError } from "../../types/errors";
import { extractNumberFromText } from "../../utils";

export async function createCrawlerDefinitionOption(
  launchOptions?: CrawlerLaunchOptions
): Promise<CrawlerDefinitionOptions> {
  const [detailsDataset, listingDataset] =
    await AbstractCrawlerDefinition.openDatasets(
      launchOptions?.uniqueCrawlerKey
    );

  return {
    detailsDataset,
    listingDataset,
    listingUrlSelector: "//div[@data-cy = 'pagination_controls']/a",
    detailsUrlSelector: "//a[contains(@class, 'ProductCard_card__global')]",
    productCardSelector: "//a[contains(@class, 'ProductCard_card__global')]",
    cookieConsentSelector: "#onetrust-accept-btn-handler",
    dynamicProductCardLoading: false,
  };
}

export async function extractCardProductInfo(
  crawlerDefinition: AbstractCrawlerDefinition,
  categoryUrl: string,
  productCard: Locator
): Promise<ListingProductInfo> {
  const productName = await crawlerDefinition.extractProperty(
    productCard,
    "..//h3[contains(@class, 'ProductCardTitle__global')]",
    (node) => node.textContent(),
    false
  );
  if (!productName) throw new Error("Cannot find productName of productCard");

  const url = await crawlerDefinition.extractProperty(
    productCard,
    "..//a[1]",
    (node) => node.getAttribute("href"),
    false
  );
  if (!url) throw new Error("Cannot find url of productCard");

  const categoryTree =
    await crawlerDefinition.extractCategoryTreeFromCategoryPage(
      productCard.page().locator("div#breadcrumbs a"),
      1,
      productCard.page().locator("div#breadcrumbs > div > span")
    );

  return {
    name: productName,
    url,
    categoryUrl,
    popularityCategory: categoryTree,
  };
}

export async function extractProductDetails(
  crawlerDefinition: AbstractCrawlerDefinition,
  page: Page
) {
  if (!isProductPage(page.url())) {
    throw new PageNotFoundError("Page not found");
  }

  try {
    await page.waitForSelector("main div.n9 h1", {
      timeout: 15000,
    });
  } catch (error) {
    log.error(
      `No product title found, potentially brokenlink. Url: ${page.url()}`
    );
    throw error;
  }
  await crawlerDefinition.handleCookieConsent(page);

  const productName = await page.locator("main div.n9 h1").textContent();
  if (!productName) {
    throw new Error("Cannot extract productName");
  }

  const brand = await crawlerDefinition.extractProperty(
    page,
    "main div.n9 > div > a.cv",
    (node) => node.textContent()
  );

  const priceText = await page
    .locator("main div.n9 div.d4 span.al")
    .textContent();
  if (!priceText) throw new Error("Cannot extract priceText");
  const price = parseInt(priceText.replace("SEK", "").replace(/\s/g, ""));

  const originalPriceString = await crawlerDefinition.extractProperty(
    page,
    "main div.n9 div.d4 span.bf",
    (node) => node.textContent()
  );

  const addToCartLocator = page.locator("main div.n9 div.n4 button");
  const availability =
    (await addToCartLocator.count()) > 0 ? "in_stock" : "out_of_stock";

  const isDiscounted = originalPriceString !== undefined;
  const originalPrice = originalPriceString
    ? parseInt(originalPriceString.replace("SEK", "").replace(/\s/g, ""))
    : undefined;

  const images = await extractImagesFromProductPage(page);
  const breadcrumbLocator = page.locator("//div[@id = 'breadcrumbs']//a");
  const categoryTree = await crawlerDefinition.extractCategoryTree(
    breadcrumbLocator,
    1
  );

  let reviewSummary: ProductReviews | undefined;

  const averageReviewString = await crawlerDefinition.extractProperty(
    page,
    "div#ratings-section h3 div.am",
    (node) => node.textContent()
  );
  const reviewCountString = await crawlerDefinition.extractProperty(
    page,
    "div#ratings-section h3 div.kt",
    (node) => node.textContent()
  );

  if (averageReviewString && reviewCountString) {
    reviewSummary = {
      reviewCount: extractNumberFromText(reviewCountString),
      averageReview: parseFloat(averageReviewString),
      recentReviews: [],
    };
  }

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

  // NOTE: The commented out fields are different for each website, so they are not extracted here.
  // Implement them in the specific Chilli/Furniturebox/Trademax crawler.
  const intermediateResult = {
    brand,
    name: productName,
    // description,
    url: page.url(),
    price,
    currency: "SEK",
    isDiscounted,
    originalPrice,

    gtin: undefined,
    // sku,
    mpn,

    availability,
    images,
    reviews: reviewSummary,
    // specifications,
    categoryTree,
    metadata,
  };

  return intermediateResult;
}

export async function extractImagesFromProductPage(
  page: Page
): Promise<string[]> {
  const imageThumbnailLocator = await page.locator("main div.fs div.a06 img");

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
    .locator("main div.fs div.d2 img")
    .evaluateAll((list: HTMLElement[]) =>
      list.map((element) => <string>element.getAttribute("src"))
    );

  return images;
}

export function isProductPage(url: string): boolean {
  const match = url.match(/p\d+/);
  if (!match) {
    return false;
  }
  return true;
}

export async function getVariantUrlsFromSchemaOrg(
  page: Page
): Promise<string[]> {
  const schemaOrgString = await page
    .locator(
      "//script[@type='application/ld+json' and contains(text(), 'schema.org') and contains(text(), 'Product')]"
    )
    .textContent();
  if (!schemaOrgString) {
    throw new Error("Cannot extract schema.org data");
  }
  const schemaOrg = JSON.parse(schemaOrgString);

  const offerUrls = schemaOrg.offers.map((offer: any) => offer.url);

  return offerUrls;
}
