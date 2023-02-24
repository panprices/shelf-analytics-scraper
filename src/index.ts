import express, { Request, Response } from "express";
import bodyParser from "body-parser";
import * as dotenv from "dotenv";
import { exploreCategory, scrapeDetails } from "./service";
import { log } from "crawlee";
import { RequestBatch, RequestCategoryExploration } from "./types/offer";
import {
  persistProductsToDatabase,
  publishMatchingProducts,
  sendRequestBatch,
} from "./publishing";
import { configCrawleeLogger, extractRootUrl } from "./utils";
import { downloadCache, uploadCache } from "./cache-sync";
import {
  CATEGORY_CACHE_MARKER_FILE,
  CHROMIUM_USER_DATA_DIR,
  CRAWLEE_STORAGE_DIR,
  DETAILS_CACHE_MARKER_FILE,
} from "./constants";
import fastFolderSize from "fast-folder-size";

dotenv.config();
const app = express();
app.use(bodyParser.json({ limit: "50mb" }));

app.get("/", (_: any, res: Response) => {
  const name = process.env.NAME || "World";
  res.send(`Hello ${name}!`);
});

app.post("/exploreCategory", async (req: Request, res: Response) => {
  const body = <RequestCategoryExploration>req.body;

  const cloudTrace = req.get("X-Cloud-Trace-Context");
  configCrawleeLogger(cloudTrace);

  const detailedPages = await exploreCategory(body.url, body.jobContext.jobId);
  try {
    log.info(`Category explored`, {
      categoryUrl: body.url,
      nrProductsFound: detailedPages.length,
      retailer: extractRootUrl(body.url),
      jobId: body.jobContext.jobId,
    });
  } catch (error) {
    /* logging failed, do nothing */
  }

  if (!body.jobContext.skipPublishing) {
    await sendRequestBatch(detailedPages, req.body.jobContext);
  }

  track_and_log_number_of_requests_handled();
  res.status(204).send("OK");
});

app.post("/scrapeDetails", async (req: Request, res: Response) => {
  const cloudTrace = req.get("X-Cloud-Trace-Context");
  configCrawleeLogger(cloudTrace);

  log.info("/scrapeDetails");

  const body = <RequestBatch>req.body;
  const useCheerio = body.jobContext.scraperProductPage === "cheerio";

  // let [shouldUploadCache, cacheSize] = [false, 0];
  // if (
  //   retailer_url.includes("trademax.se") ||
  //   retailer_url.includes("chilli.se") ||
  //   retailer_url.includes("furniturebox.se")
  // ) {
  //   [shouldUploadCache, cacheSize] = await downloadCache(
  //     body.jobContext,
  //     DETAILS_CACHE_MARKER_FILE
  //   );
  // }

  // log.info("Check for browser cache", {
  //   cacheFound: shouldUploadCache,
  //   cacheSize,
  // });

  const products = await scrapeDetails(
    body.productDetails,
    undefined,
    useCheerio,
    body.launchOptions
  );
  try {
    log.info("Product details scraped", {
      nrUrls: body.productDetails.length,
      nrProductsFound: products.length,
      retailer: extractRootUrl(body.productDetails[0].url),
      jobId: req.body.jobContext.jobId,
    });
  } catch (error) {
    /* logging failed, do nothing */
  }

  await persistProductsToDatabase(products);

  const matchingProducts = products.filter((p) => p.matchingType === "match");
  if (matchingProducts.length > 0 && !body.jobContext.skipPublishing) {
    await publishMatchingProducts(matchingProducts, body.jobContext);
  }
  // if (shouldUploadCache && cacheSize < 10e6 /* 10MB */) {
  //   await uploadCache(body.jobContext, CATEGORY_CACHE_MARKER_FILE);
  // }

  track_and_log_number_of_requests_handled();
  res.status(204).send("OK");
});

const port = parseInt(<string>process.env.PORT) || 8080;
app.listen(port, () => {
  console.log(`helloworld: listening on port ${port}`);
});

// ---
// Utils
// ---

/**
 * Keep track and log how many requests a cloud run instance handles before shuting down.
 * Delete this after 2023-03-01 unless there are reasons to keep it.
 */
let nr_requests_handled = 0;
function track_and_log_number_of_requests_handled() {
  try {
    nr_requests_handled += 1;

    // Only log every 5th requests to not affect performance
    // and to not spam the logs
    if (nr_requests_handled % 5 !== 0) {
      return;
    }

    log.info(`Number of request this docker instance handled`, {
      nr_requests_handled,
    });
    fastFolderSize(CHROMIUM_USER_DATA_DIR, (err, bytes) => {
      if (err) {
        log.error(err.message);
      }
      log.info("Cache folder size", { nr_MB: bytes! / 1024 ** 2 });
    });
    fastFolderSize(CRAWLEE_STORAGE_DIR, (err, bytes) => {
      if (err) {
        log.error(err.message);
      }
      log.info("Crawlee storage folder size", { nr_MB: bytes! / 1024 ** 2 });
    });
  } catch {
    /* do nothing */
  }
}
