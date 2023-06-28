import exp from "constants";
import { exploreCategory, scrapeDetails } from "../src/service";
import { extractPriceAndCurrencyFromText } from "../src/crawlers/custom/wayfair";

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

test.each([
  ["1.519,99 €", [1519.99, "EUR"]],
  ["1.519,99\u00A0€", [1519.99, "EUR"]],
  ["829,99 €", [829.99, "EUR"]],
])("Extract price and currency", (inputText, expectedResult) => {
  expect(extractPriceAndCurrencyFromText(inputText)).toEqual(expectedResult);
});

test("Basic product page with discount", async () => {
  const targetUrl =
    "https://www.wayfair.de/moebel/pdp/venture-design-essgruppe-negrete-mit-6-stuehlen-vtdg4328.html";
  const result = await scrapeDetails([dummyRequest(targetUrl)], {
    headless: false,
  });

  expect(result).toHaveLength(1);
  expect(result[0].brand).toEqual("Venture Design");
  expect(result[0].sku).toEqual("VTDG4328");
  expect(result[0].mpn).toEqual("GR20478");
  expect(result[0].images.length).toEqual(5);
  expect(result[0].price).toEqual(66999);
  expect(result[0].originalPrice).toEqual(70999);
  expect(result[0].currency).toEqual("EUR");
  expect(result[0].isDiscounted).toEqual(true);
  expect(result[0].specifications.length).toEqual(27);
});

test("Product out of stock", async () => {
  const targetUrl =
    "https://www.wayfair.de/moebel/pdp/venture-design-essgruppe-neilsen-mit-6-stuehlen-vtdg4314.html";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);

  expect(result[0].price).toEqual(82999);
  expect(result[0].sku).toEqual("VTDG4314");
  expect(result[0].availability).toEqual("out_of_stock");
});

test("Product with price > 1000 EUR", async () => {
  const targetUrl =
    "https://www.wayfair.de/moebel/pdp/venture-design-essgruppe-cruz-mit-6-stuehlen-vtdg5305.html";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);

  expect(result[0].price).toEqual(151999);
  expect(result[0].sku).toEqual("VTDG5305");
  expect(result[0].availability).toEqual("out_of_stock");
});

test("With variants", async () => {
  const targetUrl =
    "https://www.wayfair.de/moebel/pdp/zipcode-design-essgruppe-dolson-mit-4-stuehlen-d003098335.html";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);
  expect(result.length).toEqual(4);
  expect(result.map((item) => item.sku)).toEqual([
    "D003098335",
    "D003098335",
    "D003098335",
    "D003098335",
  ]);
  expect(result.map((item) => item.url)).toEqual([
    "https://www.wayfair.de/moebel/pdp/zipcode-design-essgruppe-dolson-mit-4-stuehlen-d003098335.html?piid=566167318",
    "https://www.wayfair.de/moebel/pdp/zipcode-design-essgruppe-dolson-mit-4-stuehlen-d003098335.html?piid=566167316",
    "https://www.wayfair.de/moebel/pdp/zipcode-design-essgruppe-dolson-mit-4-stuehlen-d003098335.html?piid=566167317",
    "https://www.wayfair.de/moebel/pdp/zipcode-design-essgruppe-dolson-mit-4-stuehlen-d003098335.html?piid=566167319",
  ]);
});
