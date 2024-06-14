import { DetailErrorAssertion } from "./interface";
import { PlaywrightCrawlingContext } from "crawlee";
import { isProductPage } from "../../crawlers/custom/base-chill";
import { PageNotFoundError } from "../../types/errors";

export class TrademaxErrorAssertion implements DetailErrorAssertion {
  async assertCorrectProductPage(ctx: PlaywrightCrawlingContext) {
    if (!isProductPage(ctx.page.url())) {
      throw new PageNotFoundError("Url is not a product page url");
    }
  }
}
