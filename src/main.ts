import {log} from "crawlee";
import {exploreCategory, scrapeDetails} from "./service.js";


async function debugMain() {
    const targetUrl = 'https://www.trademax.se/m%C3%B6bler/s%C3%A4ngar/kontinentals%C3%A4ngar/divine-kontinentals%C3%A4ng-120x200-m%C3%B6rkgr%C3%A5-fler-val-p1355168-v798087'

    const dummyRequest = {
        url: targetUrl,
        userData: {
            url: targetUrl,
            popularityIndex: 1,
            name: "Divine Kontinentalsäng",
            label: "DETAIL"
        }
    }
    await scrapeDetails([dummyRequest], true)
}

await debugMain()