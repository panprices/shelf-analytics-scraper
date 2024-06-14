import { log } from "crawlee";
import fs, { writeFileSync } from "fs";
import {
  exploreCategory,
  exploreCategoryEndToEnd,
  exploreCategoryEndToEndCheerio,
  extractLeafCategories,
  scrapeDetails,
} from "./service";
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
  const detailedPages = await exploreCategory(targetUrl, "job_test_1", {
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

  writeFileSync(join(".", "data.json"), JSON.stringify(detailedProducts), {
    flag: "w",
  });
}

async function debugLeafCategoryExtraction(targetUrls: string[]) {
  const startTime = Date.now();
  const categoryUrls = await extractLeafCategories(targetUrls);

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
  const detailedPages = await exploreCategory(targetUrl, "job_test_1", {
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

// Berno Mobler

// await debugCategoryExploration(
//   "https://andlight.dk/shop/plakater-og-rammer-4459c1.html"
// );
await debugScrapeDetails([
  "https://www.baldai1.lt/konsoles/konsole-dallas-3185-beige.html",
]);
// await debugCategoryExploration(
//   "https://nordlyliving.dk/collections/dekoration"
// );

// await debugLeafCategoryExtraction(["https://nordlyliving.dk/"]);

// await debugScrapeDetails(
//   "https://www.baldai1.lt/valgomojo-komplektai/valgomojo-komplektas-ja3381-lt.html"
// );

// await debugCategoryExploration(
//   "https://www.finnishdesignshop.com/en-dk/lighting/ceiling-lamps"
// );

// await debugLeafCategoryExtraction([
//   "https://www.venturedesign.se/innemobler",
//   "https://www.venturedesign.se/utemobler",
//   "https://www.venturedesign.se/nyheter",
// ]);

// await debugCategoryExplorationRecordHARForTests(
//   "https://www.ellos.se/hem-inredning/mobler/bord/skrivbord"
// );
//
// await debugScrapeDetails(
//   "https://www.lampenwelt.de/p/louis-poulsen-panthella-320-tischleuchte-chrom-6090405.html?lw_om_view=recotop"
// );

// function readUrlsFromFile(filePath: string) {
//   try {
//     const fileContent = fs.readFileSync(filePath, { encoding: "utf-8" });
//     return fileContent.split(/\r?\n/); // This regex handles both Linux (\n) and Windows (\r\n) line endings
//   } catch (error) {
//     console.error(`Error reading file from ${filePath}:`, error);
//     return [];
//   }
// }
//
// const urls = readUrlsFromFile("urls.txt")
//   .map((u) => (u.startsWith('"') ? u.substring(1, u.length - 1) : u))
//   .filter((u) => u.startsWith("http"));
//
// await debugScrapeDetails([
//   "https://www.baldai1.lt/lauko-baldai/stalo-ir-kedziu-komplektai/stalo-ir-kedziu-komplektas-dallas-2238-pilka-tamsi-pilka.html",
// ]);

// await debugCategoryExplorationEndToEnd([
//   "https://andlight.dk/shop/spejle-833c1.html",
// ]);

// await debugScrapeDetailsRecordHARForTests(
//   "https://www.ellos.se/ellos-home/barbord-jolina-90x90-cm/1615542-01"
// );
//
// await debugCategoryExplorationRecordHARForTests(
//   "https://www.ellos.se/hem-inredning/mobler/bord/skrivbord"
// );

// await debugCategoryExplorationEndToEnd([
//   "https://www.baldai1.lt/search/?q=dallas",
//   // "https://www.baldai1.lt/biuro-baldai/biuro-komodos/",
// ]);
