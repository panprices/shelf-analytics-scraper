import { log } from "crawlee";
import {
  exploreCategory,
  exploreCategoryNoCapture,
  extractLeafCategories,
  scrapeDetails,
} from "./service";
import { persistProductsToDatabase } from "./publishing";

async function debugMain() {
  const targetUrl =
    "https://www.k-rauta.se/produkt/matbord-kalmar-diameter-120-cm/6438313610830";
  const dummyRequest = {
    url: targetUrl,
    userData: {
      url: targetUrl,
      // brand: 'Venture Design',
      popularityIndex: 1,
      name: "Hillmond HPL 238/297x100 vit/n",
      label: "DETAIL",
    },
  };
  const detailedItems = await scrapeDetails([dummyRequest], {
    headless: false,
  });
  log.info(JSON.stringify(detailedItems));

  log.info("Persisting in BigQuery");
  await persistProductsToDatabase(detailedItems);
  log.info("Published to BigQuery");
}

async function debugCategoryExploration() {
  const targetUrl =
    "https://www.homeroom.se/textilier/gardiner/julgardiner?intcmp=2238_homepage_themes_christmas-curtains";
  await exploreCategory(targetUrl, {
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

// await debugMain()
await debugCategoryExploration();
