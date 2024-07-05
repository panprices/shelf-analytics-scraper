import express, { Request, Response } from "express";
import bodyParser from "body-parser";
import * as dotenv from "dotenv";
import {
  exploreCategory,
  exploreHomepage,
  extractCategories,
  scrapeDetails,
  searchForProducts,
} from "./service.js";
import { log } from "crawlee";
import {
  ListingProductInfo,
  RequestBatch,
  RequestCategoryExploration,
  RequestSearch,
  ScraperSchedule,
} from "./types/offer.js";
import {
  persistProductsToDatabase,
  publishProductsToUpdate,
  publishListingProductsInBatch,
  triggerJobWithNewCategories,
  updateProductsPopularity,
} from "./publishing.js";
import { extractDomainFromUrl, loggingMiddleware } from "./utils.js";
import { applicationDefault, initializeApp } from "firebase-admin/app";

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

/** Extract categories and return a list of result to be used for
 * category indexing later. */
app.post("/extractCategories", async (req: Request, res: Response) => {
  const startUrls = req.body.intermediate_categories;

  const categoryObjects = await extractCategories(
    startUrls,
    req.body.overrides
  );
  const categoryUrls = categoryObjects.map((c) => c.url);

  res.status(200).send({
    nrCategories: categoryUrls.length,
    categories: categoryUrls,
  });
});

/** Explore categories to
 * (1) find products to scrape detailes
 * and (2) update product popularities. */
app.post("/exploreCategory", async (req: Request, res: Response) => {
  const body = <RequestCategoryExploration>req.body;
  let listingProducts = await exploreCategory(body.url, body.overrides);
  listingProducts = listingProducts.map((p) => {
    return {
      ...p,
      retailerDomain: body.retailerDomain,
      country: body.country,
    };
  });

  try {
    log.info(`Category explored`, {
      categoryUrl: body.url,
      nrProductsFound: listingProducts.length,
      retailer: extractDomainFromUrl(body.url),
      jobId: body.jobContext.jobId,
    });

    log.debug(JSON.stringify(listingProducts[0], null, 2));
  } catch (error) {
    /* logging failed, do nothing */
  }

  if (!body.jobContext.skipPublishing) {
    await publishListingProductsInBatch(listingProducts, req.body.jobContext);
    await updateProductsPopularity(listingProducts, body.jobContext);
  }

  res.status(200).send({
    nrProductsFound: listingProducts.length,
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
    await publishListingProductsInBatch(products, req.body.jobContext);
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

  // Filter for products that we already have and publish them to be updated
  // immediately:
  const existingProducts = products.filter((p) => p.matchingType !== "new");
  if (existingProducts.length > 0 && !body.jobContext.skipPublishing) {
    await publishProductsToUpdate(existingProducts, body.jobContext);
  }

  res.status(200).send({
    nrProductsFound: products.length,
    productUrls: products.map((p) => p.url),
  });
});

app.post(
  "/startJobWithIntermediateCategories",
  async (req: Request, res: Response) => {
    const body = <ScraperSchedule>req.body;
    const intermediateCategories = body.intermediate_categories;
    if (!intermediateCategories) {
      log.warning(
        "Called intermediate categories crawler without intermediate categories"
      );
      res.status(200).send("No intermediate categories");
      return;
    }

    const existingCategoryUrls = body.category_urls ?? [];
    const categoryObjects = await extractCategories(intermediateCategories);
    const categoryUrls = categoryObjects.map((c) => c.url);
    const newCategoryUrls = categoryUrls.filter(
      (c) => !existingCategoryUrls.includes(c)
    );

    await triggerJobWithNewCategories(body, newCategoryUrls);

    res.status(200).send({
      nrNewCategories: newCategoryUrls.length,
      nrTotalCategories: [
        ...new Set([...(body.category_urls ?? []), ...newCategoryUrls]),
      ].length,
    });
  }
);

app.post("/exploreHomepage", async (req: Request, res: Response) => {
  const body = req.body;
  await exploreHomepage(body.url, body.overrides);

  res.status(200).send("OK");
});

// Start the http server
const port = parseInt(<string>process.env.PORT) || 8080;
app.listen(port, () => {
  log.info(`Server started, listening on port ${port}`);
});
