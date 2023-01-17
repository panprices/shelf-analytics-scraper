import { scrapeDetails } from "../src/service";
import { BrowserLaunchContext, log, PlaywrightCrawlingContext } from "crawlee";
import { BrowserContext } from "playwright-core";
import * as fs from "fs";
import {
  expectScrapeDetailsResultToEqual,
  expectToIncludeSameMembers,
} from "./test_helpers";
import _ from "lodash";

jest.setTimeout(300000);

describe("Chilli details page", () => {
  test.each([
    // Basic info
    [
      "https://www.chilli.se/utem%C3%B6bler/utebord/matbord-utomhus/matbord-kenya-200-cm-beige-p1509863",
      "tests/resources/chilli/details_page_basic",
    ],
    // // With variants
    [
      "https://www.chilli.se/m%C3%B6bler/soffor/soffgrupp/soffgrupp-walton-lyx-3-sits-2-sits-f%C3%A5t%C3%B6lj-sammet-m%C3%B6rkgr%C3%A5-p600918-v272307",
      "tests/resources/chilli/details_page_variants_select",
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
        headless: true,
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
