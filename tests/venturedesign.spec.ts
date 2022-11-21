import {exploreCategory, scrapeDetails} from "../src/service";
import {PlaywrightCrawlingContext} from "crawlee";


jest.setTimeout(30000);

describe("Venture Design Category page", () => {
  test("Empty category page does not produce error", async () => {
    const targetUrl = 'https://www.venturedesign.se/utemobler/stolar-fatoljer'


    const dummyRequest = {
      url: targetUrl,
      userData: {
        label: "LIST",
      },
    };

    const detailedPages = await exploreCategory(
      targetUrl,
      "test_job_id", {
      preNavigationHooks: [
        async (ctx: PlaywrightCrawlingContext) => {
          await ctx.browserController.browser
            .contexts()[0]
            .routeFromHAR("tests/resources/venturedesign/empty_category_page/recording.har");
        },
      ],
    });

    expect(detailedPages).toBeDefined();
    expect(detailedPages).toHaveLength(0);
  })
});