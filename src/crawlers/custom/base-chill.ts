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
} from "../abstract";
import { PageNotFoundError } from "../../types/errors";

export async function createCrawlerDefinitionOption(): Promise<CrawlerDefinitionOptions> {
  const [detailsDataset, listingDataset] =
    await AbstractCrawlerDefinition.openDatasets();

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
    await page.waitForSelector("h1[data-cy='product_title']", {
      timeout: 15000,
    });
  } catch (error) {
    log.error(
      `No product title found, potentially brokenlink. Url: ${page.url()}`
    );
    throw error;
  }
  await crawlerDefinition.handleCookieConsent(page);

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

  const productName = await page
    .locator("h1[data-cy='product_title']")
    .textContent();
  const price_text = await page
    .locator("div#productInfoPrice div[data-cy='current-price']")
    .textContent();
  const price = Number(price_text?.replace(" ", ""));

  const images = await extractImagesFromProductPage(page);
  const breadcrumbLocator = page.locator("//div[@id = 'breadcrumbs']//a");
  const categoryTree = await crawlerDefinition.extractCategoryTree(
    breadcrumbLocator,
    1
  );

  const brand = await crawlerDefinition.extractProperty(
    page,
    "//span[contains(strong/text(), ('Varumärke'))]/span/a",
    (node) => node.textContent()
  );
  const originalPriceString = await crawlerDefinition.extractProperty(
    page,
    "xpath=(//div[contains(@class, 'productInfoContent--buySectionBlock')]//div[@data-cy = 'original-price'])[1]",
    (node) => node.textContent()
  );

  let reviewSummary: ProductReviews | "unavailable";
  try {
    const averageReviewString = await crawlerDefinition.extractProperty(
      page,
      "//div[contains(@class, 'accordionRatingContainer')]/span[1]",
      (node) => node.textContent()
    );
    const averageReview = Number(averageReviewString);

    const reviewCountString = <string>(
      await crawlerDefinition.extractProperty(
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
        await crawlerDefinition.extractProperty(
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
    // log.info(`Reviews not found for product with url: ${page.url()}`);
    reviewSummary = "unavailable";
  }

  const addToCartLocator = page.locator("#A2C_ACTION");
  const availability =
    (await addToCartLocator.count()) > 0 ? "in_stock" : "out_of_stock";

  const isDiscounted = originalPriceString !== undefined;
  const originalPrice = originalPriceString
    ? Number(originalPriceString.replace("SEK", "").replace(/\s/g, ""))
    : undefined;

  // NOTE: The commented out fields are different for each website, so they are not extracted here.
  // Implement them in the specific Chilli/Furniturebox/Trademax crawler.
  const intermediateResult = {
    brand,
    name: <string>productName,
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
  const imagesPreviewLocator = await page.locator(
    "//div[contains(@class, 'ProductInfoSliderNavigation__global')]//div[contains(@class, 'slick-track')]//div[contains(@class, 'slick-slide')]//img"
  );

  try {
    await imagesPreviewLocator.waitFor({ timeout: 10000 });
  } catch (e) {
    // Probably no images thumbnails -> do nothing and just scrape the main image
  }

  const imagesCount = await imagesPreviewLocator.count();
  for (let i = 0; i < imagesCount; i++) {
    const currentImagePreview = imagesPreviewLocator.nth(i);
    await currentImagePreview.click();
    await page.waitForTimeout(50);
  }
  const images = await page
    .locator("div#productInfoImage div.slick-slide div.z3Vk_ img")
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
