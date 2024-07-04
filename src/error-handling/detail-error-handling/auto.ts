import { DetailErrorHandler } from "./interface";
import { log, PlaywrightCrawlingContext } from "crawlee";
import { PriceLiteUnavailableError } from "../../types/errors";

export class AutoCrawlerErrorHandler implements DetailErrorHandler {
  handleCrawlDetailPageError(error: any, ctx: PlaywrightCrawlingContext): void {
    if (error instanceof PriceLiteUnavailableError) {
      log.error(`Price lite`, {
        url: ctx.page.url(),
        requestUrl: ctx.request.url,
        errorType: error.name,
        errorMessage: error.message,
      });
      return;
    }

    throw error;
  }
}
