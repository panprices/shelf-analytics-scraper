import { log, LoggerJson } from "crawlee";
import {
  exploreCategory,
  exploreCategoryNoCapture,
  extractLeafCategories,
  scrapeDetails,
} from "./service";
import { persistProductsToDatabase } from "./publishing";

async function debugMain() {
  const targetUrl =
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/soffbord/soffbord-venture-home-disa/p-1159505";
  const dummyRequest = {
    url: targetUrl,
    userData: {
      jobId: "test_job_id",
      url: targetUrl,
      // brand: 'Venture Design',
      popularityIndex: -10,
      name: "Disa",
      label: "DETAIL",
    },
  };
  const detailedItems = await scrapeDetails([dummyRequest], {
    headless: false,
  });

  log.info(JSON.stringify(detailedItems, null, 2));

  log.info("Persisting in BigQuery");
  await persistProductsToDatabase(detailedItems);
  log.info("Published to BigQuery");
}

async function debugCategoryExploration() {
  const targetUrl =
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/?page=2";
  await exploreCategory(targetUrl, "test_job_id", {
    headless: false,
  });
}

async function debugCategoryExplorationNoCapture() {
  const targetUrl = "https://www.venturedesign.se/utemobler/bord-utemobler";
  await exploreCategoryNoCapture(targetUrl, {
    headless: false,
    maxConcurrency: 5,
  });
}

async function debugLeafCategoryExtraction() {
  const targetUrl = "https://www.venturedesign.se/furniture-fashion";
  await extractLeafCategories(targetUrl);
}

// await debugCategoryExploration();
await debugMain();
