import {
  InfiniteScrollOptions,
  PlaywrightCrawlingContext,
  playwrightUtils,
} from "crawlee";

/**
 * Using crawlee's new utils function instead of our custon one.
 */

export interface ScrollToBottomStrategy {
  (
    ctx: PlaywrightCrawlingContext,
    registerProductCards: (ctx: PlaywrightCrawlingContext) => Promise<void>,
    registerAfterEachScroll?: boolean
  ): Promise<void>;
}

export const scrollToBottomV1: ScrollToBottomStrategy = async function (
  ctx: PlaywrightCrawlingContext,
  registerProductCards: (ctx: PlaywrightCrawlingContext) => Promise<void>,
  registerAfterEachScroll?: boolean
): Promise<void> {
  const page = ctx.page;

  const startY = await page.evaluate(async () => {
    return window.scrollY + window.innerHeight;
  });

  const scrollHeight = await page.evaluate(() => document.body.scrollHeight);

  for (
    let currentScrollY = startY;
    currentScrollY < scrollHeight;
    currentScrollY += 500
  ) {
    if (registerAfterEachScroll) {
      await registerProductCards(ctx);
    }
    await page.evaluate(
      (scrollPosition: number) => window.scrollTo(0, scrollPosition),
      currentScrollY
    );
    await new Promise((f) => setTimeout(f, 200));
  }

  // Scroll slightly up. This is needed to avoid the view staying at the bottom after new elements are loaded
  // for infinite scroll pages
  await page.evaluate(() =>
    window.scrollTo(0, document.body.scrollHeight - (window.innerHeight + 100))
  );
};

export const scrollToBottomV2: ScrollToBottomStrategy = async function (
  ctx: PlaywrightCrawlingContext,
  registerProductCards: (ctx: PlaywrightCrawlingContext) => Promise<void>,
  registerAfterEachScroll?: boolean
) {
  const scrollOptions: InfiniteScrollOptions = {
    scrollDownAndUp: true,
  };

  if (registerAfterEachScroll) {
    scrollOptions.stopScrollCallback = async () => {
      await registerProductCards(ctx);
      return false;
    };
  }

  await playwrightUtils.infiniteScroll(ctx.page, scrollOptions);
  await registerProductCards(ctx);
};
