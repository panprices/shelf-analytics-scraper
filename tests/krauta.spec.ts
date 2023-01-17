import { scrapeDetails } from "../src/service";
import { BrowserLaunchContext, log, PlaywrightCrawlingContext } from "crawlee";
import { BrowserContext } from "playwright-core";
import * as fs from "fs";
import { extractPriceFromText } from "../src/crawlers/custom/krauta";

jest.setTimeout(300000);

describe("Krauta details page", () => {
  test.each([
    // Have all info
    [
      "https://www.k-rauta.se/produkt/matbord-kalmar-diameter-120-cm/6438313610830",
      "tests/resources/krauta/details_page_basic",
    ],
    // No reviews
    [
      "https://www.k-rauta.se/produkt/bord-andro-vittgra-224324x100-cm/7350107082533",
      "tests/resources/krauta/details_page_no_reviews",
    ],
  ])(
    "Product details are retrieved correctly",
    async (targetUrl, testResourcesDir) => {
      const expectedResult = JSON.parse(
        fs.readFileSync(`${testResourcesDir}/result.json`, "utf-8")
      );

      const dummyRequest = {
        url: targetUrl,
        userData: {
          jobId: "job_test_1",
          url: targetUrl,
          brand: "CELLO",
          popularityIndex: 1,
          name: "",
          label: "DETAIL",
          fetchedAt: "9/2/2022, 4:51:26 PM",
        },
      };
      const result = await scrapeDetails([dummyRequest], {
        preNavigationHooks: [
          async (ctx: PlaywrightCrawlingContext) => {
            await ctx.browserController.browser
              .contexts()[0]
              .routeFromHAR(`${testResourcesDir}/recording.har`);
          },
        ],
      });

      expect(result).toHaveLength(1);
      expect(result).toEqual(expectedResult);
    }
  );
});

test.each([
  ["129 kr / par", 129],
  ["59,95 kr / par", 59.95],
  ["från19,95 kr / par", 19.95],
])("Krauta extract price from text", (priceString, expected) => {
  expect(extractPriceFromText(priceString)).toBe(expected);
});
