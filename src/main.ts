import {log} from "crawlee";
import {exploreCategory, extractLeafCategories, scrapeDetails} from "./service";
import {persistProductsToDatabase} from "./publishing";


async function debugMain(publish: boolean = false) {
    const targetUrl = 'https://www.trademax.se/utem%C3%B6bler/utestolar-tr%C3%A4dg%C3%A5rdsstolar/h%C3%A4ngstol-utomhus/h%C3%A4ngstol-tiger-110x110xh200-cm-m%C3%B6rkgr%C3%A5-rotting-p735079'
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

    if (publish) {
        await persistProductsToDatabase(detailedItems).then(_ => {
            log.info("Persisted to database")
        })
    }
}

async function debugCategoryExploration() {
    const targetUrl = 'https://www.homeroom.se/utemobler-tradgard/parasoller-solskydd/parasoller'
    await exploreCategory(targetUrl)
}

async function debugLeafCategoryExtraction() {
    const targetUrl = 'https://www.trademax.se/utem%C3%B6bler'
    await extractLeafCategories(targetUrl)
}

await debugMain(true)