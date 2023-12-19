import { log } from "crawlee";
import fs, { writeFileSync } from "fs";
import {
  exploreCategory,
  exploreCategoryEndToEnd,
  exploreCategoryEndToEndCheerio,
  extractLeafCategories,
  scrapeDetails,
} from "./service";
import { join } from "path";
import { initializeApp, applicationDefault } from "firebase-admin/app";

initializeApp({
  credential: applicationDefault(),
});

async function debugScrapeDetails(targetUrl: string) {
  const dummyRequest = {
    url: targetUrl,
    userData: {
      jobId: "job_test_1",
      url: targetUrl,
      popularityIndex: -1,
      name: "Disa",
      label: "DETAIL",
      matchingType: "match",
    },
  };
  const detailedItems = await scrapeDetails(
    [dummyRequest],
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
    headless: true,
  });

  log.info(`Categories explored`, {
    nrProductsFound: detailedPages.length,
  });
}

async function debugCategoryExplorationEndToEnd(targetUrls: string[]) {
  const detailedProducts = await exploreCategoryEndToEnd(targetUrls);

  writeFileSync(join(".", "data.json"), JSON.stringify(detailedProducts), {
    flag: "w",
  });
}

async function debugLeafCategoryExtraction(targetUrls: string[]) {
  const categoryUrls = await extractLeafCategories(targetUrls);

  console.log(JSON.stringify(categoryUrls));
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
//   "https://www.bygghemma.se/golv-och-vagg/malarfarg-och-tapet/tapeter/"
// );{
// await debugScrapeDetails(
//   "https://www.nordiskarum.se/trondheim-x-josefin-lustig-ullmatta-400x400cm-beige/white-51074-320.html"
// );
// await debugCategoryExploration(
//   "https://nordlyliving.dk/collections/dekoration"
// );

// await debugLeafCategoryExtraction(["https://nordlyliving.dk/"]);

await debugScrapeDetails(
  "https://www.louispoulsen.com/da-dk/catalog/private/wall/aj-wall"
);

// await debugCategoryExploration(
//   "https://www.nordiskarum.se/utemobler/hammockar-bankar-tradgardssoffor/sittbankar-ute.html"
// );

// await debugCategoryExplorationRecordHARForTests(
//   "https://www.ellos.se/hem-inredning/mobler/bord/skrivbord"
// );
//
// await debugScrapeDetails(
//   "https://www.nordiskarum.se/aspen-ovalt-matbord---svart-/-mocca-faner-15106-588.html"
// );

// await debugScrapeDetailsRecordHARForTests(
//   "https://www.ellos.se/ellos-home/barbord-jolina-90x90-cm/1615542-01"
// );
//
// await debugCategoryExplorationRecordHARForTests(
//   "https://www.ellos.se/hem-inredning/mobler/bord/skrivbord"
// );
