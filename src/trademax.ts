// For more information, see https://crawlee.dev/
import {Dataset, PlaywrightCrawler,} from "crawlee";
import {scheduleNextPage} from "./utils.js";
import {CustomRequestQueue} from "./custom_crawlee/custom_request_queue";

const BASE_URL = "https://www.trademax.se";

// const pageLoaded;

const getTrademaxCrawler = async (maxRequestsPerCrawl: number) => {
  const requestQueue = await CustomRequestQueue.open()

  return new PlaywrightCrawler({
    requestQueue,
    headless: true,
    maxRequestsPerCrawl: maxRequestsPerCrawl,
    maxRequestsPerMinute: 60,
    maxConcurrency: 3,

    // Use the requestHandler to process each of the crawled pages.
    async requestHandler({ request, page, enqueueLinks, log }) {
      log.info("Scraping page:" + request.loadedUrl);

      if (request.label === "DETAIL") {
        await page.waitForSelector("h1[data-cy='product_title']");

        const product_name = await page
          .locator("h1[data-cy='product_title']")
          .textContent();
        const price_text = await page
          .locator("div#productInfoPrice div[data-cy='current-price']")
          .textContent();
        const price = Number(price_text?.replace(" ", ""));
        const images = await page
          .locator("div#productInfoImage figure img")
          .evaluateAll((list) =>
            list.map((element) => element.getAttribute("src"))
          );
        const thumbnails = await page
          .locator(".ProductInfoSliderNavigation__global img")
          .evaluateAll((list) =>
            list.map((element) => element.getAttribute("src"))
          );

        // TODO
        const description = null;

        // Save results as JSON to ./storage/datasets/default
        const offer = {
          product_name,
          price_text,
          price,
          currency: "SEK",
          images,
          thumbnails,
          description,
          url: request.loadedUrl,
        };
        // log.info(JSON.stringify(offer));
        await Dataset.pushData(offer);
      } else {
        await page.waitForSelector(".P0CGX a");
        // await page.waitForFunction();

        // Enque link to the product pages
        await enqueueLinks({
          selector: ".P0CGX a",
          label: "DETAIL",
        });

        await enqueueLinks({
          selector: "//div[@data-cy='pagination_controls']/a",
          label: "LIST"
        })

        // Schedule next page to scrape
        // const nextPageUrl =
        //   BASE_URL +
        //   (await page.locator("a[aria-label='Next']").getAttribute("href"));
        // log.info("Next page: " + nextPageUrl);
        // if (nextPageUrl) {
        //   await scheduleNextPage(nextPageUrl, 60);
        // }

        // await enqueueLinks({
        //   selector: "a[aria-label='Next']",
        //   label: "LIST",
        // });
      }
    },
  });
};

export const scrapeCategoryPage = async (
  url: string,
  maxRequestsPerCrawl: number = 10
) => {
  const startTime = Date.now();

  const crawler = await getTrademaxCrawler(maxRequestsPerCrawl);
  await crawler.run([url]);

  const elapsedTimeMs = Date.now() - startTime;
  console.log(`Scraping took ${elapsedTimeMs} ms.`);
};
