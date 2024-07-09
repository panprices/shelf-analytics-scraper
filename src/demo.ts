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
      matchingType: "match",
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

async function debugCategoryExplorationEndToEnd(targetUrls: string[]) {
  const detailedProducts = await exploreCategoryEndToEnd(targetUrls, {
    headless: false,
  });

  writeFileSync(
    join(".", "data.json"),
    JSON.stringify(detailedProducts, null, 2),
    {
      flag: "w",
    }
  );
  log.info("Result written to data.json");
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

//
// await debugCategoryExtraction(["https://www.bygghemma.se/"]);

// await debugCategoryExploration(
//   "https://www.bygghemma.se/inredning-och-belysning/mobler/soffor/2-sits-soffa/"
// );

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

// await debugCategoryExploration(
//   "https://royaldesign.se/belysning/takbelysning/plafonder"
// );

// await debugCategoryExplorationEndToEnd([
//   "https://royaldesign.se/belysning/takbelysning/plafonder",
// ]);

// A lot of variants
await debugScrapeDetails([
  "https://royaldesign.se/tage-50-plafond?p=177464",
]);