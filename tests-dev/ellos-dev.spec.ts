import { exploreCategory, scrapeDetails } from "../src/service";

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
  const result = await exploreCategory(targetUrl, "job_test_1");

  expect(result).toHaveLength(108);
});

test("Product page with 2 variants", async () => {
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

  console.log(result[0].description);
  expect(result[0].description?.length).toBeGreaterThan(500);
  expect(result[0].description).toContain(
    "Det betyder inte att produkten är tillverkad av fysiskt spårbar Better Cotton"
  );

  console.log(result[0].sku);
  expect(result[0].sku).toEqual("1705327-01-24");
});
