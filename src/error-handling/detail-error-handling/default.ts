import { DetailErrorHandler } from "./interface.js";
import { log, PlaywrightCrawlingContext } from "crawlee";
import {
  GotBlockedError,
  IllFormattedPageError,
  PageNotFoundError,
} from "../../types/errors.js";

export class DefaultDetailErrorHandler implements DetailErrorHandler {
  handleCrawlDetailPageError(error: any, ctx: PlaywrightCrawlingContext) {
    if (
      error instanceof IllFormattedPageError ||
      error instanceof PageNotFoundError
    ) {
      log.info(`Known error encountered`, {
        url: ctx.page.url(),
        requestUrl: ctx.request.url,
        errorType: error.name,
        errorMessage: error.message,
      });
      throw error;
    }
    if (error instanceof GotBlockedError) {
      log.error(`Got blocked`, {
        url: ctx.page.url(),
        requestUrl: ctx.request.url,
        errorType: error.name,
        errorMessage: error.message,
      });
      throw error;
    }
    // Unknown error, throw it
    throw error;
  }
}
