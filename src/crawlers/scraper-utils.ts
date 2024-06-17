import {
  Dictionary,
  InfiniteScrollOptions,
  PlaywrightCrawlingContext,
  playwrightUtils,
} from "crawlee";
import { Locator } from "playwright";
import { hexToRgb } from "../utils";

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
    await page.waitForTimeout(50);
  }

  // Scroll slightly up. This is needed to avoid the view staying at the bottom after new elements are loaded
  // for infinite scroll pages
  await page.evaluate(() =>
    window.scrollTo(0, document.body.scrollHeight - (window.innerHeight + 100))
  );
};

/**
 * Using crawlee's new utils function to automatically handle infinite scroll.
 *
 * IMPORTANT: Make sure to not set `registerAfterEachScroll = true` when not
 * needed. It doesn't work well when we have 1000+ products on the page and the
 * callback takes too long.
 */
export const scrollToBottomV2 = async function (
  ctx: PlaywrightCrawlingContext,
  registerProductCards: (ctx: PlaywrightCrawlingContext) => Promise<void>,
  registerAfterEachScroll?: boolean,
  buttonSelector?: string
) {
  const scrollOptions: InfiniteScrollOptions = {
    scrollDownAndUp: true,
    buttonSelector: buttonSelector,
    stopScrollCallback: async () => {
      // Scroll up a bit more to make sure we get all the products.
      // Some pages have really long footer.
      await ctx.page.mouse.wheel(0, -2000);
      await ctx.page.waitForTimeout(500);

      if (registerAfterEachScroll) {
        await registerProductCards(ctx);
      }

      return false;
    },
  };

  await playwrightUtils.infiniteScroll(ctx.page, scrollOptions);
  await registerProductCards(ctx);
};

/**
 * Finds an element by the computed styles.
 * @param rootLocator
 * @param cssProperties
 * @param elementType
 */
export async function findElementByCSSProperties(
  rootLocator: Locator,
  cssProperties: Dictionary<string>,
  elementType: string = "*"
): Promise<Locator | undefined> {
  const elementCSSSelector = await rootLocator.evaluate(
    (
      rootElement: HTMLElement,
      {
        cssProperties,
        elementType,
      }: { cssProperties: Dictionary<string>; elementType: string }
    ) => {
      const elements = rootElement.querySelectorAll(elementType);
      const potentialResult = Array.from(elements).filter((element) => {
        const style = window.getComputedStyle(element);
        for (const [property, value] of Object.entries(cssProperties)) {
          const computedValue =
            property.toLowerCase().endsWith("color") && value.startsWith("#")
              ? hexToRgb(value)
              : value;

          // @ts-ignore
          if (style[property] !== value) {
            return false;
          }
        }

        return true;
      });

      if (potentialResult.length === 0) {
        return undefined;
      }

      return (
        potentialResult[0].nodeName +
        "." +
        potentialResult[0].className.split(" ").join(".")
      );
    },
    {
      cssProperties,
      elementType,
    }
  );
  if (!elementCSSSelector) {
    return undefined;
  }

  return rootLocator.locator(elementCSSSelector);
}
