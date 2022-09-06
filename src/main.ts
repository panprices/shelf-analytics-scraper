import {log} from "crawlee";
import {exploreCategory, extractLeafCategories, scrapeDetails, exploreCategoryNoCapture} from "./service";
import {persistProductsToDatabase} from "./publishing";


async function debugMain(publish: boolean = false) {
    const targetUrl = 'https://www.trademax.se/utem%C3%B6bler/utestolar-tr%C3%A4dg%C3%A5rdsstolar/h%C3%A4ngstol-utomhus/california-h%C3%A4ngstol-amazonas-p1630420-v692365'
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

    if (publish) {
        await persistProductsToDatabase(detailedItems).then(_ => {
            log.info("Persisted to database")
        })
    }
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
        headless: false
    })
}

async function debugLeafCategoryExtraction() {
    const targetUrl = 'https://www.trademax.se/utem%C3%B6bler'
    await extractLeafCategories(targetUrl)
}

await debugCategoryExploration()