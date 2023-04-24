import { scrapeDetails, exploreCategory } from "../src/service";
import { BrowserLaunchContext, log, PlaywrightCrawlingContext } from "crawlee";
import { BrowserContext } from "playwright-core";
import * as fs from "fs";

jest.setTimeout(300000);

describe("Unoliving category page", () => {
  test.each([
    [
      "https://unoliving.com/sovevaerelse/sengetilbehor",
      "tests/resources/unoliving/category_page_basic",
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

describe("Unoliving details page", () => {
  test.each([
    [
      "https://unoliving.com/temahome-apex-spisebord-gra-beton-look-200x100",
      "tests/resources/unoliving/details_page_basic",
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

      expect(result).toEqual(expectedResult);
    }
  );
});
