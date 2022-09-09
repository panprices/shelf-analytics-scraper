import {log} from "crawlee";
import {exploreCategory, exploreCategoryNoCapture, extractLeafCategories, scrapeDetails} from "./service";
import {persistProductsToDatabase} from "./publishing";


async function debugMain() {
    const targetUrl = 'https://www.venturedesign.se/products/estes-dining-chair-grey-smoked-black-wood'
    const dummyRequest = {
        url: targetUrl,
        userData: {
            url: targetUrl,
            brand: 'Venture Home',
            popularityIndex: 1,
            name: "Matgrupp Polar bord med 4st Penally stolar",
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
    const targetUrl = 'https://www.venturedesign.se/utemobler/bord-utemobler'
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