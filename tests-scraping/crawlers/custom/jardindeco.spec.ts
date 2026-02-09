import { scrapeDetails, exploreCategory } from "../../../src/service";
import { PlaywrightCrawlingContext, log } from "crawlee";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { initializeFirestore } from "firebase-admin/firestore";
import * as fs from "fs";

jest.setTimeout(300000);

beforeAll(() => {
  initializeApp({
    credential: applicationDefault(),
  });
});

test.each([
  // Basic info
  [
    "https://www.jardindeco.com/housse-de-coussin-avec-pompoms-millie-45x45-cm-F-637,64363",
    "tests/resources/jardindeco/details_page_basic",
  ],
])("Test scrape product page", async (targetUrl, testResourcesDir) => {
  const expectedResult = JSON.parse(
    fs.readFileSync(`${testResourcesDir}/result.json`, "utf-8")
  );

  const dummyRequest = {
    url: targetUrl,
    userData: {
      jobId: "job_test_local_unit_test",
      url: targetUrl,
      label: "DETAIL",
    },
  };
  const result = await scrapeDetails([dummyRequest], {
    headless: false,
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
});
