import { DetailErrorHandler } from "./interface";
import { PlaywrightCrawlingContext } from "crawlee";
import { isProductPage } from "../../crawlers/custom/base-chill";
import { PageNotFoundError } from "../../types/errors";

export class TrademaxDetailErrorHandler implements DetailErrorHandler {
  async assertCorrectProductPage(ctx: PlaywrightCrawlingContext) {
    if (!isProductPage(ctx.page.url())) {
      throw new PageNotFoundError("Url is not a product page url");
    }
  }

  handleCrawlDetailPageError(
    _error: any,
    _ctx: PlaywrightCrawlingContext
  ): void {
    // Do nothing, the error thrown here is handled in the default handler
  }
}
