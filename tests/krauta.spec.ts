import { scrapeDetails } from "../src/service";
import { BrowserLaunchContext, log, PlaywrightCrawlingContext } from "crawlee";
import { BrowserContext } from "playwright-core";
import * as fs from "fs";

jest.setTimeout(50000);

describe("Krauta details page", () => {
  test.each([
    // Have all info
    // [
    //   "https://www.k-rauta.se/produkt/matbord-kalmar-diameter-120-cm/6438313610830",
    //   "tests/resources/krauta/details_page_basic",
    // ],
    // No reviews
    [
      "https://www.k-rauta.se/produkt/badkar-naantali-med-tassar-vitt/5727419542413",
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
          jobId: "test_job_id",
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

      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      expect(result).toEqual(expectedResult);
    }
  );
});
