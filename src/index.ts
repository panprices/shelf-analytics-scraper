import express, { Request, Response } from "express";
import bodyParser from "body-parser";
import * as dotenv from "dotenv";
import { exploreCategory, scrapeDetails, searchForProducts } from "./service";
import { log } from "crawlee";
import {
  ListingProductInfo,
  RequestBatch,
  RequestCategoryExploration,
  RequestSearch,
} from "./types/offer";
import {
  persistProductsToDatabase,
  publishProductsToUpdate,
  updateProductsPopularity,
  sendRequestBatch,
} from "./publishing";
import { extractDomainFromUrl, loggingMiddleware } from "./utils";
import fastFolderSize from "fast-folder-size";
import { initializeApp, applicationDefault } from "firebase-admin/app";

dotenv.config();

const app = express();

initializeApp({
  credential: applicationDefault(),
});
app.use(bodyParser.json({ limit: "50mb" }));
app.use(loggingMiddleware);

app.get("/", (_: any, res: Response) => {
  res.send(`Hello World!`);
});

app.post("/exploreCategory", async (req: Request, res: Response) => {
  const body = <RequestCategoryExploration>req.body;
  const detailedPages = await exploreCategory(body.url, body.jobContext.jobId);
  try {
    log.info(`Category explored`, {
      categoryUrl: body.url,
      nrProductsFound: detailedPages.length,
      retailer: extractDomainFromUrl(body.url),
      jobId: body.jobContext.jobId,
    });
  } catch (error) {
    /* logging failed, do nothing */
  }

  if (!body.jobContext.skipPublishing) {
    await sendRequestBatch(detailedPages, req.body.jobContext);
    await updateProductsPopularity(
      detailedPages.map((p) => p.userData as ListingProductInfo),
      body.jobContext
    );
  }

  res.status(200).send({
    nrProductsFound: detailedPages.length,
  });
});

app.post("/search", async (req: Request, res: Response) => {
  const body = <RequestSearch>req.body;
  const products = await searchForProducts(body.query, body.retailer);
  try {
    log.debug(JSON.stringify(products, null, 2));
    log.info("Search completed", {
      query: body.query,
      nrProductsFound: products.length,
      retailer: body.retailer,
      jobId: req.body.jobContext.jobId,
    });
  } catch (error) {
    /* logging failed, do nothing */
  }
  if (!body.jobContext.skipPublishing) {
    await sendRequestBatch(products, req.body.jobContext);
  }

  res.status(200).send({
    nrProductsFound: products.length,
  });
});

app.post("/scrapeDetails", async (req: Request, res: Response) => {
  const body = <RequestBatch>req.body;
  const useCheerio = body.jobContext.scraperProductPage === "cheerio";

  const products = await scrapeDetails(
    body.productDetails,
    body.overrides,
    useCheerio,
    body.launchOptions
  );

  // Logging some details to help with debugging issues on production:
  try {
    log.debug(JSON.stringify(products, null, 2));

    const retailerDomains = new Set(
      body.productDetails.map((p) => extractDomainFromUrl(p.url))
    );
    for (const domain of retailerDomains) {
      const requestUrls = body.productDetails
        .filter((p) => extractDomainFromUrl(p.url) === domain)
        .map((p) => p.url);
      const productsFound = products.filter(
        (p) => extractDomainFromUrl(p.url) === domain
      );
      const urlsFound = [
        ...productsFound.map((p) => p.url),
        ...productsFound.map((p) => p.variantGroupUrl),
      ];
      const urlsNotFound = requestUrls.filter(
        (url) => !urlsFound.includes(url)
      );
      log.info("Product details scraped", {
        nrUrls: requestUrls.length,
        nrProductsFound: productsFound.length,
        nrProductsNotFound: urlsNotFound.length,
        urlsNotFound,
        retailer: domain,
        jobId: req.body.jobContext.jobId,
      });
    }
  } catch (error) {
    /* logging failed, do nothing */
  }

  try {
    await persistProductsToDatabase(products, body.jobContext.jobId);
  } catch (error) {
    // error should be logged already, thus do nothing here
  } finally {
    log.info("Published products to BigQuery", {
      nrProducts: products.length,
    });
  }

  // Filter for matching products and publish them to be updated immediately:
  const matchingProducts = products.filter((p) => p.matchingType === "match");
  if (matchingProducts.length > 0 && !body.jobContext.skipPublishing) {
    await publishProductsToUpdate(matchingProducts, body.jobContext);
  }

  res.status(200).send({
    nrProductsFound: products.length,
    productUrls: products.map((p) => p.url),
  });
});

const port = parseInt(<string>process.env.PORT) || 8080;
app.listen(port, () => {
  console.log(`helloworld: listening on port ${port}`);
});
