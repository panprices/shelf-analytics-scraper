import { log, LoggerJson } from "crawlee";
import fs from "fs";
import {
  exploreCategory,
  exploreCategoryNoCapture,
  extractLeafCategories,
  scrapeDetails,
} from "./service";
import { persistProductsToDatabase } from "./publishing";

async function debugMain() {
  const targetUrl =
    "https://www.homeroom.dk/house-nordic/spegel-madrid/1712799-01";
  // "https://www.bygghjemme.no/hage-och-utemiljo/grill/gassgrill/gassgrill-sunwind-vilja/p-918623";
  // "https://www.trademax.se/utem%C3%B6bler/utebord/matbord-utomhus/kenya-matbord-150-cm-svart-p1509844";
  // "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/soffbord/soffbord-venture-home-disa/p-1159505"; // normal images
  // "https://www.bygghemma.se/inredning-och-belysning/mobler/soffor/u-soffa/u-soffa-venture-home-zanzibar/p-1407920"; // multiple colours
  // "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matbord-och-koksbord/matbord-venture-home-polar/p-1159433"; // colors + dropdown spec

  // "https://www.bygghemma.se/verktyg-och-maskiner/elverktyg/slipmaskin/vaggslip-och-takslip/slipkit-mirka-leros-med-dammsugare-1230-m-afc-m-klass/p-1123039"; // only 1 main image, no thumbnails

  const dummyRequest = {
    url: targetUrl,
    userData: {
      jobId: "test_job_id",
      url: targetUrl,
      // brand: 'Venture Design',
      popularityIndex: -10,
      name: "Disa",
      label: "DETAIL",
      matchingType: "match",
    },
  };
  const detailedItems = await scrapeDetails([dummyRequest], {
    headless: false,
  });

  log.info(JSON.stringify(detailedItems, null, 2));
  log.info("Item found", {
    nrItems: detailedItems.length,
    urls: detailedItems.map((item) => item.url),
    nrImages: detailedItems.map((item) => item.images.length),
  });

  log.info("Persisting in BigQuery");
  await persistProductsToDatabase(detailedItems);
  log.info("Published to BigQuery");
}

async function debugCategoryExploration() {
  const targetUrl =
    // "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/?page=2";
    "https://www.trademax.se/utem%C3%B6bler/utestolar-tr%C3%A4dg%C3%A5rdsstolar/solstolar";
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

async function captureHARForUnitTest() {
  const targetUrl =
    "https://www.k-rauta.se/produkt/badkar-naantali-med-tassar-vitt/5727419542413";
  const dummyRequest = {
    url: targetUrl,
    userData: {
      jobId: "test_job_id",
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
      // experimentalContainers: true,
    },
  });

  // log.info(JSON.stringify(detailedItems, null, 2));
  fs.writeFileSync("result.json", JSON.stringify(detailedItems, null, 2));
}

// await debugCategoryExploration();
// await debugMain();
await captureHARForUnitTest();
