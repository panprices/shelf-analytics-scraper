import {scrapeDetails} from "../src/service";
import {PlaywrightCrawlingContext} from "crawlee";
import * as fs from "fs";

jest.setTimeout(30000);

describe("Homeroom details page", () => {
  test.each([
    // Basic info
    [
      "https://www.homeroom.se/venture-home/matgrupp-polar-bord-med-4st-valleta-stolar/1577644-01",
      "tests/resources/homeroom/details_page_basic",
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

      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      expect(result).toEqual(expectedResult);
    }
  );
});
