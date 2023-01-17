import { scrapeDetails, exploreCategory } from "../src/service";
import { BrowserLaunchContext, log, PlaywrightCrawlingContext } from "crawlee";
import { BrowserContext } from "playwright-core";
import * as fs from "fs";

jest.setTimeout(300000);

describe("Bygghemma category page", () => {
  test.each([
    [
      "https://www.bygghemma.se/inredning-och-belysning/trappor/spiraltrappa",
      "tests/resources/bygghemma/category_page_basic",
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

describe("Bygghemma details page", () => {
  test.each([
    // Basic info
    [
      "https://www.bygghemma.se/tradgard-och-utemiljo/utemobler-och-tradgardsmobler/solstol-och-solmobler/dackstol/solstol-venture-design-kiara/p-1110925",
      "tests/resources/bygghemma/details_page_basic",
    ],
    // Multiple variants - 1 select color option
    [
      "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-estelle-140-med-4-vera-stolar-sammet/p-1061471",
      "tests/resources/bygghemma/details_page_select_option",
    ],
    // TODO: Fix this. There are duplicates in the result.
    // Multiple variants - 1 select color + 1 dropdown option
    // [
    //   "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matbord-och-koksbord/matbord-venture-home-polar/p-1159433",
    //   "tests/resources/bygghemma/details_page_multiple_variants",
    // ],
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
          brand: "Cottage Home",
          popularityIndex: 1,
          name: "Mexico matbord ø140 svart alu/teak",
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

      expect(result).toHaveLength(expectedResult.length);
      expect(result).toEqual(expectedResult);
    }
  );
});
