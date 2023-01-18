import { scrapeDetails } from "../src/service";
import { BrowserLaunchContext, log, PlaywrightCrawlingContext } from "crawlee";
import { BrowserContext } from "playwright-core";
import * as fs from "fs";
import { expectScrapeDetailsResultToEqual } from "./test-helpers";

jest.setTimeout(300000);

describe("Gardenstore details page", () => {
  test.each([
    // Basic info
    [
      "https://www.gardenstore.se/19935-780-matstol-venture-design-velvet-lyx-beige",
      "tests/resources/gardenstore/details_page_basic",
    ],
    // Page with another html layout for price
    [
      "https://www.gardenstore.se/gr19635-matgrupp-venture-design-sleek-plaza-matbord-195-95-6-matstolar",
      "tests/resources/gardenstore/details_page_price_layout_2",
    ],
    // With discount
    [
      "https://www.gardenstore.se/hangstol-venture-design-lexi-for-djur?channable=033265736b7500313031392d343038de",
      "tests/resources/gardenstore/details_page_with_discount",
    ],
    // Out of stock & no thumbnails (only 1 image)
    [
      "https://www.gardenstore.se/storblommig-ros-budde-rosa-augusta-luise",
      "tests/resources/gardenstore/details_page_out_of_stock_no_thumbnails",
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

      expect(result).toHaveLength(1);
      expectScrapeDetailsResultToEqual(result, expectedResult);
    }
  );
});
