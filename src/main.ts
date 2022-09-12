import {log} from "crawlee";
import {exploreCategory, exploreCategoryNoCapture, extractLeafCategories, scrapeDetails} from "./service";
import {persistProductsToDatabase} from "./publishing";


async function debugMain() {
    const targetUrl = 'https://www.nordiskarum.se/panama-matbord-152-210-90-svart-alu-teak.html'
    const dummyRequest = {
        url: targetUrl,
        userData: {
            url: targetUrl,
            // brand: 'Venture Design',
            popularityIndex: 1,
            name: "Panama matbord 152/210*90 svart alu/teak",
            label: "DETAIL"
        }
    }
    const detailedItems = await scrapeDetails([dummyRequest], {headless: false})
    log.info(JSON.stringify(detailedItems))

    log.info("Persisting in BigQuery");
    await persistProductsToDatabase(detailedItems);
    log.info("Published to BigQuery")
}

async function debugCategoryExploration() {
    const targetUrl = 'https://www.nordiskarum.se/utemobler/matbord-utan-stolar/soffbord.html'
    await exploreCategory(targetUrl, {
        headless: false
    })
}

async function debugCategoryExplorationNoCapture() {
    const targetUrl = 'https://www.venturedesign.se/utemobler/bord-utemobler'
    await exploreCategoryNoCapture(targetUrl, {
        headless: false,
        maxConcurrency: 5
    })
}

async function debugLeafCategoryExtraction() {
    const targetUrl = 'https://www.venturedesign.se/furniture-fashion'
    await extractLeafCategories(targetUrl)
}

await debugMain()
// await debugCategoryExploration()
