import {
  CheerioCrawlingContext,
  CrawlingContext,
  createCheerioRouter,
  createPlaywrightRouter,
  Dataset,
  log,
  PlaywrightCrawlingContext,
  PlaywrightCrawler,
  Router,
  RouterHandler,
  ProxyConfiguration,
} from "crawlee";
import { Locator, Page } from "playwright";

import { proxyConfiguration } from "../src/crawlers/factory";

const ips = [
  "103.69.158.128",
  "103.69.158.130",
  "103.69.158.131",
  "103.69.158.132",
  "103.69.158.133",
  "103.69.158.135",
  "103.69.158.136",
  "103.69.158.137",
  "103.69.158.141",
  "103.69.158.143",
  "103.69.158.145",
  "103.69.158.146",
  "103.69.158.147",
  "103.69.158.148",
  "103.69.158.150",
  "103.69.158.151",
  "103.69.158.152",
  "103.69.158.156",
  "103.69.158.158",
  "103.69.158.160",
  "103.69.158.161",
  "103.69.158.162",
  "103.69.158.163",
  "103.69.158.165",
  "103.69.158.166",
  "103.69.158.167",
  "103.69.158.168",
  "103.69.158.171",
  "103.69.158.173",
  "103.69.158.175",
  "103.69.158.176",
  "103.69.158.177",
  "103.69.158.178",
  "103.69.158.180",
  "103.69.158.181",
  "103.69.158.182",
  "103.69.158.183",
  "103.69.158.186",
  "103.69.158.188",
  "103.69.158.190",
  "103.69.158.192",
  "103.69.158.195",
  "103.69.158.196",
  "103.69.158.197",
  "103.69.158.198",
  "103.69.158.200",
  "103.69.158.201",
  "103.69.158.203",
  "103.69.158.205",
  "103.69.158.207",
];
const proxyKeepingSession = new ProxyConfiguration({
  proxyUrls: ips.map((ip) => `http://${process.env.PROXY_USERNAME}:${process.env.PROXY_PASSWORD}@${ip}:60000`),
});

const crawler = new PlaywrightCrawler({
  async requestHandler({ page }) {
    // This function is called to extract data from a single web page
    // 'page' is an instance of Playwright.Page with page.goto(request.url) already called
    // 'request' is an instance of Request class with information about the page to load
    console.log(await page.textContent("body"));
  },
  proxyConfiguration: proxyConfiguration["SE"],
  // proxyConfiguration: proxyKeepingSession,
});

const check = async () => {
  console.log("First scraper run");
  await crawler.run([
    "https://api.ipify.org/",
    "https://api.ipify.org/?format=json",
  ]);

  console.log("Second scraper run");
  await crawler.run([
    "https://api64.ipify.org/",
    "https://api64.ipify.org/?format=json",
  ]);
};

// Main
await check();
