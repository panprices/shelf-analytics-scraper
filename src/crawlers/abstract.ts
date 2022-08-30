import {createPlaywrightRouter, Dataset, PlaywrightCrawlingContext, RequestOptions, RouterHandler} from "crawlee";
import {ElementHandle, Locator, Page} from "playwright";


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

    private readonly productInfos: Map<string, ProductInfo>

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
        this.productInfos = new Map<string, ProductInfo>()
    }

    /**
     * Get details about an individual product by looking at the product page
     *
     * This method also saves to a crawlee `Dataset`. In the future it has to save to an external storage like firestore
     * @param ctx
     */
    async crawlDetailPage(ctx: PlaywrightCrawlingContext): Promise<void> {
        const productDetails = await this.extractProductDetails(ctx.page)
        const request = ctx.request

        await this.detailsDataset.pushData({
            ...request.userData,
            ...productDetails
        })
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
        await this.scrollToBottom(ctx)

        await ctx.enqueueLinks({
            selector: this.listingUrlSelector,
            label: "LIST"
        })
    }

    /**
     * This method also assigns the `popularityIndex` property to products. The idea is that a product arrives here
     * in the order it is found while scraping the listing page, so its popularity index is the number of products
     * we have already registered in the map before its arrival
     *
     * @param url
     * @param product
     */
    handleFoundProductFromCard (url: string, product: Object): number {
        if (this.productInfos.has(url)) {
            return <number>this.productInfos.get(url)!.popularityIndex;
        }

        const convertedProduct = <ProductInfo> product
        convertedProduct.popularityIndex = this.productInfos.size
        this.productInfos.set(url, convertedProduct)
        return convertedProduct.popularityIndex
    }

    /**
     * Performs one sweep through the page towards the bottom.
     *
     * This method should be overrided for infinite scroll sources such as homeroom
     * @param ctx
     */
    async scrollToBottom(ctx: PlaywrightCrawlingContext) {
        const page = ctx.page
        const enqueueLinks = ctx.enqueueLinks

        const currentScroll = await page.evaluate(async() => {
            return window.scrollY + window.innerHeight
        })
        const productCardSelector = this.productCardSelector
        const detailsUrlSelector = this.detailsUrlSelector

        const scrollHeight = await page.evaluate(() => document.body.scrollHeight)
        for (let i = currentScroll; i < scrollHeight; i += 400) {
            await page.evaluate((scrollPosition: number) => window.scrollTo(0, scrollPosition), i)
            await new Promise(f => setTimeout(f, 10))

            const articlesLocator = page.locator(productCardSelector)
            const articlesCount = await articlesLocator.count()
            for (let j = 0; j < articlesCount; j++) {
                const currentProductCard = articlesLocator.nth(j)

                const currentProductInfo = await this.extractCardProductInfo(page.url(), currentProductCard)
                if (currentProductInfo.url.startsWith("/")) {
                    const currentUrl = new URL(page.url())

                    currentProductInfo.url = `${currentUrl.protocol}//${currentUrl.host}${currentProductInfo.url}`
                }

                currentProductInfo.popularityIndex = this.handleFoundProductFromCard(
                    currentProductInfo.url, currentProductInfo)

                await enqueueLinks({
                    selector: detailsUrlSelector,
                    label: 'DETAIL',
                    userData: currentProductInfo,
                    transformRequestFunction: (original: RequestOptions) => {
                        if (original.url !== currentProductInfo.url) {
                            return false
                        }

                        return original
                    }
                })
            }
        }

        // Scroll slightly up. This is needed to avoid the view staying at the bottom after new elements are loaded
        // for infinite scroll pages
        await page.evaluate(() =>
            window.scrollTo(0, document.body.scrollHeight - (window.innerHeight + 100)))
    }

    async extractProperty(
        rootElement: Locator,
        path: string,
        extractor: (node: Locator) => Promise<string | null>
    ): Promise<string | null> {
        const tag = await rootElement.locator(path)
        const elementExists = (await tag.count()) > 0
        if (!elementExists) {
            return null
        }

        return tag ? extractor(tag) : null
    }

    async extractImageFromSrcSet(node: Locator): Promise<string | null> {
        const srcset = await node.getAttribute('srcset')
        if (!srcset) {
            return null
        }
        return srcset.split(',')[0].split(' ')[0]
    }

    /**
     * Extracts the information about a product from a product card.
     *
     * It is specific to each source, and should be implemented in a specific class.
     *
     * @param categoryUrl
     * @param productCard
     */
    abstract extractCardProductInfo(categoryUrl: string, productCard: Locator): Promise<ProductInfo>

    get router(): RouterHandler<PlaywrightCrawlingContext> {
        return this._router
    }
}
