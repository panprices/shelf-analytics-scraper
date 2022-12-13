/**
 * Common scraping functions for Chilli-like retailers
 * including: chilli.se, furniturebox.se, trademax.se
 */

import { log } from "crawlee";
import { Locator, Page } from "playwright";
import {
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
  const productName = <string>(
    await crawlerDefinition.extractProperty(
      productCard,
      "..//h3[contains(@class, 'ProductCardTitle__global')]",
      (node) => node.textContent()
    )
  );
  if (!productName) throw new Error("Cannot find productName of productCard");

  const url = await crawlerDefinition.extractProperty(
    productCard,
    "..//a[1]",
    (node) => node.getAttribute("href")
  );
  if (!url) throw new Error("Cannot find url of productCard");

  const imageUrl = await crawlerDefinition.extractProperty(
    productCard,
    "xpath=(..//img)[1]",
    crawlerDefinition.extractImageFromSrcSet
  );

  return {
    name: productName,
    previewImageUrl: imageUrl,
    url,
    categoryUrl,
    popularityIndex: -1,
  };
}

export async function extractProductDetails(
  crawlerDefinition: AbstractCrawlerDefinition,
  page: Page
) {
  try {
    await page.waitForSelector("h1[data-cy='product_title']", {
      timeout: 5000,
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

  const sku = metadata.schemaOrg?.mpn;

  const productName = await page
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
    log.info(`Reviews not found for product with url: ${page.url()}`);
    reviewSummary = "unavailable";
  }

  const addToCartLocator = page.locator("#A2C_ACTION");
  const availability =
    (await addToCartLocator.count()) > 0 ? "in_stock" : "out_of_stock";

  const isDiscounted = originalPriceString !== undefined;
  const originalPrice = originalPriceString
    ? Number(originalPriceString.replace("SEK", "").replace(/\s/g, ""))
    : undefined;

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
    sku,

    availability,
    images,
    reviews: reviewSummary,
    // specifications,
    categoryTree,
    metadata,
  };

  return intermediateResult;
}
