import { PlaywrightCrawlingContext } from "crawlee";

/**
 * See `DetailErrorHandling` for the detailed explanation of this structural decision
 */
export interface DetailErrorAssertion {
  assertCorrectProductPage(ctx: PlaywrightCrawlingContext): Promise<void>;
}
