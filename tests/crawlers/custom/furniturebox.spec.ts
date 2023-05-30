import { scrapeDetails, exploreCategory } from "../../../src/service";
import { BrowserLaunchContext, log, PlaywrightCrawlingContext } from "crawlee";
import { BrowserContext } from "playwright-core";
import * as fs from "fs";

jest.setTimeout(300000);

describe("Furniturebox details page", () => {
  test.each([
    [
      "https://www.furniturebox.se/utomhus/utestolar/hangstol/lukse-hangstol-gra-p844655",
      "tests/resources/furniturebox/details_page_basic",
    ],
    [
      "https://www.furniturebox.se/mobler/koksmobler/matstolar/altea-matstol-manchester-gra-p338053",
      "tests/resources/furniturebox/details_page_with_variants",
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

      expect(result).toHaveLength(expectedResult.length);
      expect(result).toEqual(expectedResult);
    }
  );
});
