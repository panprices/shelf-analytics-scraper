import { exploreCategory, scrapeDetails } from "../src/service";
import { PlaywrightCrawlingContext } from "crawlee";

jest.setTimeout(300000);

describe("Venture Design Category page", () => {
  test.each([
    [
      "https://www.venturedesign.se/utemobler/stolar-fatoljer",
      "tests/resources/venturedesign/empty_category_page",
      0,
    ],
    [
      "https://www.venturedesign.se/innemobler/bord/barbord",
      "tests/resources/venturedesign/non_empty_category_page",
      4,
    ],
  ])("Test category pages", async (targetUrl, recordingPath, productsCount) => {
    const detailedPages = await exploreCategory(targetUrl, "test_job_id", {
      preNavigationHooks: [
        async (ctx: PlaywrightCrawlingContext) => {
          await ctx.browserController.browser
            .contexts()[0]
            .routeFromHAR(`${recordingPath}/recording.har`);
        },
      ],
    });

    expect(detailedPages).toBeDefined();
    expect(detailedPages).toHaveLength(productsCount);
  });
});
