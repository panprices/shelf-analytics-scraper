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
  const targetUrl = "https://www.trendrum.se/barbord-cafebord";
  const result = await exploreCategory(targetUrl, "job_test_1");

  expect(result).toHaveLength(56);
});

test("Product page", async () => {
  const targetUrl = "https://www.trendrum.se/tromso-runt-matbord-120-cm-vit-ek";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);
  const product = result[0];

  expect(product.images.length).toEqual(2);
  expect(product.name).toEqual("Tromsö runt matbord 120 cm - Vit / Ek");
  expect(product.price).toEqual(349000);
  expect(product.categoryTree?.length).toEqual(3);
  expect(product.specifications.length).toEqual(2);
});
