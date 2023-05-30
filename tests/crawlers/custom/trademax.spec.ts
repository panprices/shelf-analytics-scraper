import { scrapeDetails } from "../../../src/service";
import { BrowserLaunchContext, log, PlaywrightCrawlingContext } from "crawlee";
import { BrowserContext } from "playwright-core";
import * as fs from "fs";
import { expectToIncludeSameMembers } from "./test-helpers";
import _ from "lodash";

jest.setTimeout(300000);

describe("Trademax details page", () => {
  test.each([
    // Basic info
    [
      "https://www.trademax.se/utem%C3%B6bler/utestolar-tr%C3%A4dg%C3%A5rdsstolar/sols%C3%A4ng-solvagn/kenya-sols%C3%A4ng-brunbeige-p1509727",
      "tests/resources/trademax/details_page_basic",
    ],
    // // With variants
    // [
    //   "https://www.trademax.se/m%C3%B6bler/soffor/soffgrupp/chesterfield-soffgrupp/chesterfield-lyx-soffgrupp-3-sits-2-sits-f%C3%A5t%C3%B6lj-sammet-m%C3%B6rkgr%C3%A5-p600918-v272307",
    //   "tests/resources/trademax/details_page_variants_select",
    // ],
    // // With variants (2)
    // [
    //   "https://www.trademax.se/m%C3%B6bler/stolar/matstolar-k%C3%B6ksstolar/ridones-matstol-gr%C3%A5svart-p822550",
    //   "tests/resources/trademax/details_page_variants_select_2",
    // ],
    // // Variants in sidebar
    // [
    //   "https://www.trademax.se/heminredning/v%C3%A4ggdekor/tapet/fototapet/fototapet-vatten-droppar-p%C3%A5-flaska-%C3%B6l-350x270-artgeist-sp-z-o-o-p558710-v334951",
    //   "tests/resources/trademax/details_page_variants_sidebar",
    // ],
    // // Variants with multiple option groups
    // [
    //   "https://www.trademax.se/textil/matta/modern-matta/viskosmattor/viskosmatta-tokyo-200-grön-p1698124-v340162",
    //   "tests/resources/trademax/details_page_variants_multiple",
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
        headless: true,
        preNavigationHooks: [
          async (ctx: PlaywrightCrawlingContext) => {
            await ctx.browserController.browser
              .contexts()[0]
              .routeFromHAR(`${testResourcesDir}/recording.har`);
          },
        ],
      });

      expect(result).toHaveLength(result.length);

      for (let i = 0; i < expectedResult.length; i++) {
        result[i] = _.omit(result[i], ["fetchedAt"]);
        expectedResult[i] = _.omit(expectedResult[i], ["fetchedAt"]);
      }

      result.sort((a, b) => (a.url > b.url ? 1 : -1));
      expectedResult.sort((a, b) => (a.url > b.url ? 1 : -1));
      expect(result).toEqual(expectedResult);
    }
  );
});
