import { log } from "crawlee";
import fs, { writeFileSync } from "fs";
import {
  exploreCategory,
  exploreCategoryEndToEnd,
  exploreCategoryEndToEndCheerio,
  extractCategories,
  scrapeDetails,
} from "./service.js";
import path, { join } from "path";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { persistProductsToDatabase } from "./publishing.js";

initializeApp({
  credential: applicationDefault(),
});

async function debugScrapeDetails(targetUrls: string[]) {
  const dummyRequests = targetUrls.map((targetUrl) => ({
    url: targetUrl,
    userData: {
      jobId: "job_test_1",
      url: targetUrl,
      popularityIndex: -1,
      name: "Disa",
      label: "DETAIL",
      matchingType: "new",
    },
  }));
  const detailedItems = await scrapeDetails(
    dummyRequests,
    {
      headless: false,
    },
    false,
    {
      ignoreVariants: false,
      uniqueCrawlerKey: "job_test_1",
    }
  );

  log.info(JSON.stringify(detailedItems, null, 2));
  log.info("Item found", {
    nrItems: detailedItems.length,
    urls: detailedItems.map((item) => item.url),
    nrImages: detailedItems.map((item) => item.images.length),
  });

  // log.info("Persisting in BigQuery");
  // await persistProductsToDatabase(detailedItems);
  // log.info("Published to BigQuery");
}

async function debugCategoryExploration(targetUrl: string) {
  const detailedPages = await exploreCategory(targetUrl, {
    headless: false,
  });

  log.info(`Categories explored`, {
    nrProductsFound: detailedPages.length,
  });
}

async function debugCategoryExplorationEndToEnd(targetUrls: string[], jobId: string) {
  try {
    const detailedProducts = await exploreCategoryEndToEnd(targetUrls, {
      headless: true,
    });

    if (!detailedProducts || detailedProducts.length === 0) {
      log.error("No products were scraped successfully");
      return;
    }

    log.info(`Successfully scraped ${detailedProducts.length} products`);

    // Write to file first
    try {
      writeFileSync(
        join(".", "data.json"),
        JSON.stringify(detailedProducts, null, 2),
        {
          flag: "w",
        }
      );
      log.info("Result written to data.json");
    } catch (writeError) {
      log.error("Failed to write to data.json", { error: writeError });
    }

    // Use the new function to write to BigQuery
    await writeDataJsonToBigQuery(jobId);
  } catch (error) {
    log.error("Fatal error in debugCategoryExplorationEndToEnd", { error });
    throw error;
  }
}

async function debugCategoryExtraction(targetUrls: string[]) {
  const startTime = Date.now();
  const categoryUrls = await extractCategories(targetUrls);

  console.log(JSON.stringify(categoryUrls));
  const endTime = Date.now();
  console.log(`Time taken: ${endTime - startTime} ms`);
}

async function debugScrapeDetailsRecordHARForTests(targetUrl: string) {
  const dummyRequest = {
    url: targetUrl,
    userData: {
      jobId: "job_test_1",
      url: targetUrl,
      brand: "Cottage Home",
      popularityIndex: 1,
      name: "Mexico matbord ø140 svart alu/teak",
      label: "DETAIL",
      fetchedAt: "9/2/2022, 4:51:26 PM",
    },
  };

  const detailedItems = await scrapeDetails([dummyRequest], {
    launchContext: {
      launchOptions: <any>{
        recordHar: {
          path: `recording.har`,
        },
      },
    },
  });

  // log.info(JSON.stringify(detailedItems, null, 2));
  fs.writeFileSync("result.json", JSON.stringify(detailedItems, null, 2));
}

async function debugCategoryExplorationRecordHARForTests(targetUrl: string) {
  const detailedPages = await exploreCategory(targetUrl, {
    launchContext: {
      launchOptions: <any>{
        recordHar: {
          path: `recording.har`,
        },
      },
    },
  });
  fs.writeFileSync("result.json", JSON.stringify(detailedPages, null, 2));
}

