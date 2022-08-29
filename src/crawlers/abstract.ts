import {createPlaywrightRouter, Dataset, log, PlaywrightCrawlingContext, RequestOptions, RouterHandler} from "crawlee";
import {ElementHandle, Page} from "playwright";
import {BrowserCrawlerEnqueueLinksOptions} from "@crawlee/browser/internals/browser-crawler";


export interface CrawlerDefinitionOptions {
    /**
     * Keeps the detailed data about products, the one extracted from a product page
     */
    detailsDataset: Dataset

    /**
     * Keeps shallow data about products, extracted form product listings (ex: category pages)
     */
    listingDataset: Dataset

    /**
     * Selector for the urls of individual product pages
     */
    detailsUrlSelector: string

    /**
     * Selector for next pages within the product listing / category
     */
    listingUrlSelector: string

    /**
     * Selector for individual product cards to be scraped for information available as part of the listings
     */
    productCardSelector: string
}

interface ScrollerArgs {
    currentScroll: number

    /**
     * Fields passed to the scroller function from the general parameters described above
     */
    detailsUrlSelector: string
    productCardSelector: string
}

/**
 * General definition of what we need to do to create a new custom implementation for a given website.
 *
 * It defines the way in which both listing and individual pages should be scraped to gain information.
 */
export abstract class AbstractCrawlerDefinition {
    private readonly _router: RouterHandler<PlaywrightCrawlingContext>
    private readonly detailsDataset: Dataset
    private readonly listingDataset: Dataset

    private readonly detailsUrlSelector: string
    private readonly listingUrlSelector: string
    private readonly productCardSelector: string

    protected constructor(options: CrawlerDefinitionOptions) {
        this._router = createPlaywrightRouter()
        const crawlerDefinition = this
        this._router.addHandler("DETAIL", async (ctx: PlaywrightCrawlingContext) =>
            await crawlerDefinition.crawlDetailPage(ctx))
        this._router.addHandler("LIST", async (ctx: PlaywrightCrawlingContext) =>
            await crawlerDefinition.crawlListPage(ctx))

        this.detailsDataset = options.detailsDataset
        this.listingDataset = options.listingDataset

        this.detailsUrlSelector = options.detailsUrlSelector
        this.listingUrlSelector = options.listingUrlSelector
        this.productCardSelector = options.productCardSelector
    }

    /**
     * Get details about an individual product by looking at the product page
     *
     * This method also saves to a crawlee `Dataset`. In the future it has to save to an external storage like firestore
     * @param ctx
     */
    async crawlDetailPage(ctx: PlaywrightCrawlingContext): Promise<void> {
        const productDetails = await this.extractProductDetails(ctx.page)

        await this.detailsDataset.pushData(productDetails)
    }

    /**
     * Abstract method for creating a `ProductInfo` object by scraping an individual product (DETAIL) page.
     *
     * This method has to be implemented for each of the sources we want to scrape
     * @param page
     */
    abstract extractProductDetails(page: Page): Promise<ProductInfo>;

    /**
     * Entry point for the listing pages logic.
     *
     * We scroll to the bottom of the page and progressively add identified products. This way we address the issue of
     * lazy loading web pages and various recycle views that could prevent us for getting a full picture of the products
     * in the listing by only looking at one window of the page.
     *
     * @param ctx
     */
    async crawlListPage(ctx: PlaywrightCrawlingContext): Promise<void> {
        await this.scrollAndCollect(ctx)

        await ctx.enqueueLinks({
            selector: this.listingUrlSelector,
            label: "LIST"
        })
    }

