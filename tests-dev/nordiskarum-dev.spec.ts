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
  const targetUrl =
    "https://www.nordiskarum.se/mobler/soffor/4-sits-soffor.html";
  const result = await exploreCategory(targetUrl, "job_test_1");

  expect(result).toHaveLength(26);
});

test("Basic product page", async () => {
  const targetUrl =
    "https://www.nordiskarum.se/bornholm-svangd-4-sits-orinoco23.html";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);

  expect(result).toHaveLength(1);
  expect(result[0].sku).toEqual("2607");
  expect(result[0].mpn).toEqual("2607"); // they use mpn as their sku
  expect(result[0].images.length).toEqual(10);
  expect(result[0].price).toEqual(1199500);
  expect(result[0].isDiscounted).toEqual(true);
  expect(result[0].originalPrice).toEqual(1299500);
  expect(result[0].specifications.length).toEqual(8);
});
