import {log} from "crawlee";
import {exploreCategory, extractLeafCategories, scrapeDetails} from "./service.js";


async function debugMain() {
    const targetUrl = 'https://www.trademax.se/m%C3%B6bler/s%C3%A4ngar/kontinentals%C3%A4ngar/charm-komplett-s%C3%A4ngpaket-140x200-m%C3%B6rkgr%C3%A5-p401294-v401333'
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
}

async function debugCategoryExploration() {
    const targetUrl = 'https://www.homeroom.se/utemobler-tradgard/parasoller-solskydd/parasoller'
    await exploreCategory(targetUrl)
}

async function debugLeafCategoryExtraction() {
    const targetUrl = 'https://www.trademax.se/utem%C3%B6bler'
    await extractLeafCategories(targetUrl)
}

await debugCategoryExploration()