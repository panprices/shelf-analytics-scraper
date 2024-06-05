import { DefaultDetailErrorHandler } from "./default";
import { PlaywrightCrawlingContext } from "crawlee";
import {
  CaptchaEncounteredError,
  GotBlockedError,
  PageNotFoundError,
} from "../../types/errors";

export class WayfairDetailErrorHandler extends DefaultDetailErrorHandler {
  override async assertCorrectProductPage(ctx: PlaywrightCrawlingContext) {
    const page = ctx.page;
    const url = page.url();
    const responseStatus = ctx.response?.status();

    if (url.includes("https://www.wayfair.de/blocked.php")) {
      throw new GotBlockedError("Got blocked");
    }
    if (
      url.includes("https://www.wayfair.de/v/captcha") ||
      (await page.locator("iframe[title='reCAPTCHA']").count()) > 0 ||
      (await page.locator("div[class='px-captcha-error-container']").count()) >
        0 ||
      responseStatus == 429
    ) {
      throw new CaptchaEncounteredError("Captcha encountered");
    }
    if (url === "https://www.wayfair.de" || url === "https://www.wayfair.de/") {
      throw new PageNotFoundError("Redirected to homepage");
    }
    if (!url.includes("/pdp/")) {
      throw new PageNotFoundError("Redirected to another page");
    }
  }
}
