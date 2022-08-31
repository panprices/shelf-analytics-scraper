import {log} from "crawlee";
import {exploreCategory, scrapeDetails} from "./service.js";


async function debugMain() {
    const targetUrl = 'https://www.homeroom.se/venture-home/matgrupp-polar-bord-med-4st-penally-stolar/1577643-01'
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
    await scrapeDetails([dummyRequest], {headless: false}, true)
}

await debugMain()