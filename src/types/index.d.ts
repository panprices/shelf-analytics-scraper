import {BrowserCrawlerEnqueueLinksOptions, EnqueueLinksOptions} from "crawlee";

export {};

declare global {
  interface Window {
    enqueueLinks: (options?: (BrowserCrawlerEnqueueLinksOptions | undefined), desiredUrl?: string) => Promise<any>
    /**
     * Announces that a product card was found. Expects a ranking of the product card (a popularity index).
     * @param productUrl
     * @param productInfo
     */
    parsedProductCardCallback: (productUrl: string, productInfo: Object) => Promise<number>
    extractCardProductInfo: (productCard: HTMLElement) => Promise<ProductInfo>
  }
}