async function debugExploreCategoryEndToEndCheerio(categoryUrls: string[]) {
  const detailedProducts = await exploreCategoryEndToEndCheerio(categoryUrls);

  writeFileSync(join(".", "data.json"), JSON.stringify(detailedProducts), {
    flag: "w",
  });
}

async function debugScrapeDetailsCheerio(targetUrl: string) {
  const dummyRequest = {
    url: targetUrl,
    userData: {
      jobId: "job_test_1",
      url: targetUrl,
      popularityIndex: -10,
      label: "DETAIL",
    },
  };
  const detailedItems = await scrapeDetails([dummyRequest], {}, true);

  log.info(JSON.stringify(detailedItems, null, 2));
  log.info("Item found", {
    nrItems: detailedItems.length,
    urls: detailedItems.map((item) => item.url),
    nrImages: detailedItems.map((item) => item.images.length),
  });
}

async function writeDataJsonToBigQuery(jobId: string) {
  try {
    // Read the data.json file
    const data = JSON.parse(fs.readFileSync(join(".", "data.json"), 'utf8'));
    
    if (!data || data.length === 0) {
      log.error("No data found in data.json");
      return;
    }

    log.info(`Found ${data.length} products in data.json`);

    // Publish to BigQuery in batches
    try {
      log.info("Persisting in BigQuery");
      const BATCH_SIZE = 500; // Adjust this number based on your needs
      for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const batch = data.slice(i, i + BATCH_SIZE);
        log.info(`Inserting batch ${i / BATCH_SIZE + 1} of ${Math.ceil(data.length / BATCH_SIZE)}`);
        await persistProductsToDatabase(batch, jobId);
      }
      log.info("Published to BigQuery");
    } catch (dbError) {
      log.error("Failed to persist to BigQuery", { error: dbError });
      throw dbError;
    }
  } catch (error) {
    log.error("Fatal error in writeDataJsonToBigQuery", { error });
    throw error;
  }
}

// // Example usage:
// await writeDataJsonToBigQuery("Macys-Skin-Care-2025-06-15");

//
// await debugCategoryExtraction(["https://www.bygghemma.se/"]);

// await debugCategoryExploration(
//   "https://www.bygghemma.se/inredning-och-belysning/mobler/soffor/2-sits-soffa/"
// );

// await debugScrapeDetails([
//   "https://allbuy.dk/products/skagerak-atlantis-parasol-330x330-cm-rahvid",
// ]);

// await debugScrapeDetails([
//   "https://www.bygghemma.se/inredning-och-belysning/mobler/soffor/2-sits-soffa/2-sitssoffa-scandinavian-choice-copenhagen-manchester/p-1728121",
// ]);

// await debugCategoryExplorationEndToEnd([
//   "https://www.bygghemma.se/inredning-och-belysning/mobler/soffor/2-sits-soffa/",
// ]);

// await debugScrapeDetailsRecordHARForTests(
//   "https://www.ellos.se/ellos-home/barbord-jolina-90x90-cm/1615542-01"
// );
//
// await debugCategoryExplorationRecordHARForTests(
//   "https://www.ellos.se/hem-inredning/mobler/bord/skrivbord"
// );

// await debugScrapeDetails([
//   "https://royaldesign.se/flowerpot-vp9-bordslampa-portabel-v531523?p=335494",
// ]);

// // Discounted Royal Design with 3 variants
// await debugScrapeDetails([
//   "https://royaldesign.se/le-grand-air-utomhus-3-sitssoffa-sunbrella?p=351715",
// ]);

// // 10 variants
// await debugScrapeDetails([
//   "https://royaldesign.se/copenhague-cph-20-bord-o90x74-cm?p=314473",
// ]);

// // A lot of variants
// await debugScrapeDetails([
//   "https://royaldesign.se/bistro-stol-metall?p=163632",
// ]);

