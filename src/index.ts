import express, { Request, Response } from "express";
import bodyParser from "body-parser";

import { exploreCategory, scrapeDetails } from "./service";
import { RequestOptions } from "crawlee";
import { RequestBatch } from "./types/offer";
import {
  persistProductsToDatabase,
  publishMatchingProducts,
  sendRequestBatch,
} from "./publishing";
import { log, LoggerJson as CrawleeLoggerJson } from "crawlee";
import { configCrawleeLogger, extractRootUrl } from "./utils";

const app = express();
app.use(bodyParser.json({ limit: "50mb" }));

app.get("/", (_: any, res: Response) => {
  const name = process.env.NAME || "World";
  res.send(`Hello ${name}!`);
});

app.post("/exploreCategory", async (req: Request, res: Response) => {
  const body = <RequestOptions>req.body;

  const cloudTrace = req.get("X-Cloud-Trace-Context");
  configCrawleeLogger(cloudTrace);

  const detailedPages = await exploreCategory(
    body.url,
    req.body.jobContext.jobId
  );
  try {
    log.info(`Category explored`, {
      categoryUrl: body.url,
      nrProductsFound: detailedPages.length,
      retailer: extractRootUrl(body.url),
      jobId: req.body.jobContext.jobId,
    });
  } catch (error) {
    /* logging failed, do nothing */
  }

  await sendRequestBatch(detailedPages, req.body.jobContext);

  res.status(204).send("OK");
});

app.post("/scrapeDetails", async (req: Request, res: Response) => {
  const body = <RequestBatch>req.body;

  const cloudTrace = req.get("X-Cloud-Trace-Context");
  configCrawleeLogger(cloudTrace);

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
  if (matchingProducts.length > 0) {
    await publishMatchingProducts(matchingProducts, body.jobContext);
  }

  res.status(204).send("OK");
});

const port = parseInt(<string>process.env.PORT) || 8080;
app.listen(port, () => {
  console.log(`helloworld: listening on port ${port}`);
});
