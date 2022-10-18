import express, { Request, Response } from "express";
import bodyParser from "body-parser";
import pino from "pino";

import { exploreCategory, scrapeDetails } from "./service";
import { RequestOptions } from "crawlee";
import { RequestBatch } from "./types/offer";
import { postProcessProductDetails } from "./postprocessing";
import { persistProductsToDatabase } from "./publishing";
import { log } from "crawlee";

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

const configLogTracing = (cloudTrace?: string) => {
  const project = process.env.GOOGLE_CLOUD_PROJECT || "panprices";
  if (cloudTrace && project) {
    const [trace] = cloudTrace.split("/");
    log.setOptions({
      data: {
        "logging.googleapis.com/trace": `projects/${project}/traces/${trace}`,
      },
    });
  }
};

app.post("/exploreCategory", async (req: Request, res: Response) => {
  const body = <RequestOptions>req.body;

  const cloudTrace = req.get("X-Cloud-Trace-Context");
  configLogTracing(cloudTrace);

  await exploreCategory(body.url, req.body.jobId);
  res.status(204).send("OK");
});

app.post("/scrapeDetails", async (req: Request, res: Response) => {
  const body = <RequestBatch>req.body;

  const cloudTrace = req.get("X-Cloud-Trace-Context");
  configLogTracing(cloudTrace);

  const products = await scrapeDetails(body.productDetails);
  postProcessProductDetails(products);
  await persistProductsToDatabase(products);

  res.status(204).send("OK");
});

const port = parseInt(<string>process.env.PORT) || 8080;
app.listen(port, () => {
  console.log(`helloworld: listening on port ${port}`);
});
