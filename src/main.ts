import {log} from "crawlee";
import {exploreCategory} from "./service.js";


async function debugMain() {
    const targetUrl = 'https://www.trademax.se/utem%C3%B6bler/utestolar-tr%C3%A4dg%C3%A5rdsstolar/solstolar/d%C3%A4ckstol'
    await exploreCategory(targetUrl)
}

await debugMain()