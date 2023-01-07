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

  log.info(`Categories explored`, {
    nrProductsFound: detailedPages.length,
  });
  // sendRequestBatch(detailedPages, "job_test_1");
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
  // const dummyRequest2 = {
  //   url: "https://www.chilli.se/m%C3%B6bler/bord/bordstillbeh%C3%B6r/ill%C3%A4ggsskiva/till%C3%A4ggsskiva-paris-ekvit-ekvit-p120491",
  //   userData: {
  //     jobId: "job_test_1",
  //     url: targetUrl,
  //     brand: "Cottage Home",
  //     popularityIndex: 1,
  //     name: "Mexico matbord ø140 svart alu/teak",
  //     label: "DETAIL",
  //     fetchedAt: "9/2/2022, 4:51:26 PM",
  //   },
  // };

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

async function debugCategoryExplorationRecordHARForTests(targetUrl: string) {
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
  fs.writeFileSync("result.json", JSON.stringify(detailedPages, null, 2));
}

await debugCategoryExploration(
  "https://www.chilli.se/textil/gardiner/hissgardin-roll-up-gardin"
);
// await debugCategoryExplorationNoCapture();
// await debugLeafCategoryExtraction([
//   "https://www.venturedesign.se/furniture-fashion",
//   "https://www.venturedesign.se/innemobler",
//   "https://www.venturedesign.se/utemobler",
//   "https://www.venturedesign.se/nyheter"
// ])
// await debugCategoryExplorationRecordHARForTests();

// await debugScrapeDetails(
//   "https://www.trademax.se/m%C3%B6bler/soffor/soffgrupp/chesterfield-soffgrupp/chesterfield-lyx-soffgrupp-3-sits-2-sits-f%C3%A5t%C3%B6lj-sammet-m%C3%B6rkgr%C3%A5-p600918-v272307"
// );
// await debugScrapeDetailsRecordHARForTests(
//   "https://www.chilli.se/m%C3%B6bler/barnm%C3%B6bler/barns%C3%A4ng-juniors%C3%A4ng/v%C3%A5ningss%C3%A4ngar/v%C3%A5ningss%C3%A4ng-kartar-90x200-cm-vit-p963527"
// );

// await exploreCategoryEndToEnd([
//   "https://www.chilli.se/m%C3%B6bler/soffor/divansoffa-sch%C3%A4slongsoffa",
// ]);

// Gardenstore

// await debugCategoryExploration(
//   "https://www.gardenstore.se/utemobler/loungemobler"
// );

// await debugScrapeDetails(
//   "https://www.gardenstore.se/19935-780-matstol-venture-design-velvet-lyx-beige"
// );
// With discount:
// await debugScrapeDetails(
//   "https://www.gardenstore.se/hangstol-venture-design-lexi-for-djur?channable=033265736b7500313031392d343038de"
// );
// Out of stock & only 1 image
// await debugScrapeDetails(
//   "https://www.gardenstore.se/storblommig-ros-budde-rosa-augusta-luise"
// );
// 2 div.description
// await debugScrapeDetails(
//   "https://www.gardenstore.se/vat-grovdammsugare-einhell-th-vc-1820-s-20-l"
// );
// await debugScrapeDetails(
//   "https://www.gardenstore.se/gr19820-matgrupp-venture-design-jepara-arctic-matbord-250-100-6-matstolar"
// );

// await debugScrapeDetailsRecordHARForTests(
//   "https://www.gardenstore.se/gr19635-matgrupp-venture-design-sleek-plaza-matbord-195-95-6-matstolar"
// );

// await debugCategoryExplorationEndToEnd([
//   "https://www.gardenstore.se/varumarken/venture-design",
// ]);

// ===
// Unoliving
// ===

// await debugCategoryExploration("https://unoliving.com/brands/venture-design");
// await debugCategoryExploration(
//   "https://www.homeroom.se/dekoration/presentpapper-tillbehor"
// );

// await debugCategoryExplorationRecordHARForTests(
//   "https://unoliving.com/sovevaerelse/sengetilbehor"
// );

// With discount, 3 images
// await debugScrapeDetails(
//   "https://unoliving.com/temahome-apex-spisebord-gra-beton-look-200x100"
// );

// With error

