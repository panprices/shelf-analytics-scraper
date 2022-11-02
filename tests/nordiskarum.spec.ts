import { scrapeDetails } from "../src/service";
import { BrowserLaunchContext, log, PlaywrightCrawlingContext } from "crawlee";
import { BrowserContext } from "playwright-core";
import * as fs from "fs";

jest.setTimeout(50000);

describe("Krauta details page", () => {
  test.each([
    // Basic info
    [
      "https://www.nordiskarum.se/mexico-matbord-o140-svart-alu-teak.html",
      "tests/resources/nordiskarum/details_page_basic",
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
          jobId: "test_job_id",
          url: targetUrl,
          brand: "Cottage Home",
          popularityIndex: 1,
          name: "Mexico matbord ø140 svart alu/teak",
          label: "DETAIL",
          fetchedAt: "9/2/2022, 4:51:26 PM",
        },
      };
      const result = await scrapeDetails([dummyRequest]);

      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      expect(result).toEqual(expectedResult);
    }
  );
});
