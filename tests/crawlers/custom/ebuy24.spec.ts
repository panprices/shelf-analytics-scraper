import { scrapeDetails, exploreCategory } from "../src/service";
import { BrowserLaunchContext, log, PlaywrightCrawlingContext } from "crawlee";
import { BrowserContext } from "playwright-core";
import * as fs from "fs";

jest.setTimeout(300000);

describe("Ebuy24 category page", () => {
  test.each([
    [
      "https://ebuy24.dk/shop/93-stole/",
      "tests/resources/ebuy24/category_page_basic",
    ],
    // No pagination
    [
      "https://ebuy24.dk/shop/376-glas-spisebord/",
      "tests/resources/ebuy24/category_page_no_pagination",
    ],
    // Has a "prisgaranti" a tag in product card, which can be confused with the product url
    [
      "https://ebuy24.dk/shop/15-sofaer/",
      "tests/resources/ebuy24/category_page_prisgaranti_in_product_card",
    ],
  ])(
    "Category page extracted correctly",
    async (targetUrl, testResourcesDir) => {
      const expectedResult = JSON.parse(
        fs.readFileSync(`${testResourcesDir}/result.json`, "utf-8")
      );

      const result = await exploreCategory(targetUrl, "job_test_1", {
        preNavigationHooks: [
          async (ctx: PlaywrightCrawlingContext) => {
            await ctx.browserController.browser
              .contexts()[0]
              .routeFromHAR(`${testResourcesDir}/recording.har`);
          },
        ],
      });

      expect(result).toHaveLength(expectedResult.length);
      expect(result).toEqual(expectedResult);
    }
  );
});

describe("Ebuy24 details page", () => {
  test.each([
    [
      "https://ebuy24.dk/shop/93-stole/4092-ramy-laenestol-i-marineblaa-med-mat-sort-metal-stel/",
      "tests/resources/ebuy24/details_page_basic",
    ],
    [
      "https://ebuy24.dk/shop/93-stole/15096-talgarth-laenestol-recliner-med-fodskammel-antracit-sort/",
      "tests/resources/ebuy24/details_page_many_images",
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
          popularityIndex: 1,
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

      // For debugging
      fs.writeFileSync("result.json", JSON.stringify(result, null, 2));

      expect(result).toHaveLength(expectedResult.length);
      expect(result).toEqual(expectedResult);
    }
  );
});
