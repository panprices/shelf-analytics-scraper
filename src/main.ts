import { log, LoggerJson } from "crawlee";
import fs, { writeFileSync } from "fs";
import {
  exploreCategory,
  exploreCategoriesNoCapture,
  extractLeafCategories,
  scrapeDetails,
  exploreCategoryEndToEnd,
  exploreCategoryEndToEndCheerio,
} from "./service";
import { persistProductsToDatabase, sendRequestBatch } from "./publishing";
import { join } from "path";

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
// await debugCategoryExploration("https://www.homeroom.se/mobler/matgrupper");

// await debugScrapeDetails(
//   "https://www.bygghemma.se/tradgard-och-utemiljo/utemobler-och-tradgardsmobler/solstol-och-solmobler/dackstol/solstol-venture-design-kiara/p-1110925"
// );

// Ellos Home
// await debugCategoryExploration(
//   "https://www.ellos.se/hem-inredning/mobler/bord/skrivbord"
// );

// await debugCategoryExplorationRecordHARForTests(
//   "https://www.ellos.se/hem-inredning/mobler/bord/skrivbord"
// );

// await debugScrapeDetails(
//   "https://www.ellos.se/ellos-home/barbord-jolina-90x90-cm/1615542-01"
// );

// await debugScrapeDetailsRecordHARForTests(
//   "https://www.ellos.se/ellos-home/barbord-jolina-90x90-cm/1615542-01"
// );
//
// await debugCategoryExplorationRecordHARForTests(
//   "https://www.ellos.se/hem-inredning/mobler/bord/skrivbord"
// );

import puppeteer from "puppeteer-extra";
import { chromium as playwright } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { PuppeteerExtraPluginAdblocker } from "puppeteer-extra-plugin-adblocker";

// puppeteer.use(StealthPlugin());
// puppeteer.use(new PuppeteerExtraPluginAdblocker({ blockTrackers: true }));

playwright.use(StealthPlugin());
// playwright.use(new PuppeteerExtraPluginAdblocker({ blockTrackers: true }));

const wayfairPages = [
  {
    url: "https://www.wayfair.de/furniture/pdp/-D003943309.html?piid=78709347",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D003943309.html?piid=78709348",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D003943309.html?piid=78709349",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D003943309.html?piid=78709346",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D003943309.html?piid=78709345",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D002588771.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D001588011.html?piid=812794119",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D001588011.html?piid=812794112",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D001588011.html?piid=812794118",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D001604112.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D004022314.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D004003579.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D002951966.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D003741995.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D002991705.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D001617559.html?piid=1332991083%2C1332991082",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D001617559.html?piid=1332991083%2C1332991080",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D001617559.html?piid=1332991085%2C1332991082",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D002952091.html?piid=58781692",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D002952091.html?piid=58781691",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D002917435.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D004012118.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D002951910.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D003742056.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D004022649.html?piid=82408228",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D004022649.html?piid=82408229",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D002952181.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D002951905.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D002952140.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D004023753.html?piid=82408226",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D004023753.html?piid=82408227",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D004022748.html?piid=82408224%2C82408225",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D004022748.html?piid=82408222%2C82408223",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D004023041.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D000738977.html?piid=60809588",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D000738977.html?piid=60809587",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D002847322.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D003921081.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D004022801.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D001576570.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D002917440.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D002952183.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D004014757.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D000158119.html?piid=1667664958",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D000158119.html?piid=1667664945",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D002946778.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D004014795.html?piid=81939902",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D004014795.html?piid=81939901",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D000736359.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D000982630.html?piid=60809571",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D000982630.html?piid=60809573",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D000982630.html?piid=60809572",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D003021235.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D004015467.html?piid=81939905",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D004015467.html?piid=81939907",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D004015467.html?piid=81939906",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D003920966.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D004015122.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D000720081.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D004023874.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D002844780.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D001829919.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D003745311.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D004023401.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-VTDG4725.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D001615486.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D004023947.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D004003649.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D003920849.html?piid=78684523",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D003920849.html?piid=78684524",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D003744986.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D000391150.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D001829908.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D003367064.html?piid=66162771%2C66162772",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D003367064.html?piid=66162771%2C66162770",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D003367064.html?piid=66162773%2C66162772",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D003367064.html?piid=66162769%2C66162770",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D002917431.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-VTDG4717.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D003021199.html?piid=59827617",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D003021199.html?piid=59827615",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D003021199.html?piid=59827616",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D002952130.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D004003230.html?piid=81518176",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D004003230.html?piid=81518177",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D001610105.html?piid=364375716",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D001610105.html?piid=364374931",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D001610105.html?piid=364374940",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D001610105.html?piid=364374805",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D002952077.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D000996616.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D003021285.html?piid=59827782",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D003021285.html?piid=59827783",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D004003718.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D003020260.html?piid=60887829",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D003020260.html?piid=60887828",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D001572599.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D003943399.html?piid=78709259",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D003943399.html?piid=78709260",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D003943399.html?piid=78709257",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D003943399.html?piid=78709258",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-VTDG6112.html?piid=61308721",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-VTDG6112.html?piid=61308722",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-VTDG6112.html?piid=61308724",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D003943259.html?piid=78709237",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D003943259.html?piid=78709238",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D003943259.html?piid=78709236",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D003745029.html",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D004015996.html?piid=81939904",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D004015996.html?piid=81939903",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
  {
    url: "https://www.wayfair.de/furniture/pdp/-D003921136.html?piid=78685150",
    category_url: undefined,
    popularity_index: undefined,
    popularity_category: undefined,
  },
];

const main = async () => {
  const browser = await playwright.launch({
    headless: false,
    // ignoreHTTPSErrors: true,
    slowMo: 0,
    args: [
      "--window-size=1400,900",
      "--remote-debugging-port=9222",
      "--remote-debugging-address=0.0.0.0", // You know what your doing?
      "--disable-gpu",
      "--disable-features=IsolateOrigins,site-per-process",
      "--blink-settings=imagesEnabled=true",
    ],
  });
  let page = await browser.newPage();
  // await page.evaluateOnNewDocument(() => {
  //   // @ts-ignore
  //   delete navigator.__proto__.webdriver;
  // });
  // await page.goto("https://bot.sannysoft.com/", { timeout: 0 });

  // await new Promise((r) => setTimeout(r, 60000));
  // await page.screenshot({ path: "example.png" });

  let index = 0;
  for (const wayfairPage of wayfairPages) {
    await page.goto(wayfairPage["url"], { timeout: 0 });
    await new Promise((r) => setTimeout(r, 1000));
    await page.screenshot({ path: `example${index}.png` });
    index++;
    console.log("index: ", index);
  }

  await browser.close();
};

await main();
