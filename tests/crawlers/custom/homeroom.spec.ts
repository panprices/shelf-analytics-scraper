import { exploreCategory, scrapeDetails } from "../../../src/service";
import { PlaywrightCrawlingContext } from "crawlee";
import * as fs from "fs";
import { expectScrapeDetailsResultToEqual } from "./test-helpers";

jest.setTimeout(300000);

describe("Homeroom category page", () => {
  test.each([
    [
      "https://www.homeroom.se/mobler/hallmobler/hatthyllor",
      "tests/resources/homeroom/category_page_basic",
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

describe("Homeroom details page", () => {
  test.each([
    // Basic info
    [
      "https://www.homeroom.se/venture-home/matgrupp-polar-bord-med-4st-valleta-stolar/1577644-01",
      "tests/resources/homeroom/details_page_basic",
    ],
    // With variants
    [
      "https://www.homeroom.se/ellos-home/matgrupp-gilda-med-bord-180x90-cm-6-stolar/1638353-01",
      "tests/resources/homeroom/details_page_with_variants",
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

      expect(result).toHaveLength(expectedResult.length);
      expectScrapeDetailsResultToEqual(result, expectedResult);
    }
  );
});
