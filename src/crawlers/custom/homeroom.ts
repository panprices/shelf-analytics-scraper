import {Locator, Page} from "playwright";
import {Dataset, log, PlaywrightCrawlingContext} from "crawlee";
import {AbstractCrawlerDefinition} from "../abstract.js";

export class HomeroomCrawlerDefinition extends AbstractCrawlerDefinition {
    async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
        const productName = (<string>await page.locator("h1.product-title").textContent()).trim()

        const metadata: OfferMetadata = {}
        const breadcrumbLocator = page.locator("ul.breadcrumbs > li > a")
        const breadcrumbCount = await breadcrumbLocator.count()
        const categoryTree = []
        for (let i = 0; i < breadcrumbCount; i++) {
            const name = (<string>await breadcrumbLocator.nth(i).textContent()).trim()
            const url = <string>await breadcrumbLocator.nth(i).getAttribute("href")

            categoryTree.push({
                name, url
            })
        }

        const priceString = (<string>await page.locator("div.price > p").first().textContent()).trim()
        const price = Number(priceString.split("\n")[0].replace(/\s/g, ''))
        const currency = priceString.split("\n")[1].trim()
        const isDiscounted = (await page.locator("p.original-price").count()) > 0
        if (isDiscounted) {
            metadata.originalPrice = Number((<string>await page.locator("p.original-price").textContent()).replace(/\s/g, ''))
        }

        const imagesSelector = page.locator("//li[contains(@class, 'product-gallery-item')]//source[1]")
        const imageCount = await imagesSelector.count()
        const images = []
        for (let i = 0; i < imageCount; i++) {
            const sourceTag = imagesSelector.nth(i)
            const srcset = <string>await sourceTag.getAttribute("srcset")
            const imageUrl = srcset.split(",")[0].split(' ')[0]

            images.push(imageUrl)
        }

        const description = <string>await page.locator("//div[contains(@class, 'long-description')]//p/span[1]").textContent()
        const brand = await this.extractProperty(page,
            "//h2[contains(@class, 'long-description-title')]/a[2]",
            node => node.textContent())
        const schemaOrgString = <string>await page.locator(
            "//script[@type='application/ld+json' and contains(text(), 'schema.org')]"
        ).textContent()
        const schemaOrg: SchemaOrg = JSON.parse(schemaOrgString)
        const sku = schemaOrg.sku
        metadata.schemaOrg = schemaOrg

        const specifications = await page.locator("//div[contains(@class, 'infos')]")
        const specificationsCount = await specifications.count()
        const specArray = []
        for (let i = 0; i < specificationsCount; i++) {
            const spec = <string> await specifications.nth(i).textContent()

            specArray.push({
                key: spec.split('\n')[0],
                value: spec.split('\n')[1]
            })
        }

        return {
            name: productName, price, currency, images, description, categoryTree, sku, metadata,
            specifications: specArray, brand, isDiscounted, url: page.url(), popularityIndex: -1,
            reviews: "unavailable"
        }
    }

    async extractCardProductInfo(categoryUrl: string, productCard: Locator): Promise<ListingProductInfo>  {
        const brand = await this.extractProperty(productCard,"..//b[contains(@class, 'brand')]",
                node => node.textContent())
        const name = <string>await this.extractProperty(productCard,"..//span[contains(@class, 'name')]",
                node => node.textContent())
        const priceString = <string>await this.extractProperty(productCard, "..//span[contains(@class, 'price-point')]",
                node => node.textContent())
        const originalPriceString = await this.extractProperty(productCard, "..//s[contains(./span/@class, 'currency')]",
                node => node.textContent())
        const imageUrl = await this.extractProperty(productCard, "xpath=(..//picture/source)[1]", this.extractImageFromSrcSet)
        const sku = await this.extractProperty(productCard, "button",
                node => node.getAttribute("data-sku"))
        const url = <string> await this.extractProperty(productCard, "xpath=./a[1]", node => node.getAttribute("href"))

        const currentProductInfo: ListingProductInfo = {
            brand, name, url, previewImageUrl: <string> imageUrl, sku,
            popularityIndex: -1,
            isDiscounted: originalPriceString !== null,
            price: Number(priceString.trim().split('\n')[0].replace(/\s/g, '')),
            currency: priceString.trim().split('\n')[1].trim(),
            categoryUrl
        }
        if (originalPriceString) {
            currentProductInfo.originalPrice = Number(
                originalPriceString.trim().split("\n")[0].replace(/\s/g, '')
            )
        }

        return currentProductInfo
    }

    static async create(): Promise<HomeroomCrawlerDefinition> {
        const detailsDataset = await Dataset.open("__CRAWLEE_TEMPORARY_detailsDataset")
        const listingDataset = await Dataset.open("__CRAWLEE_TEMPORARY_listingDataset")

        return new HomeroomCrawlerDefinition({
            detailsDataset, listingDataset,
            listingUrlSelector: "//div[contains(text(), 'Impossible to match selector, no pagination')]",
            detailsUrlSelector: "//article[contains(@class, 'product-card')]//a",
            productCardSelector: "//article[contains(@class, 'product-card')]",
            cookieConsentSelector: 'a.cta-ok'
        })
    }

    override async scrollToBottom(ctx: PlaywrightCrawlingContext): Promise<void> {
        const page = ctx.page

        let buttonVisible = false
        do {
            await super.scrollToBottom(ctx);

            // wait for consistency
            await new Promise(f => setTimeout(f, 100))
            const loadMoreButton = page.locator('div.load-more-button')

            log.info(`Button: ${loadMoreButton}`)
            await this.handleCookieConsent(page)
            buttonVisible = await loadMoreButton.isVisible()
            if (!buttonVisible) {
                break
            }

            const pageHeight = await page.evaluate(async () => document.body.offsetHeight)
            await loadMoreButton.click()
            let pageExpanded = false
            do {
                log.info("Waiting for button click to take effect")
                await new Promise(f => setTimeout(f, 1500))

                const newPageHeight = await page.evaluate(async() => document.body.offsetHeight)
                pageExpanded = newPageHeight > pageHeight
            } while (!pageExpanded)
        } while(true)
    }
}