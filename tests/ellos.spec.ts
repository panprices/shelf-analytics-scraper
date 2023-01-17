import { exploreCategory, scrapeDetails } from "../src/service";
import { PlaywrightCrawlingContext } from "crawlee";
import * as fs from "fs";

jest.setTimeout(300000);

describe("Ellos category page", () => {
  test.each([
    [
      "https://www.ellos.se/hem-inredning/mobler/bord/skrivbord",
      "tests/resources/ellos/category_page_basic",
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
