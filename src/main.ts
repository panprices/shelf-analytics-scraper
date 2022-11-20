import { log, LoggerJson } from "crawlee";
import fs, {writeFileSync} from "fs";
import {
  exploreCategory,
  exploreCategoriesNoCapture,
  extractLeafCategories,
  scrapeDetails, exploreCategoryEndToEnd,
} from "./service";
import { persistProductsToDatabase, sendRequestBatch } from "./publishing";
import {join} from "path";

async function debugScrapeDetails(targetUrl: string) {
  // "https://www.bygghjemme.no/hage-och-utemiljo/grill/gassgrill/gassgrill-sunwind-vilja/p-918623";
  // "https://www.trademax.se/utem%C3%B6bler/utebord/matbord-utomhus/kenya-matbord-150-cm-svart-p1509844";
  // "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/soffbord/soffbord-venture-home-disa/p-1159505"; // normal images
  // "https://www.bygghemma.se/inredning-och-belysning/mobler/soffor/u-soffa/u-soffa-venture-home-zanzibar/p-1407920"; // multiple colours
  // "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matbord-och-koksbord/matbord-venture-home-polar/p-1159433"; // colors + dropdown spec

  // "https://www.bygghemma.se/verktyg-och-maskiner/elverktyg/slipmaskin/vaggslip-och-takslip/slipkit-mirka-leros-med-dammsugare-1230-m-afc-m-klass/p-1123039"; // only 1 main image, no thumbnails

  const dummyRequest = {
    url: targetUrl,
    userData: {
      jobId: "job_test_1",
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

  // log.info("Persisting in BigQuery");
  // await persistProductsToDatabase(detailedItems);
  // log.info("Published to BigQuery");
}

async function debugCategoryExploration(targetUrl: string) {
  const detailedPages = await exploreCategory(targetUrl, "job_test_1", {
    headless: false,
  });
  // sendRequestBatch(detailedPages, "job_test_1");
}

async function debugCategoryExplorationEndToEnd(targetUrls: string[]) {
  const detailedProducts = await exploreCategoryEndToEnd(targetUrls)

  writeFileSync(join('.', 'data.json'), JSON.stringify(detailedProducts), {flag: 'w'})
}

async function debugLeafCategoryExtraction(targetUrls: string[]) {
  await extractLeafCategories(targetUrls);
}

async function debugScrapeDetailsRecordHARForTests() {
  const targetUrl =
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matbord-och-koksbord/matbord-venture-home-polar/p-1159433";
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
      // experimentalContainers: true,
    },
  });

  // log.info(JSON.stringify(detailedItems, null, 2));
  fs.writeFileSync("result.json", JSON.stringify(detailedItems, null, 2));
}

async function debugCategoryExplorationRecordHARForTests() {
  const targetUrl =
    "https://www.bygghemma.se/inredning-och-belysning/trappor/spiraltrappa/";
  const detailedPages = await exploreCategory(targetUrl, "job_test_1", {
    launchContext: {
      launchOptions: <any>{
        recordHar: {
          path: `recording.har`,
        },
      },
      // experimentalContainers: true,
    },
  });
}

