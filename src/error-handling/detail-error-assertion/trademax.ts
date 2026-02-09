import { DetailErrorAssertion } from "./interface.js";
import { PlaywrightCrawlingContext } from "crawlee";
import { isProductPage } from "../../crawlers/custom/base-chill.js";
import { PageNotFoundError } from "../../types/errors.js";

export class TrademaxErrorAssertion implements DetailErrorAssertion {
  async assertCorrectProductPage(ctx: PlaywrightCrawlingContext) {
    if (!isProductPage(ctx.page.url())) {
      throw new PageNotFoundError("Url is not a product page url");
    }
  }
}