// await debugScrapeDetails(
//   "https://unoliving.com/nordal-sof-2-pers-sofa-varm-gra-velour"
// );
// await debugScrapeDetailsRecordHARForTests(
//   "https://unoliving.com/nordal-sof-2-pers-sofa-varm-gra-velour"
// );

// ===
// Ebuy24
// ===

// await debugCategoryExploration("https://ebuy24.dk/shop/93-stole/");

// await debugCategoryExplorationRecordHARForTests(
//   "https://ebuy24.dk/shop/376-glas-spisebord/"
// );

// await debugCategoryExploration(
//   "https://ebuy24.dk/shop/511-overtraek-til-havemoebler/"
// );

// Category page with products having "prisgaranti". Expect 149 products.
// await debugCategoryExploration("https://ebuy24.dk/shop/15-sofaer/");
// await debugCategoryExplorationEndToEnd(["https://ebuy24.dk/shop/93-stole/"]);

// await debugScrapeDetails(
//   "https://ebuy24.dk/shop/93-stole/4461-baroness-laenestol-som-kurvestol-natur-rattan-graa/"
// );

// Many images
// await debugScrapeDetails(
//   "https://ebuy24.dk/shop/93-stole/15096-talgarth-laenestol-recliner-med-fodskammel-antracit-sort/"
// );

// await debugScrapeDetailsRecordHARForTests(
//   "https://ebuy24.dk/shop/93-stole/4092-ramy-laenestol-i-marineblaa-med-mat-sort-metal-stel/"
// );

// Furniture box
// await debugCategoryExploration(
//   "https://www.furniturebox.se/utomhus/utestolar/hangstol"
// );

// await debugScrapeDetails(
//   "https://www.furniturebox.se/textilier/mattor/modern-matta/ullmattor/singapore-ullmatta-200x300-silver-p685751-v340170"
// );
// await debugScrapeDetailsRecordHARForTests(
//   "https://www.furniturebox.se/utomhus/utestolar/hangstol/lukse-hangstol-gra-p844655"
// );

// await debugCategoryExplorationEndToEnd([
//   "https://www.furniturebox.se/utomhus/utestolar/hangstol",
// ]);

// await debugLeafCategoryExtraction([
//   "https://www.furniturebox.se/mobler",
//   "https://www.furniturebox.se/textilier",
//   "https://www.furniturebox.se/inredning",
//   "https://www.furniturebox.se/belysning",
//   "https://www.furniturebox.se/barn-bebis",
//   "https://www.furniturebox.se/forvaring",
//   "https://www.furniturebox.se/kok-hushall",
//   "https://www.furniturebox.se/utomhus",
// ]);

// Homeroom
// await debugScrapeDetails(
//   "https://www.homeroom.se/ellos-home/matgrupp-gilda-med-bord-180x90-cm-6-stolar/1638353-01"
// );
// await debugScrapeDetailsRecordHARForTests(
//   "https://www.homeroom.se/ellos-home/matgrupp-gilda-med-bord-180x90-cm-6-stolar/1638353-01"
// );

// await debugLeafCategoryExtraction(["https://www.homeroom.se"]);

// await debugCategoryExploration(
//   "https://www.homeroom.se/textilier/prydnadskuddar-kuddfodral"
// );

// await debugCategoryExplorationEndToEnd([
//   "https://www.homeroom.se/utemobler-tradgard/utebord",
// ]);

// // Some errors with Homeroom
// await debugScrapeDetails(
//   "https://www.homeroom.se/jotex/menton-soffbord-80x80-cm/1539634-02"
// );

// await debugScrapeDetails(
//   "https://www.homeroom.se/jotex/menton-soffbord-80x80-cm/1539634-01"
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

// Berno Mobler

// await debugCategoryExploration(
//   "https://bernomobler.se/collections/runda-matbord"
// );

// await debugScrapeDetails(
//   "https://bernomobler.se/products/maglehem-sofa-table-glass-black"
// );

// await debugScrapeDetails(
//   "https://bernomobler.se/products/copenhagen-dining-table-round-black-black"
// );

// Test Chilli Cheerio
import { DetailedProductInfo } from "./types/offer";

async function debugScrapeChilliCheerio(categoryUrls: string[]) {
  const detailedProducts = await exploreCategoryEndToEndCheerio(categoryUrls);

  writeFileSync(join(".", "data.json"), JSON.stringify(detailedProducts), {
    flag: "w",
  });
}

