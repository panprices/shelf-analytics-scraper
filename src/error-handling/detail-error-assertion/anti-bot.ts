import { DetailErrorAssertion } from "./interface.js";
import { PlaywrightCrawlingContext } from "crawlee";
import { CaptchaEncounteredError } from "../../types/errors.js";

export class AntiBotErrorAssertion implements DetailErrorAssertion {
  async assertCorrectProductPage(ctx: PlaywrightCrawlingContext) {
    const responseStatus = ctx.response?.status();

    /**
     * The status message for "429" is "Too many requests"
     *
     * Both PerimeterX (Wayfair) and Cloudflare (Furniture1) seem to use that when they are
     * throwing captchas instead of returning the result.
     */
    if (responseStatus == 429) {
      throw new CaptchaEncounteredError("Captcha encountered");
    }
  }
}
