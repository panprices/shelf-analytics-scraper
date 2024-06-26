/**
 * Common scraping functions for Chilli-like retailers
 * including: chilli.se, furniturebox.se, trademax.se
 */

import { Locator, Page } from "playwright";
import {
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
import { findElementByCSSProperties } from "../scraper-utils";

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
    listingUrlSelector:
      "//div[@data-scroll-id='product-listing'] //div[contains(text(), 'Visar')] /..//a[@data-spa-link][last()]",
    detailsUrlSelector: "li a[role='article']",
    productCardSelector: "li a[role='article']",
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
    "h2",
    (node) => node.textContent(),
    false
  );
  if (!productName) throw new Error("Cannot find productName of productCard");

  const url = await productCard.getAttribute("href");
  if (!url) throw new Error("Cannot find url of productCard");

  const categoryTree =
    await crawlerDefinition.extractCategoryTreeFromCategoryPage(
      productCard.page().locator("main nav span a"),
      1,
      productCard.page().locator("main nav span > span")
    );

  return {
    name: productName,
    url,
    categoryUrl,
    popularityCategory: categoryTree,
  };
}

export async function extractImageFromProductPage(
  page: Page,
  mainLocator: Locator
): Promise<string[]> {
  const imagesPreviewRootLocator = await findElementByCSSProperties(
    mainLocator,
    { maxHeight: "495px", gridAutoFlow: "row" },
    "div"
  );
  if (!imagesPreviewRootLocator) {
    throw new Error("No images preview root found");
  }

  const imagesPreviewLocator = imagesPreviewRootLocator.locator("img");
  const imagesCount = await imagesPreviewLocator.count();
  for (let i = 0; i < imagesCount; i++) {
    const currentImagePreview = imagesPreviewLocator.nth(i);
    await currentImagePreview.click();
    await page.waitForTimeout(50);
  }

  const imageUrls = [];
  const imageViewRootLocator = await findElementByCSSProperties(mainLocator, {
    columnGap: "0px",
    rowGap: "0px",
  });
  if (!imageViewRootLocator) {
    throw new Error("No image view found");
  }

  for (const img of await imageViewRootLocator.locator("img").all()) {
    const url = await img.getAttribute("src");
    if (url) {
      imageUrls.push(url);
    }
  }

  return imageUrls;
}

export async function extractProductDetails(
  crawlerDefinition: AbstractCrawlerDefinition,
  page: Page
) {
  if (!isProductPage(page.url())) {
    throw new PageNotFoundError("Page not found");
  }
  await crawlerDefinition.handleCookieConsent(page);

  const mainLocator = page.locator("main#maincontent");
  const productMainLocator = mainLocator.locator("xpath=./div[2]");

  const productNameLocator = await findElementByCSSProperties(
    productMainLocator,
    {
      fontSize: "20px",
    },
    "h1"
  );
  if (!productNameLocator) {
    throw new Error("Cannot extract productName");
  }

  const productName = await productNameLocator
    .innerText()
    .then((t) => t?.split("\n")[0]);

  let brand = await findElementByCSSProperties(
    productNameLocator,
    {
      fontWeight: "400",
    },
    "div"
  )
    .then((l) => l?.textContent())
    .then((t) => t?.trim());

  const brandUrl =
    (await findElementByCSSProperties(
      productMainLocator,
      {
        maxHeight: "35px",
      },
      // easier to get the image inside the `a` element and fetch its parent
      "img"
    )
      .then((l) => l?.locator("xpath=.."))
      .then((l) => l?.getAttribute("href"))) ?? undefined;

  const overviewData = await page
    .locator(
      "//main//div[contains(@class, 'ac') and .//span/text()='Översikt']//ul/li"
    )
    .allTextContents();
  if (!brand) {
    for (const text of overviewData) {
      if (text.includes("Varumärke:")) {
        brand = text.replace("Varumärke:", "").trim();
      }
    }
  }

  const priceText = await findElementByCSSProperties(
    productMainLocator,
    {
      fontWeight: "800",
    },
    "span"
  ).then((l) => l?.textContent());
  if (!priceText) throw new Error("Cannot extract priceText");
  const price = parseInt(priceText.replace("kr", "").replace(/\s/g, ""));

  const originalPriceString = await findElementByCSSProperties(
    productMainLocator,
    {
      textDecorationLine: "line-through",
    }
  ).then((l) => l?.textContent());
  const isDiscounted = originalPriceString !== undefined;
  const originalPrice = originalPriceString
    ? parseInt(originalPriceString.replace("SEK", "").replace(/\s/g, ""))
    : undefined;

  const addToCartLocator = page.locator(
    "button[data-test-id='add-to-cart-button']"
  );
  const availability =
    (await addToCartLocator.count()) > 0 ? "in_stock" : "out_of_stock";

  const breadcrumbLocator = page.locator("main nav span a");
  const categoryTree = await crawlerDefinition.extractCategoryTree(
    breadcrumbLocator,
    1
  );

  let reviewSummary: ProductReviews | undefined;

  const reviewCountString = await crawlerDefinition.extractProperty(
    page,
    "div#ratings-section h3 div.lg",
    (node) => node.textContent()
  );
  const averageReviewString = await crawlerDefinition.extractProperty(
    page,
    "div#ratings-section h3 div.lc",
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

  const images = await extractImageFromProductPage(page, productMainLocator);

  // NOTE: The commented out fields are different for each website, so they are not extracted here.
  // Implement them in the specific Chilli/Furniturebox/Trademax crawler.
  return {
    name: productName,
    brand,
    brandUrl,
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
): Promise<string[] | undefined> {
  const schemaOrgString = await page
    .locator(
      "//script[@type='application/ld+json' and contains(text(), 'schema.org') and contains(text(), 'Product')]"
    )
    .textContent();
  if (!schemaOrgString) {
    throw new Error("Cannot extract schema.org data");
  }
  const schemaOrg = JSON.parse(schemaOrgString);

  const offerUrls = schemaOrg.offers?.map((offer: any) => offer.url);

  return offerUrls;
}