    /**
     * Scrolls through the page and iteratively collects products. For details see:
     * {@apilink AbstractCrawlerDefinition.crawlListPage}
     *
     * @param ctx
     */
    async scrollAndCollect(ctx: PlaywrightCrawlingContext) {
        log.info('Enter scrolling function')
        const page = ctx.page
        const enqueueLinks = ctx.enqueueLinks

        const productInfos = new Map<string, ProductInfo>()

        /**
         * Exposes the `enqueueLinks` method to be used inside the browser context while scrolling.
         *
         * Adds a special parameter `desiredUrl` that indicates that we are only interested in one particular URL.
         * It is used for the case where we want to enqueue the URL of a specific product while adding the other
         * information we hold on that product specifically.
         */
        await page.exposeFunction('enqueueLinks',
            async (options?: BrowserCrawlerEnqueueLinksOptions, desiredUrl?: string) => {
            if (desiredUrl) {
                if (desiredUrl.startsWith("/")) {
                    const currentUrl = new URL(page.url())

                    desiredUrl = `${currentUrl.protocol}//${currentUrl.host}${desiredUrl}`
                }

                options = {
                    ...options,
                    transformRequestFunction: (original: RequestOptions) => {
                        if (original.url !== desiredUrl) {
                            return false
                        }

                        return original
                    }
                }
            }

            return await enqueueLinks(options)
        })

        /**
         * Exposes a callback that announces a product card has been scraped and is ready to be registered
         *
         * This method also assigns the `popularityIndex` property to products. The idea is that a product arrives here
         * in the order it is found while scraping the listing page, so its popularity index is the number of products
         * we have already registered in the map before its arrival
         */
        await page.exposeFunction('parsedProductCardCallback', async (url: string, product: Object) => {
            if (productInfos.has(url)) {
                return productInfos.get(url)!.popularityIndex;
            }

            const convertedProduct = <ProductInfo> product
            convertedProduct.popularityIndex = productInfos.size
            productInfos.set(url, convertedProduct)
            return convertedProduct.popularityIndex
        })

        /**
         * Exposes the method for scraping and individual product card from a listing. This is method is exported to
         * the browser context, so it can be called while we scroll through the page. Calling the method switches the
         * context back to the normal process of executing Playwright, thus the element that was passed as a
         * `HTMLElement` becomes an `ElementHandle`.
         *
         * `ElementHandle` is deprecated in the favor of `Locator` objects, but there is no way of passing a
         * `HTMLElement` from the browser to transform it to a `Locator`.
         * I submitted an issue about that here: https://github.com/microsoft/playwright/issues/16895
         */
        await page.exposeBinding('extractCardProductInfo',
            async (_source, a: ElementHandle) => {
                try {
                    const url = _source.page.url()

                    return await this.extractCardProductInfo(url, a)
                } catch (error: unknown) {
                    if (typeof error === "string") {
                        log.error(error)
                    } else if (error instanceof Error) {
                        log.error(error.message)
                    }
                    return null
                }
            },
            {
                handle: true
            })
        await this.scrollToBottom(page)

        await this.listingDataset.pushData(Array.from(productInfos.values()))
    }

    /**
     * Performs one sweep through the page towards the bottom.
     *
     * This method should be overrided for infinite scroll sources such as homeroom
     * @param page
     */
    async scrollToBottom(page: Page) {
        const currentScroll = await page.evaluate(async() => {
            return window.scrollY + window.innerHeight
        })
        const productCardSelector = this.productCardSelector
        const detailsUrlSelector = this.detailsUrlSelector
        await page.evaluate(this.scrollToBottom__BrowserFunction, {
            currentScroll, detailsUrlSelector, productCardSelector
        });
    }

    /**
     * Does the actual scrolling on the page. This method is executed in the context of the browser, thus elements
     * like `document` and `window` are available, but details about the implementation of this class are not directly
     * accessible.
     */
    async scrollToBottom__BrowserFunction(data: ScrollerArgs) {
        for (let i = data.currentScroll; i < document.body.scrollHeight; i += 400) {
            console.log("Scrolling to " + i)
            window.scrollTo(0, i);

            await new Promise(f => setTimeout(f, 5))

            const articleIterator = document.evaluate(
                data.productCardSelector,
                document,
                null,
                XPathResult.ORDERED_NODE_ITERATOR_TYPE)

            /**
             * We take all the cards from the iterator and convert them to a list because the iterator is prone to error
             * in the cases where the html page is modified somehow while processing the cards.
             */
            const productCardList = []
            while(true) {
                const productCard = articleIterator.iterateNext()
                if (!productCard) {
                    break
                }

                productCardList.push(productCard)
            }

            for (const productCard of productCardList) {
                const currentProductInfo = await window.extractCardProductInfo(<HTMLElement>productCard)
                currentProductInfo.popularityIndex = await window.parsedProductCardCallback(
                    currentProductInfo.url, currentProductInfo)

                /**
                 * Here we pass the current url as `desiredUrl` because we also pass the full product info as userData.
                 * We only want that URL to be associated with this info.
                 */
                await window.enqueueLinks({
                    selector: data.detailsUrlSelector,
                    label: 'DETAIL',
                    userData: currentProductInfo,
                }, currentProductInfo.url)
            }
        }
        // Scroll slightly up. This is needed to avoid the view staying at the bottom after new elements are loaded
        // for infinite scroll pages
        window.scrollTo(0, document.body.scrollHeight - (window.innerHeight + 100))
    }

    /**
     * Extracts the information about a product from a product card.
     *
     * It is specific to each source, and should be implemented in a specific class.
     *
     * @param categoryUrl
     * @param productCard
     */
    abstract extractCardProductInfo(categoryUrl: string, productCard: ElementHandle): Promise<ProductInfo>

    get router(): RouterHandler<PlaywrightCrawlingContext> {
        return this._router
    }
}
