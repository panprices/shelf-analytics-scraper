import { initializeApp, applicationDefault } from "firebase-admin/app";
import { Category, ListingProductInfo } from "../src/types/offer";

export function setupBeforeTest() {
  initializeApp({
    credential: applicationDefault(),
  });

  jest.setTimeout(300000);
}

export function expectExploreCategory(
  result: ListingProductInfo[],
  expectProductsCount: number,
  expectCategoryTree: Category[]
) {
  expect(result).toHaveLength(expectProductsCount);
  expect(result.map((p) => p.popularityCategory)).toEqual(
    Array(expectProductsCount).fill(expectCategoryTree)
  );

  // Need to sort the products by popularityIndex because it's not guaranteed
  // to be in order. This might be because of how the page is loaded, i.e. the
  // productCard is loaded quickly, but the productName takes a long time to load.
  expect(result.map((p) => p.popularityIndex)).toBeGreaterThan(0);
  expect(result.map((p) => p.popularityIndex).sort((a, b) => a! - b!)).toEqual(
    Array.from({ length: expectProductsCount }, (_, i) => i + 1) // [1, 2, 3, ...]
  );
}
