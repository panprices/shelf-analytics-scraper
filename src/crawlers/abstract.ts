import {createPlaywrightRouter, Dataset, log, PlaywrightCrawlingContext, RequestOptions, RouterHandler} from "crawlee";
import {ElementHandle, Page} from "playwright";
import {BrowserCrawlerEnqueueLinksOptions} from "@crawlee/browser/internals/browser-crawler";


export interface CrawlerDefinitionOptions {
    detailsDataset: Dataset
    listingDataset: Dataset
    detailsUrlSelector: string
    listingUrlSelector: string
    productCardSelector: string
}

interface ScrollerArgs {
    currentScroll: number
    detailsUrlSelector: string
    productCardSelector: string
}

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

    async crawlDetailPage(ctx: PlaywrightCrawlingContext): Promise<void> {
        const productDetails = await this.extractProductDetails(ctx.page)

        await this.detailsDataset.pushData(productDetails)
    }

    abstract extractProductDetails(page: Page): Promise<ProductInfo>;

    async crawlListPage(ctx: PlaywrightCrawlingContext): Promise<void> {
        await this.scrollAndCollect(ctx)

        await ctx.enqueueLinks({
            selector: this.listingUrlSelector,
            label: "LIST"
        })
    }

    async scrollAndCollect(ctx: PlaywrightCrawlingContext) {
        log.info('Enter scrolling function')
        const page = ctx.page
        const enqueueLinks = ctx.enqueueLinks

        const productInfos = new Map<string, ProductInfo>()
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
        await page.exposeFunction('parsedProductCardCallback', async (url: string, product: Object) => {
            if (productInfos.has(url)) {
                return productInfos.get(url)!.popularityIndex;
            }

            const convertedProduct = <ProductInfo> product
            convertedProduct.popularityIndex = productInfos.size
            productInfos.set(url, convertedProduct)
            return convertedProduct.popularityIndex
        })
        await page.exposeBinding('extractCardProductInfo',
            async (_source, a: ElementHandle) => {
                try {
                    const url = _source.page.url()

                    return await this.extractCardProductInfo__BrowserFunction(url, a)
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

    abstract extractCardProductInfo__BrowserFunction(categoryUrl: string, productCard: ElementHandle): Promise<ProductInfo>

    get router(): RouterHandler<PlaywrightCrawlingContext> {
        return this._router
    }
}
