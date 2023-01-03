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
  DETAILS_CACHE_MARKER_FILE,
} from "./constants";

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
  const shouldUploadCache = await downloadCache(
    body.jobContext,
    CATEGORY_CACHE_MARKER_FILE
  );
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
  if (shouldUploadCache) {
    await uploadCache(body.jobContext, CATEGORY_CACHE_MARKER_FILE);
  }

  res.status(204).send("OK");
});

app.post("/scrapeDetails", async (req: Request, res: Response) => {
  const body = <RequestBatch>req.body;

  const cloudTrace = req.get("X-Cloud-Trace-Context");
  configCrawleeLogger(cloudTrace);
  const shouldUploadCache = await downloadCache(
    body.jobContext,
    DETAILS_CACHE_MARKER_FILE
  );

  const products = await scrapeDetails(body.productDetails);
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
  if (shouldUploadCache) {
    await uploadCache(body.jobContext, CATEGORY_CACHE_MARKER_FILE);
  }

  res.status(204).send("OK");
});

const port = parseInt(<string>process.env.PORT) || 8080;
app.listen(port, () => {
  console.log(`helloworld: listening on port ${port}`);
});
