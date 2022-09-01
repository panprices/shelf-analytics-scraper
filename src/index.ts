import express, { Request, Response } from "express";
import bodyParser from "body-parser";
import pino from "pino";

import {exploreCategory, scrapeDetails} from "./service.js"
import {scrapeCategoryPage} from "./trademax.js";
import {RequestOptions} from "crawlee";
import {RequestBatch} from "./types/offer.js";

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

app.post("/trademax", async (req: Request, res: Response) => {
  const body = await req.body;
  console.log("Payload:" + JSON.stringify(body));

  if (body.url) {
    console.log(body.url);
    await scrapeCategoryPage(body.url, 10);
  }

  res.status(204).send("OK");
});

app.post("/exploreCategory", async (req: Request, res: Response) => {
  const body = <RequestOptions>req.body

  await exploreCategory(body.url)
  res.status(204).send("OK")
})

app.post("/scrapeDetails", async (req: Request, res: Response) => {
  const body = <RequestBatch>req.body

  await scrapeDetails(body.productDetails)

  res.status(204).send("OK")
})

const port = parseInt(<string>process.env.PORT) || 8080;
app.listen(port, () => {
  console.log(`helloworld: listening on port ${port}`);
});
