import exp from "constants";
import { exploreCategory, scrapeDetails } from "../src/service";
import { extractPriceAndCurrencyFromText } from "../src/crawlers/custom/wayfair";
import { Availability } from "../src/types/offer";

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
  expect(result[0].price).toEqual(71999);
  expect(result[0].originalPrice).toEqual(70999);
  expect(result[0].currency).toEqual("EUR");
  expect(result[0].isDiscounted).toEqual(true);
  expect(result[0].specifications.length).toEqual(27);
});

test("Product out of stock", async () => {
  const targetUrl =
    "https://www.wayfair.de/moebel/pdp/venture-design-essgruppe-neilsen-mit-6-stuehlen-vtdg4314.html";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);

  expect(result[0].price).toEqual(88999);
  expect(result[0].sku).toEqual("VTDG4314");
  expect(result[0].availability).toEqual("out_of_stock");
});

test("Product with price > 1000 EUR", async () => {
  const targetUrl =
    "https://www.wayfair.de/moebel/pdp/venture-design-essgruppe-cruz-mit-6-stuehlen-vtdg5305.html";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);

  expect(result[0].price).toEqual(169999);
  expect(result[0].sku).toEqual("VTDG5305");
  expect(result[0].availability).toEqual("out_of_stock");
});

test("With click-option variants", async () => {
  const targetUrl =
    "https://www.wayfair.de/moebel/pdp/venture-design-essgruppe-pillan-mit-4-stuehlen-vtdg6272.html";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);
  expect(result.length).toEqual(2);
  expect(result.map((item) => item.sku)).toEqual(["VTDG6272", "VTDG6272"]);
  expect(result.map((item) => item.mpn).sort()).toEqual(["GR22367", "GR22371"]);
  expect(result.map((item) => item.url).sort()).toEqual([
    "https://www.wayfair.de/moebel/pdp/venture-design-essgruppe-pillan-mit-4-stuehlen-vtdg6272.html?piid=61463881",
    "https://www.wayfair.de/moebel/pdp/venture-design-essgruppe-pillan-mit-4-stuehlen-vtdg6272.html?piid=61463882",
  ]);
  expect(result.map((item) => item.variantGroupUrl)).toEqual(
    Array(2).fill(
      "https://www.wayfair.de/moebel/pdp/venture-design-essgruppe-pillan-mit-4-stuehlen-vtdg6272.html"
    )
  );
});

test("With click-option (with images) variants", async () => {
  const targetUrl =
    "https://www.wayfair.de/moebel/pdp/17-stories-essgruppe-bhikhari-mit-6-stuehlen-d001447511.html";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);
  expect(result.length).toEqual(2);
  expect(result.map((item) => item.url)).toEqual([
    "https://www.wayfair.de/moebel/pdp/17-stories-essgruppe-bhikhari-mit-6-stuehlen-d001447511.html?piid=1079616553",
    "https://www.wayfair.de/moebel/pdp/17-stories-essgruppe-bhikhari-mit-6-stuehlen-d001447511.html?piid=1079616552",
  ]);
  expect(result.map((item) => item.sku)).toEqual(["D001447511", "D001447511"]);
  // They don't have the correct mpn for this product D:
  // expect(result.map((item) => item.mpn)).toEqual(["GR20167", "GR20162"]);
  expect(result.map((item) => item.availability)).toEqual(
    Array(2).fill(Availability.OutOfStock)
  );
});

test("2 click-option variants", async () => {
  const targetUrl =
    "https://www.wayfair.de/heimtextilien/pdp/ebern-designs-tagesdecke-burdelle-d003367151.html";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);
  expect(result.length).toEqual(6);
  expect([...new Set(result.map((item) => item.url))].length).toEqual(6);
});
