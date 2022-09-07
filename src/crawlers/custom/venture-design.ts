import {AbstractCrawlerDefinition} from "../abstract";
import {Locator, Page} from "playwright";
import {DetailedProductInfo, ListingProductInfo} from "../../types/offer";
import {PlaywrightCrawlingContext} from "crawlee";

export class VentureDesignCrawlerDefinition extends AbstractCrawlerDefinition {
    override async crawlListPage(ctx: PlaywrightCrawlingContext): Promise<void> {
        await ctx.page.locator(this.productCardSelector).nth(0).waitFor()

        return super.crawlListPage(ctx);
    }

    /**
     * Pagination for venture design is implemented with events in SPA (Single Page Framework) so we can't collect the
     * urls to the next pages.
     *
     * Instead, we overwrite the scrolling function to click the button for the next page when we reach the bottom
     * @param ctx
     */
    override async scrollToBottom(ctx: PlaywrightCrawlingContext): Promise<void> {
        const page = ctx.page
        let scrolled = false
        do {
            await super.scrollToBottom(ctx);

            await page.locator("//ul[@class = 'pagination']/li[last()]").click()

            await new Promise(f => setTimeout(f, 1000))

            // Every time there is a next page, the scroll goes back to the top
            // At the last page even though the button is active nothing happens (the page stays scrolled)
            scrolled = await page.evaluate(() => window.scrollY != 0)
        } while(!scrolled)  // if we are not scrolled, it means we are back to the top of the page (new page)
    }

    async extractCardProductInfo(categoryUrl: string, productCard: Locator): Promise<ListingProductInfo> {
        const price = 0
        const currency = "unavailable"

        const name = <string>await this.extractProperty(productCard, "h4", node => node.textContent())
        const previewImageUrl  = <string>await this.extractProperty(
            productCard,
            "xpath=(.//img)[1]",
            node => node.getAttribute("src"))
        const url = <string>await this.extractProperty(
            productCard,
            "xpath=(.//a)[1]",
            node => node.getAttribute("href")
        )
        return {
            name, categoryUrl, price, currency, popularityIndex: -1, previewImageUrl, url, isDiscounted: false
        };
    }

    async extractImagesNoScrollSlider(page: Page): Promise<string[]> {
        const slideLocator = page.locator(".slide")
        await slideLocator.nth(0).waitFor()

        const images = []
        const slideCount = await slideLocator.count()

        const fullImageUrl = <string>await this.extractProperty(page,
            "div.article-detail-image >> div.v-thumb >> img",
            node => node.getAttribute("src"))
        images.push(fullImageUrl)

        for (let i = 1; i < slideCount; i++) {
            await slideLocator.nth(i).click()

            const fullImageUrl = <string>await this.extractProperty(page,
                "div.article-detail-image >> div.v-thumb >> img",
                node => node.getAttribute("src"))
            images.push(fullImageUrl)
        }

        return images
    }

    async extractImagesWithInfiniteScrollSlider(page: Page): Promise<string[]> {
        const previewImageSet = new Set<string>()
        const sliderLocator = page.locator(
            "//div[contains(@class, 'article-detail-image')]//div[contains(@class, 'slick-active')]//img")
        await sliderLocator.nth(0).waitFor()

        const images = []
        while (true) {
            let allPicturesSeen = true
            const visiblePicturesCount = await sliderLocator.count()
            for (let i = 0; i < visiblePicturesCount; i++) {
                const currentImageLocator = sliderLocator.nth(i)
                const identifier = <string>await currentImageLocator.getAttribute("src")
                if (previewImageSet.has(identifier)) {
                    continue
                }

                allPicturesSeen = false
                previewImageSet.add(identifier)

                await currentImageLocator.locator("xpath=..").click()
                // await new Promise(f => setTimeout(f, 500))

                const fullImageUrl = <string>await this.extractProperty(page,
                    "div.article-detail-image >> div.v-thumb >> img",
                    node => node.getAttribute("src"))
                images.push(fullImageUrl)
            }

            if (allPicturesSeen) {
                break
            }

            const arrowSelector = page.locator("div.article-detail-image >> button.slick-next")
            await arrowSelector.click()
        }
        return images
    }

    async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
        const noScrollSliderLocator = page.locator(".v-no-slide")
        const useInfiniteScrollStrategy = !await noScrollSliderLocator.isVisible()

        const images = useInfiniteScrollStrategy ?
            await this.extractImagesWithInfiniteScrollSlider(page):
            await this.extractImagesNoScrollSlider(page)
        const description = <string>await this.extractProperty(page,
            "//div[contains(@class, 'container') " +
            "and contains(./div[contains(@class, 'label')]/text(), 'BESKRIVNING')]/div[contains(@class, 'content')]",
            node => node.textContent())
        const breadcrumbLocator = page.locator("div.breadcrumb-container >> a")
        const categoryTree = await this.extractCategoryTree(breadcrumbLocator, 1)
        const name = <string> await this.extractProperty(page,
            "//div[contains(@class, 'article-detail-text')]//h1[1]",
            node => node.textContent().then(s => s!.trim()))

        const specifications = page.locator(
            "//div[contains(@class, 'container') " +
            "and contains(./div[contains(@class, 'label')]/text(), 'MER INFORMATION')]/div[contains(@class, 'content')]//tr")
        const specificationsCount = await specifications.count()
        const specArray = []
        for (let i = 0; i < specificationsCount; i++) {
            const specLocator = specifications.nth(i)
            const specKey = <string>await specLocator.locator("xpath=.//td[1]").textContent()
            const specValue = <string>await specLocator.locator("xpath=.//td[2]").textContent()

            specArray.push({
                key: specKey,
                value: specValue
            })
        }

        const gtin = await this.extractProperty(page,
            "//div[./h6/text() = 'GTIN:']/span",
            node => node.textContent().then(s => s!.trim()))

        const articleNumber = await this.extractProperty(page,
            "//div[./h6/text() = 'Artikelnr:']/span",
            node => node.textContent().then(s => s!.trim()))

        return {
            images,
            url: page.url(),
            price: 0,
            currency: "unknown",
            isDiscounted: false,
            description,
            inStock: false,
            reviews: "unavailable",
            specifications: specArray,
            categoryTree,
            name,
            gtin,
            articleNumber
        }
    }

    override async crawlIntermediateCategoryPage(ctx: PlaywrightCrawlingContext): Promise<void> {
        await ctx.page.locator("//div[@class = 'subcategories']/a").nth(0).waitFor()
        await ctx.enqueueLinks({
            selector: "//div[@class = 'subcategories']/a",
            label: "LIST"
        })
    }

    static async create(): Promise<VentureDesignCrawlerDefinition> {
        const [detailsDataset, listingDataset] = await AbstractCrawlerDefinition.openDatasets()
        return new VentureDesignCrawlerDefinition({
            detailsDataset, listingDataset,
            detailsUrlSelector: "article.article >> a",
            productCardSelector: "article.article"
        })
    }
}