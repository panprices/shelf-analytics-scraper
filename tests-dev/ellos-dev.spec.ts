import { exploreCategory, scrapeDetails } from "../src/service";
import { ListingProductInfo } from "../src/types/offer";
import { expectExploreCategory } from "./utils.test";

jest.setTimeout(300000);

function dummyRequest(targetUrl: string) {
  return {
    url: targetUrl,
    userData: {
      jobId: "job_test_1",
      url: targetUrl,
      popularityIndex: 1,
      label: "DETAIL",
    },
  };
}

test("Category page", async () => {
  const targetUrl = "https://www.ellos.se/hem-inredning/mobler/bord/skrivbord";
  const result = (await exploreCategory(targetUrl, "job_test_1")).map(
    (res) => res.userData as ListingProductInfo
  );

  expectExploreCategory(result, 105, [
    {
      name: "Hem",
      url: "https://www.ellos.se/hem-inredning",
    },
    {
      name: "Möbler",
      url: "https://www.ellos.se/hem-inredning/mobler",
    },
    {
      name: "Bord",
      url: "https://www.ellos.se/hem-inredning/mobler/bord",
    },
    {
      name: "Skrivbord",
      url: "https://www.ellos.se/hem-inredning/mobler/bord/skrivbord",
    },
  ]);
});

// Skip this because one of the variant is out of stock and is not displayed
// on the page anymore.
test.skip("Product page with 2 variants", async () => {
  const targetUrl =
    "https://www.ellos.se/venture-home/matgrupp-tempe-med-2st-matstolar-polar/1722582-02";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);

  expect(result).toHaveLength(2);
  expect(result.map((p) => p.images.length)).toEqual([8, 6]);
  expect(result.map((p) => p.isDiscounted)).toEqual([true, true]);
  expect(result.map((p) => p.price)).toEqual([314400, 314400]);
  expect(result.map((p) => p.originalPrice)).toEqual([369900, 369900]);
});

test("Long description and Parse correct SKU", async () => {
  const targetUrl = "https://www.ellos.se/ellos-home/overkast-indra/1705327-01";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);

  expect(result[0].description?.length).toBeGreaterThan(500);
  expect(result[0].description).toContain(
    "För mer information om Better Cotton, besök bettercotton.org/learnmore."
  );

  expect(result[0].sku).toEqual("1705327-01-24");
});
