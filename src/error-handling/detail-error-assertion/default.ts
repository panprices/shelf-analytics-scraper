import { DetailErrorAssertion } from "./interface.js";
import { PlaywrightCrawlingContext } from "crawlee";
import { PageNotFoundError } from "../../types/errors.js";

export class DefaultErrorAssertion implements DetailErrorAssertion {
  async assertCorrectProductPage(ctx: PlaywrightCrawlingContext) {
    if (ctx.response?.status() === 404) {
      throw new PageNotFoundError("404 Not Found");
    }
  }
}
