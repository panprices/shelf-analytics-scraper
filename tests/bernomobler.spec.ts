import { scrapeDetails, exploreCategory } from "../src/service";
import { BrowserLaunchContext, log, PlaywrightCrawlingContext } from "crawlee";
import { BrowserContext } from "playwright-core";
import * as fs from "fs";

jest.setTimeout(300000);

describe("Berno Mobler category page", () => {
  test.each([
    [
      "https://bernomobler.se/collections/runda-matbord",
      "tests/resources/bernomobler/category_page_basic",
      97,
    ],
  ])(
    "Category page extracted correctly",
    async (targetUrl, testResourcesDir, expectedProductsCount) => {
      // const expectedResult = JSON.parse(
      //   fs.readFileSync(`${testResourcesDir}/result.json`, "utf-8")
      // );

      const result = await exploreCategory(targetUrl, "job_test_1", {
        // preNavigationHooks: [
        //   async (ctx: PlaywrightCrawlingContext) => {
        //     await ctx.browserController.browser
        //       .contexts()[0]
        //       .routeFromHAR(`${testResourcesDir}/recording.har`);
        //   },
        // ],
      });

      expect(result).toHaveLength(expectedProductsCount);
      // expect(result).toEqual(expectedResult);
    }
  );
});

describe("Berno Mobler details page", () => {
  test.each([
    [
      "https://bernomobler.se/products/break-matgrupp-4st-stolar-vit-gra",
      "tests/resources/bernomobler/details_page_basic",
    ],
  ])(
    "Product details are retrieved correctly",
    async (targetUrl, testResourcesDir) => {
      // const expectedResult = JSON.parse(
      //   fs.readFileSync(`${testResourcesDir}/result.json`, "utf-8")
      // );

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
        // preNavigationHooks: [
        //   async (ctx: PlaywrightCrawlingContext) => {
        //     await ctx.browserController.browser
        //       .contexts()[0]
        //       .routeFromHAR(`${testResourcesDir}/recording.har`);
        //   },
        // ],
      });

      // expect(result).toEqual(expectedResult);

      expect(result.map((res) => res.images.length)).toEqual([7]);
    }
  );
});