// await debugCategoryExploration(
//   "https://www.k-rauta.se/kategori/verktyg-och-maskiner/arbetsklader-och-sakerhet/handskar/tradgardshandskar"
// );
// await debugCategoryExplorationNoCapture();
// await debugLeafCategoryExtraction([
//   "https://www.venturedesign.se/furniture-fashion",
//   "https://www.venturedesign.se/innemobler",
//   "https://www.venturedesign.se/utemobler",
//   "https://www.venturedesign.se/nyheter"
// ])
await debugCategoryExplorationEndToEnd([
  "https://www.venturedesign.se/innemobler/gr-sangpaket",
  "https://www.venturedesign.se/furniture-fashion/innemobler/gr-matgrupper",
  "https://www.venturedesign.se/innemobler/bord/matbord",
  "https://www.venturedesign.se/innemobler/bord/barbord",
  "https://www.venturedesign.se/innemobler/bord/sangbord",
  "https://www.venturedesign.se/innemobler/bord/skrivbord",
  "https://www.venturedesign.se/innemobler/bord/sidobord",
  "https://www.venturedesign.se/innemobler/bord/soffbord",
  "https://www.venturedesign.se/innemobler/stolar/matstolar",
  "https://www.venturedesign.se/innemobler/stolar/barstolar",
  "https://www.venturedesign.se/innemobler/soffor/2-sits-soffor",
  "https://www.venturedesign.se/innemobler/soffor/divansoffor",
  "https://www.venturedesign.se/innemobler/soffor/hornsoffor",
  "https://www.venturedesign.se/innemobler/soffor/3-sits-soffor",
  "https://www.venturedesign.se/innemobler/soffor/reclinersoffor",
  "https://www.venturedesign.se/innemobler/bankar/bankar",
  "https://www.venturedesign.se/innemobler/soffor/baddsoffor",
  "https://www.venturedesign.se/innemobler/ftoljer/ftoljer",
  "https://www.venturedesign.se/innemobler/ftoljer/loungeftoljer",
  "https://www.venturedesign.se/innemobler/ftoljer/reclinerftoljer",
  "https://www.venturedesign.se/innemobler/ftoljer/teddyftoljer",
  "https://www.venturedesign.se/innemobler/ottomanpuff/ottoman",
  "https://www.venturedesign.se/innemobler/ottomanpuff/puff",
  "https://www.venturedesign.se/innemobler/sangar/dubbelsangar",
  "https://www.venturedesign.se/innemobler/gr-matgrupper/rektangulara-matgrupper",
  "https://www.venturedesign.se/innemobler/gr-matgrupper/runda-matgrupper",
  "https://www.venturedesign.se/innemobler/sangar/justerbara-sangar",
  "https://www.venturedesign.se/innemobler/sangar/sanggavlar",
  "https://www.venturedesign.se/innemobler/gr-matgrupper/ovala-matgrupper",
  "https://www.venturedesign.se/innemobler/forvaring/skp",
  "https://www.venturedesign.se/innemobler/forvaring/byr",
  "https://www.venturedesign.se/innemobler/forvaring/tv-bankar",
  "https://www.venturedesign.se/innemobler/forvaring/hyllor",
  "https://www.venturedesign.se/innemobler/forvaring/garderober",
  "https://www.venturedesign.se/innemobler/forvaring/kladhangare",
  "https://www.venturedesign.se/innemobler/mattor/rektangulara-mattor",
  "https://www.venturedesign.se/innemobler/mattor/runda-mattor",
  "https://www.venturedesign.se/innemobler/mattor/ovala-mattor",
  "https://www.venturedesign.se/innemobler/textil/sangkappor",
  "https://www.venturedesign.se/innemobler/textil/sangklader",
  "https://www.venturedesign.se/innemobler/textil/overkast",
  "https://www.venturedesign.se/innemobler/textil/gardiner",
  "https://www.venturedesign.se/innemobler/textil/sanggaveloverdrag",
  "https://www.venturedesign.se/innemobler/textil/frskinn",
  "https://www.venturedesign.se/innemobler/textil/pladar",
  "https://www.venturedesign.se/innemobler/industrivaggar/industrivaggar",
  "https://www.venturedesign.se/innemobler/speglar/speglar",
  "https://www.venturedesign.se/innemobler/poster/natur",
  "https://www.venturedesign.se/innemobler/poster/hem",
  "https://www.venturedesign.se/innemobler/poster/abstrakt",
  "https://www.venturedesign.se/innemobler/belysning/golvlampor",
  "https://www.venturedesign.se/innemobler/belysning/vagglampor",
  "https://www.venturedesign.se/innemobler/barnmobler/barnstolar",
  "https://www.venturedesign.se/innemobler/belysning/taklampor",
  "https://www.venturedesign.se/innemobler/belysning/bordslampor",
  "https://www.venturedesign.se/innemobler/barnmobler/barnsoffor",
  "https://www.venturedesign.se/innemobler/barnmobler/barnbord",
  "https://www.venturedesign.se/furniture-fashion/innemobler/bord/sidobord",
  "https://www.venturedesign.se/furniture-fashion/innemobler/bord/matbord",
  "https://www.venturedesign.se/furniture-fashion/innemobler/bord/soffbord",
  "https://www.venturedesign.se/furniture-fashion/innemobler/ottomanpuff/puff",
  "https://www.venturedesign.se/furniture-fashion/innemobler/stolar/matstolar",
  "https://www.venturedesign.se/nyheter/innemobler/gr-matgrupper",
  "https://www.venturedesign.se/utemobler/bord/barbord",
  "https://www.venturedesign.se/utemobler/bord/cafbord",
  "https://www.venturedesign.se/utemobler/bord/matbord",
  "https://www.venturedesign.se/utemobler/bord/sidobord",
  "https://www.venturedesign.se/utemobler/bord/soffbord",
  "https://www.venturedesign.se/utemobler/stolar/matstolar",
  "https://www.venturedesign.se/utemobler/stolar/barstolar",
  "https://www.venturedesign.se/utemobler/stolar/cafstolar",
  "https://www.venturedesign.se/utemobler/stolar/positionsstolar",
  "https://www.venturedesign.se/utemobler/stolar/reclinerstolar",
  "https://www.venturedesign.se/utemobler/soffor/2-sits-soffor",
  "https://www.venturedesign.se/utemobler/soffor/3-sits-soffor",
  "https://www.venturedesign.se/utemobler/soffor/hammock",
  "https://www.venturedesign.se/utemobler/bankar/bankar",
  "https://www.venturedesign.se/utemobler/ftoljer/loungeftoljer",
  "https://www.venturedesign.se/utemobler/loungegrupper/horngrupper",
  "https://www.venturedesign.se/utemobler/loungegrupper/lounge-set",
  "https://www.venturedesign.se/utemobler/loungegrupper/soffgrupper",
  "https://www.venturedesign.se/utemobler/loungegrupper/caf-set",
  "https://www.venturedesign.se/utemobler/gr-matgrupper/rektangulara-matgrupper",
  "https://www.venturedesign.se/utemobler/gr-matgrupper/lounge-stolar",
  "https://www.venturedesign.se/utemobler/gr-matgrupper/runda-matgrupper",
  "https://www.venturedesign.se/utemobler/hangstolar/hangstolar",
  "https://www.venturedesign.se/utemobler/solstolar/solstolar",
  "https://www.venturedesign.se/utemobler/hangmattor/hangmattor",
  "https://www.venturedesign.se/utemobler/parasoll/parasoll",
  "https://www.venturedesign.se/utemobler/parasollstenar/parasollstenar",
  "https://www.venturedesign.se/utemobler/dynor/positionsdynor",
  "https://www.venturedesign.se/utemobler/dynor/matstolsdynor",
  "https://www.venturedesign.se/utemobler/dynor/bankdynor",
  "https://www.venturedesign.se/utemobler/dynor/dynset",
  "https://www.venturedesign.se/utemobler/forvaring/hangare",
  "https://www.venturedesign.se/utemobler/dynor/solstolsdynor",
  "https://www.venturedesign.se/utemobler/forvaring/dynboxar",
  "https://www.venturedesign.se/utemobler/pergola-och-paviljonger/paviljonger",
  "https://www.venturedesign.se/utemobler/kok/sektioner",
  "https://www.venturedesign.se/utemobler/pergola-och-paviljonger/pergola",
  "https://www.venturedesign.se/utemobler/kok/handfat",
  "https://www.venturedesign.se/utemobler/kok/pizzaugn",
  "https://www.venturedesign.se/utemobler/varmare/terassvarmare",
  "https://www.venturedesign.se/utemobler/varmare/eldkorgar",
  "https://www.venturedesign.se/utemobler/mobelskydd/mobelskydd",
  "https://www.venturedesign.se/utemobler/mobelskydd/parasollskydd",
  "https://www.venturedesign.se/utemobler/matgrupper/matgrupper",
  "https://www.venturedesign.se/utemobler/matgrupper/bar-set",
  "https://www.venturedesign.se/utemobler/matgrupper/caf-set",
  "https://www.venturedesign.se/nyheter/innemobler/stolar/matstolar",
  "https://www.venturedesign.se/nyheter/innemobler/stolar/barstolar",
  "https://www.venturedesign.se/nyheter/innemobler/bankar/bankar",
  "https://www.venturedesign.se/nyheter/innemobler/bord/barbord",
  "https://www.venturedesign.se/nyheter/innemobler/bord/matbord",
  "https://www.venturedesign.se/nyheter/innemobler/bord/sidobord",
  "https://www.venturedesign.se/nyheter/innemobler/bord/soffbord",
  "https://www.venturedesign.se/nyheter/innemobler/soffor/3-sits-soffor",
  "https://www.venturedesign.se/nyheter/innemobler/ottomanpuff/puff",
  "https://www.venturedesign.se/nyheter/innemobler/ftoljer/ftoljer",
  "https://www.venturedesign.se/nyheter/innemobler/ftoljer/loungeftoljer",
  "https://www.venturedesign.se/nyheter/innemobler/ftoljer/teddyftoljer",
  "https://www.venturedesign.se/nyheter/innemobler/forvaring/skp",
  "https://www.venturedesign.se/nyheter/innemobler/forvaring/byr",
  "https://www.venturedesign.se/nyheter/innemobler/forvaring/hyllor",
  "https://www.venturedesign.se/nyheter/innemobler/forvaring/garderober",
  "https://www.venturedesign.se/nyheter/innemobler/forvaring/tv-bankar",
  "https://www.venturedesign.se/nyheter/innemobler/mattor/rektangulara-mattor",
  "https://www.venturedesign.se/nyheter/innemobler/speglar/speglar",
  "https://www.venturedesign.se/nyheter/innemobler/mattor/runda-mattor",
  "https://www.venturedesign.se/nyheter/innemobler/mattor/ovala-mattor",
  "https://www.venturedesign.se/nyheter/innemobler/barnmobler/barnstolar",
  "https://www.venturedesign.se/nyheter/innemobler/barnmobler/barnsoffor"
])
// await debugScrapeDetailsCaptureHARForTests();
// await debugCategoryExplorationRecordHARForTests();
