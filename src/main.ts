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
      headless: true,
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
//   "https://www.bygghemma.se/golv-och-vagg/malarfarg-och-tapet/tapeter/"
// );{
// await debugScrapeDetails(
//   "https://www.nordiskarum.se/trondheim-x-josefin-lustig-ullmatta-400x400cm-beige/white-51074-320.html"
// );
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

await debugScrapeDetails([
  "https://flos.com/it/it/toio/M-toio.html?gad_source=1&gclid=EAIaIQobChMI--qwq_PjggMVGoVoCR39DQfTEAAYASAAEgKOTfD_BwE",
  "https://flos.com/it/it/bilboquet-sage-led-retrofit/F0995039.html",
  "https://flos.com/it/it/ceramique/M-ceramique.html?dwvar_M-ceramique_color=colour_moss-green&dwvar_M-ceramique_modelInfo=Ceramique%20Down&quantity=1",
  "https://flos.com/it/it/skynest-suspension-blue-tourmaline/F6392003.html",
  "https://flos.com/it/it/glo-ball-suspension-2-white-alogena-glo-ball-suspension-2/F3010061.html",
  "https://flos.com/it/it/2097-30--clear-bulbs--chrome-led-retrofit-2097-30--clear-bulbs-/A1402057.html",
  "https://flos.com/it/it/265-black-alogena/A0300030.html",
  "https://flos.com/it/it/arco-led-steel-arco-led/F0303000.html",
  "https://flos.com/it/it/bellhop/M-bellhop.html?dwvar_M-bellhop_color=colour_brick-red&quantity=1",
  "https://flos.com/en/it/captain-flint-anthracite-black-marble/F1530030.html",
  "https://flos.com/en/it/foglio/M-foglio.html?dwvar_M-foglio_color=colour_white&quantity=1",
  "https://flos.com/en/it/frisbi-chrome-halogen/F2500000.html",
  "https://flos.com/en/it/ic-lights-f1-brass-halogen-ic-lights-floor-1/F3173059.html",
  "https://flos.com/en/it/ic-lights-suspension/M-ic-lights-suspension.html?dwvar_M-ic-lights-suspension_color=colour_brass&dwvar_M-ic-lights-suspension_modelInfo=IC%20Lights%20Suspension%201&quantity=1",
  "https://flos.com/en/it/lampadina/M-lampadina.html?dwvar_M-lampadina_color=colour_black&quantity=1",
  "https://flos.com/en/it/mayday/M-mayday.html?dwvar_M-mayday_color=colour_orange&quantity=1",
  "https://flos.com/en/it/glo-ball-ceiling-wall/M-glo-ball-ceiling-wall.html?dwvar_M-glo-ball-ceiling-wall_modelInfo=Mini%20Glo-Ball%20Ceiling%2FWall&quantity=1",
  "https://flos.com/en/it/parentesi/M-parentesi.html?dwvar_M-parentesi_Additional%20Element=No%20Additional%20Element&dwvar_M-parentesi_color=colour_black&dwvar_M-parentesi_modelInfo=Parentesi%20dimmer&quantity=1",
  "https://flos.com/en/it/skygarden-1-black-halogen-skygarden-1/F0001030.html",
  "https://flos.com/en/it/smithfield-ceiling/M-smithfield-ceiling.html?dwvar_M-smithfield-ceiling_color=colour_colour_green&dwvar_M-smithfield-ceiling_modelInfo=Smithfield%20Ceiling&quantity=1",
  "https://flos.com/en/it/snoopy/M-snoopy.html?dwvar_M-snoopy_color=colour_black&quantity=1",
  "https://flos.com/en/it/taccia-black-taccia/F6602030.html",
  "https://flos.com/en/it/taraxacum-88-suspension-1-polished-aluminium-led-retrofit/F7431000.html",
]);

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
