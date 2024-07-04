import { PlaywrightCrawlingContext } from "crawlee";

/**
 * We allow handling different types of errors by using a strategy pattern:
 * https://refactoring.guru/design-patterns/strategy
 *
 * This issue came up when Furniture1 enabled Cloudflare protection on their website,
 * making it the 2nd retailer for which we implement captcha / anti-bot protection logic.
 * So the same logic needs to be implemented by 2 retailers classes: Furniture1 and Wayfair.
 *
 * Instead of duplicating the code we create an antibot error handling strategy and we pass that to the
 * retailers that need this logic.
 *
 * Alternatives (and why we chose not to go in those directions):
 * - add the captcha logic in the abstract class: this means that the abstract class know about stuff
 * that is not really generic (code smell). Moreover, this is not scalable, and makes the abstract class
 * more difficult to read
 * - create another abstract class that will serve as common parent for anti-bot protected retailers: does
 * not work because some retailers will inherit from `AbstractCrawlerDefinition` (Furniture1) while others
 * inherit from `AbstractCrawlerDefinitionWithVariants` (Wayfair)
 */
export interface DetailErrorHandler {
  handleCrawlDetailPageError(error: any, ctx: PlaywrightCrawlingContext): void;
}