// await debugCategoryExtraction(["https://royaldesign.se/"]);

// await extractCategories(["https://royaldesign.se/"]);

// await extractCategories([
//   "https://allbuy.dk/products/skagerak-atlantis-parasol-330x330-cm-rahvid",
// ]);

// await debugCategoryExploration(
//   "https://royaldesign.se/belysning/takbelysning/plafonder"
// );

// await debugCategoryExplorationEndToEnd([
//   "https://royaldesign.se/belysning/takbelysning/plafonder",
// ]);

// // A lot of variants
// await debugScrapeDetails([
//   "https://royaldesign.se/tage-50-plafond?p=177464",
// ]);

// // 10 variants
// await debugScrapeDetails([
//   "https://royaldesign.se/copenhague-cph-20-bord-o90x74-cm?p=314473",
// ]);

// await debugScrapeDetails([
//   "https://www2.hm.com/de_de/productpage.1219487001.html",
// ]);

// // H&M Home product on discount
// await debugScrapeDetails([
//   "https://www2.hm.com/de_de/productpage.1207948003.html",
// ]);

// await debugScrapeDetails([
//   "https://www.scp.co.uk/products/slit-table-high?variant=39682353037392&currency=GBP&srsltid=AfmBOopUZIurHUx0LYVX9eUWYXe4-l_8QhGFDfVvMDEHGtZNIqRh24nwIK0",
// ]);
//
// await debugScrapeDetails([
//   "https://www.connox.com/categories/furniture/seating-furniture/chairs/hay-about-a-chair-aac-22.html?itm=319224&p=103947&Action=Change&CurrencyCode=EUR&srsltid=AfmBOoqFUcv22Ejdbe2akkGBd_rQwl-UyKqqmjGTdVStYiWFme8DqbbIxW4",
// ]);

// await debugScrapeDetails([
//   "https://www.nest.co.uk/product/hay-facet-cabinet?utm_source=google&utm_medium=base&utm_campaign=base&stock=324057",
// ]);

// await debugScrapeDetails([
//   "https://kjellmannhome.no/10002873",
// ]);

// await debugScrapeDetails([
//   "https://www.nest.co.uk/product/hay-peas-rug?utm_source=google&utm_medium=base&utm_campaign=base&stock=198231",
// ]);

// await debugScrapeDetails([
//   "https://www.trademax.se/utem%C3%B6bler/dynforvaring-mobelskydd/%C3%B6verdrag-utem%C3%B6bler/karibib-m%C3%B6belskydd-325x100x255-gr%C3%A5-venture-home-p347914",
// ]);

// // Scrape a product page at Macy's
// await debugScrapeDetails([
//   "https://www.macys.com/shop/product/lancome-renergie-lift-multi-action-day-cream-spf-15-anti-aging-moisturizer-collection?ID=496476",
// ]);

// // Scrape a product page at Macy's
// await debugScrapeDetails([
//   "https://www.macys.com/shop/product/lancome-3-pc.-la-vie-est-belle-eau-de-parfum-gift-set?ID=21227282",
// ]);

// await debugCategoryExploration(
//   "https://www.macys.com/shop/brands/lancome?id=28688&cm_kws=lancome"
// );

// // Scrape the rather small fathers day category and write the data to BigQuery
// await debugCategoryExplorationEndToEnd(
//   ["https://www.macys.com/shop/gift-guide/fathers-day-gift-guide/fathers-day-gifts-by-category/fathers-day-cologne-gifts?id=8273"],
//   "Macys-Father's-Day-Cologne-Gifts-2025-06-15"
// );

// Scrape an entire category and write the data to BigQuery
await debugCategoryExplorationEndToEnd(
  ["https://www.macys.com/shop/makeup-and-perfume/makeup?id=30077"],
  "Macys-Makeup-2025-06-16"
);
