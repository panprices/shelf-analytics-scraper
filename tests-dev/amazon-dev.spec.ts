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
    "https://www.amazon.de/stores/page/5F2C4988-D42A-4AD4-9EFA-8A6CCC06A743?ingress=0&visitId=7a3dc621-084a-4251-a566-e368a8bfd7ed";
  const result = await exploreCategory(targetUrl, "job_test_1", {
    headless: true,
  });

  expect(result).toHaveLength(115);
});

test("Basic product page", async () => {
  const targetUrl =
    "https://www.amazon.de/Venture-Velvet-Dining-Chair-Orange/dp/B0BKGDZLQJ?ref_=ast_sto_dp";
  const result = await scrapeDetails([dummyRequest(targetUrl)], {
    headless: true,
  });

  expect(result).toHaveLength(1);
  expect(result[0].brand).toEqual("Venture Home");
  expect(result[0].mpn).toEqual("19924-866");
  expect(result[0].sku).toEqual("B0BKGDZLQJ"); // ASIN
  expect(result[0].images.length).toEqual(3);
  expect(result[0].price).toEqual(8788);
  expect(result[0].currency).toEqual("EUR");
  expect(result[0].isDiscounted).toEqual(false);
  expect(result[0].specifications.length).toEqual(14);
});

test("Product out of stock", async () => {
  const targetUrl =
    "https://www.amazon.de/Venture-Home-Break-Dining-Round-White-Aintwood-90%C3%B8/dp/B0BQ74728L?ref_=ast_sto_dp";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);

  expect(result[0].price).toEqual(25424);
  expect(result[0].images.length).toEqual(3);
  expect(result[0].mpn).toEqual("2079-400");
  expect(result[0].availability).toEqual("out_of_stock");
});

test("Product unavailable without price", async () => {
  const targetUrl =
    "https://www.amazon.de/Venture-Home-Dining-%C3%B8100cm-Teak-Nature/dp/B0BQ71FGSY?ref_=ast_sto_dp";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);

  expect(result[0].price).toEqual(0);
  expect(result[0].mpn).toEqual("9519-244");
  expect(result[0].availability).toEqual("out_of_stock");
});

test("Product with 'This item cannot be shipped to your location", async () => {
  const targetUrl =
    "https://www.amazon.de/Venture-Togo-Dining-200100-Table-Aluminium/dp/B0BQ7344RJ?ref_=ast_sto_dp";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);

  expect(result[0].price).toEqual(57340);
  expect(result[0].availability).toEqual("out_of_stock");
});
