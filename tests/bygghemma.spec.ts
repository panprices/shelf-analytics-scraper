import { scrapeDetails, exploreCategory } from "../src/service";
import { BrowserLaunchContext, log, PlaywrightCrawlingContext } from "crawlee";
import { BrowserContext } from "playwright-core";
import * as fs from "fs";

jest.setTimeout(30000);

describe("Bygghemma category page", () => {
  test.each([
    [
      "https://www.bygghemma.se/tradgard-och-utemiljo/utemobler-och-tradgardsmobler/cafemobler/cafegrupp",
    ],
    ["https://www.bygghemma.se/inredning-och-belysning/trappor/spiraltrappa"],
  ])("Category page extracted correctly", async (targetUrl) => {
    const dummyRequest = {};
    const result = await exploreCategory(targetUrl, "job_test_1", {});

    expect(result).toHaveLength(1);
  });
});

describe("Bygghemma details page", () => {
  test.each([
    // Basic info
    [
      "https://www.nordiskarum.se/mexico-matbord-o140-svart-alu-teak.html",
      "tests/resources/bygghemma/details_page_basic",
    ],
    // Multiple variants - 1 dropdown option
    [
      "https://www.bygghemma.se/inredning-och-belysning/heminredning/poster/posters-venture-home-blue-swirl-beige/p-1730937",
      "", //TODO
    ],
    // Multiple variants - 1 color + 1 dropdown option
    [
      "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matbord-och-koksbord/matbord-venture-home-polar/p-1159433",
      "tests/resources/bygghemma/details_page_multiple_variants",
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

      expect(result).toHaveLength(1);
      expect(result).toEqual(expectedResult);
    }
  );
});
