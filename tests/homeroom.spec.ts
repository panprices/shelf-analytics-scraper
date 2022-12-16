import { scrapeDetails } from "../src/service";
import { PlaywrightCrawlingContext } from "crawlee";
import * as fs from "fs";
import { expectScrapeDetailsResultToEqual } from "./test_helpers";

jest.setTimeout(30000);

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
          brand: "Venture Home",
          popularityIndex: 1,
          name: "Matgrupp Polar bord med 4st Penally stolar",
          label: "DETAIL",
          fetchedAt: "9/2/2022, 4:51:26 PM",
        },
      };

      const result = await scrapeDetails([dummyRequest], {
        launchContext: {
          // launchOptions: <any>{
          //   recordHar: {
          //     path: "example.har",
          //   },
          // },
          // experimentalContainers: true,
          // launcher:
        },
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