async function debugScrapeDetailsChilliCheerio(targetUrl: string) {
  const dummyRequest = {
    url: targetUrl,
    userData: {
      jobId: "job_test_1",
      url: targetUrl,
      popularityIndex: -10,
      name: "Disa",
      label: "DETAIL",
      matchingType: "match",
    },
  };
  const detailedItems = await scrapeDetailsCheerio([dummyRequest]);

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

// await debugScrapeDetailsChilliCheerio(
//   "https://www.chilli.se/m%C3%B6bler/bord/matgrupp/matgrupp-steph-180-cm-med-6-eleri-matstol-svart-p506272"
// );
// await debugScrapeChilliCheerio([
//   "https://www.chilli.se/utem%C3%B6bler/utebord/cafebord",
// ]);

await debugScrapeChilliCheerio([
  "https://www.chilli.se/m%C3%B6bler/bord/soffbord",
  "https://www.chilli.se/m%C3%B6bler/bord/matgrupp",
  //   "https://www.chilli.se/m%C3%B6bler/bord/avlastningsbord",
  //   "https://www.chilli.se/m%C3%B6bler/bord/matbord-k%C3%B6ksbord",
  //   "https://www.chilli.se/m%C3%B6bler/bord/kontorsbord",
  //   "https://www.chilli.se/m%C3%B6bler/bord/marmorbord",
  //   "https://www.chilli.se/m%C3%B6bler/bord/sminkbord-toalettbord",
  //   "https://www.chilli.se/m%C3%B6bler/bord/bordstillbeh%C3%B6r",
  //   "https://www.chilli.se/m%C3%B6bler/bord/barbord-st%C3%A5bord",
  //   "https://www.chilli.se/m%C3%B6bler/bord/serveringsvagn-serveringsbord",
  //   "https://www.chilli.se/m%C3%B6bler/bord/spelbord",
  //   "https://www.chilli.se/m%C3%B6bler/bord/hopf%C3%A4llbart-bord",
  //   "https://www.chilli.se/m%C3%B6bler/bord/massagebord",
  //   "https://www.chilli.se/m%C3%B6bler/bord/avlastningsbord/s%C3%A4ngbord-nattduksbord",
  //   "https://www.chilli.se/m%C3%B6bler/barnm%C3%B6bler/barnbord",
  //   "https://www.chilli.se/m%C3%B6bler/soffor/sammetssoffa",
  //   "https://www.chilli.se/m%C3%B6bler/soffor/divansoffa-sch%C3%A4slongsoffa",
  //   "https://www.chilli.se/m%C3%B6bler/soffor/3-sits-soffa",
  //   "https://www.chilli.se/m%C3%B6bler/soffor/b%C3%A4ddsoffor",
  //   "https://www.chilli.se/m%C3%B6bler/soffor/u-soffa",
  //   "https://www.chilli.se/m%C3%B6bler/soffor/sofftillbeh%C3%B6r",
  //   "https://www.chilli.se/m%C3%B6bler/soffor/soffgrupp",
  //   "https://www.chilli.se/m%C3%B6bler/soffor/howard-soffor",
  //   "https://www.chilli.se/m%C3%B6bler/soffor/2-sits-soffa",
  //   "https://www.chilli.se/m%C3%B6bler/soffor/h%C3%B6rnsoffor",
  //   "https://www.chilli.se/m%C3%B6bler/soffor/skinnsoffa-l%C3%A4dersoffa",
  //   "https://www.chilli.se/m%C3%B6bler/soffor/modulsoffa",
  //   "https://www.chilli.se/m%C3%B6bler/soffor/4-sits-soffa",
  //   "https://www.chilli.se/m%C3%B6bler/soffor/biosoffa-reclinersoffa",
  //   "https://www.chilli.se/m%C3%B6bler/soffor/dagb%C3%A4dd",
  //   "https://www.chilli.se/m%C3%B6bler/soffor/k%C3%B6kssoffa-pinnsoffa",
  //   "https://www.chilli.se/m%C3%B6bler/soffor/chesterfield-soffa",
  //   "https://www.chilli.se/m%C3%B6bler/barnm%C3%B6bler/barnsoffa",
  //   "https://www.chilli.se/m%C3%B6bler/s%C3%A4ngar/kontinentals%C3%A4ngar",
]);
