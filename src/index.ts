import express, { Request, Response } from "express";
import bodyParser from "body-parser";
import pino from "pino";

import { exploreCategory, scrapeDetails } from "./service";
import { RequestOptions } from "crawlee";
import { RequestBatch } from "./types/offer";
import {
  persistProductsToDatabase,
  publishMatchingProducts,
  sendRequestBatch,
} from "./publishing";
import { log, LoggerJson as CrawleeLoggerJson } from "crawlee";
import { configCrawleeLogger } from "./utils";

const app = express();
app.use(bodyParser.json({ limit: "50mb" }));

app.get("/", (_: any, res: Response) => {
  const name = process.env.NAME || "World";
  res.send(`Hello ${name}!`);
});

app.get("/test", async (req: Request, res: Response) => {
  const logger = pino();
  const project = process.env.GOOGLE_CLOUD_PROJECT || "panprices";
  const traceHeader = req.get("X-Cloud-Trace-Context");
  if (traceHeader && project) {
    const [trace] = traceHeader.split("/");
    const childLogger = logger.child({
      "logging.googleapis.com/trace": `projects/${project}/traces/${trace}`,
    });
    childLogger.info("Can you see the trace now?");
  }
  res.status(200).send("OK");
});

app.post("/exploreCategory", async (req: Request, res: Response) => {
  const body = <RequestOptions>req.body;

  const cloudTrace = req.get("X-Cloud-Trace-Context");
  configCrawleeLogger(cloudTrace);

  const detailedPages = await exploreCategory(body.url, req.body.jobId);
  await sendRequestBatch(detailedPages, req.body.jobId);

  res.status(204).send("OK");
});

app.post("/scrapeDetails", async (req: Request, res: Response) => {
  const body = <RequestBatch>req.body;

  const cloudTrace = req.get("X-Cloud-Trace-Context");
  configCrawleeLogger(cloudTrace);

  const products = await scrapeDetails(body.productDetails);
  await persistProductsToDatabase(products);

  const matchingProducts = products.filter((p) => p.matchingType === "match");
  if (matchingProducts.length > 0) {
    await publishMatchingProducts(matchingProducts);
  }

  res.status(204).send("OK");
});

const port = parseInt(<string>process.env.PORT) || 8080;
app.listen(port, () => {
  console.log(`helloworld: listening on port ${port}`);
});
