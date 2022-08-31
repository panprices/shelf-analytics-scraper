import {AbstractCrawlerDefinition} from "../abstract.js";
import {Locator, Page} from "playwright";
import {Dataset} from "crawlee";

export class TrademaxCrawlerDefinition extends AbstractCrawlerDefinition{
    async extractCardProductInfo(categoryUrl: string, productCard: Locator): Promise<ListingProductInfo> {
        const imageUrl = <string>await this.extractProperty(productCard, "xpath=(..//img)[1]", this.extractImageFromSrcSet)
        const name = <string>await this.extractProperty(productCard, "..//h3[contains(@class, 'ProductCardTitle__global')]",
            node => node.textContent())
        const priceText = <string>await this.extractProperty(productCard, "..//div[@data-cy = 'current-price']",
                node => node.textContent())
        const originalPriceText = await this.extractProperty(productCard, "..//div[@data-cy = 'original-price']",
            node => node.textContent())
        const isDiscounted = originalPriceText !== null
        const url = <string> await this.extractProperty(productCard, "..//a[1]",
                node => node.getAttribute("href"))

        const result: ListingProductInfo = {
            name, previewImageUrl: imageUrl, price: Number(priceText.replace(/\s/g, '')), isDiscounted, url,
            currency: 'SEK', categoryUrl, popularityIndex: -1
        }
        if (isDiscounted) {
            result.originalPrice = Number(originalPriceText?.replace(/\s/g, ''))
        }

        return result
    }

    async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
        await page.waitForSelector("h1[data-cy='product_title']")
        await this.handleCookieConsent(page)

        const product_name = await page
          .locator("h1[data-cy='product_title']")
          .textContent();
        const price_text = await page
          .locator("div#productInfoPrice div[data-cy='current-price']")
          .textContent();
        const price = Number(price_text?.replace(" ", ""));
        const images = await page
          .locator("div#productInfoImage figure img")
          .evaluateAll((list: HTMLElement[]) =>
            list.map((element) => <string>element.getAttribute("src"))
          );
        const breadcrumbLocator = page.locator("//div[@id = 'breadcrumbs']//a")
        const breadcrumbCount = await breadcrumbLocator.count()
        const categoryTree = []
        for (let i = 1; i < breadcrumbCount; i++) {
            const name = (<string>await breadcrumbLocator.nth(i).textContent()).trim()
            const url = <string>await breadcrumbLocator.nth(i).getAttribute("href")

            categoryTree.push({
                name, url
            })
        }

        const brand = await this.extractProperty(page, "//span[contains(strong/text(), ('Varumärke'))]/span/a",
            node => node.textContent())
        const originalPriceString = await this.extractProperty(page,
            "xpath=(//div[contains(@class, 'productInfoContent--buySectionBlock')]//div[@data-cy = 'original-price'])[1]",
            node => node.textContent())

        const specificationsExpander = page.locator(
            "//div[contains(@class, 'accordion--title') and .//span/text() = 'Specifikationer']")
        await specificationsExpander.click()

        const articleNumber = await this.extractProperty(page, "//div[contains(@class, 'articleNumber')]/span",
            node => node.textContent())
        const specifications = specificationsExpander.locator("..//tr")
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

        const descriptionExpander = page.locator(
            "//div[contains(@class, 'accordion--title') and .//span/text() = 'Produktinformation']"
        )
        await descriptionExpander.click()

        const description = <string> await this.extractProperty(descriptionExpander,
            "..//div[contains(@class, 'accordion--content')]",
            node => node.textContent())

        const averageReviewString = await this.extractProperty(page,
            "//div[contains(@class, 'accordionRatingContainer')]/span[1]",
            node => node.textContent())
        const averageReview = Number(averageReviewString)

        const reviewCountString = <string>await this.extractProperty(page,
            "//div[contains(@class, 'accordionRatingContainer')]/span[2]",
            node => node.textContent())
        const reviewCount = Number(reviewCountString.substring(1, reviewCountString.length - 1))

        await page.locator(
            "//div[contains(@class, 'accordion--title') and .//span/text() = 'Recensioner']"
        ).click()

        await page.locator("#ReviewsDropDownSorting").click()
        await page.locator(".ReviewSortingDropDown").waitFor()

        await page.locator("#mostRecentReviewSorting").click()
        await page.locator("//div[@id = 'ReviewsDropDownSorting']/span[text() = 'Senast inkommet']").waitFor()
        // wait to load the new reviews
        await new Promise(f => setTimeout(f, 500))

        const reviewsSelector = page.locator("//div[contains(@class, 'reviewsList')]/div")
        const expandedReviewsCount = await reviewsSelector.count()

        const recentReviews: IndividualReview[] = []
        for (let i = 0; i < expandedReviewsCount; i++) {
            const currentReviewElement = reviewsSelector.nth(i)
            const fullStarsSelector = currentReviewElement.locator(
                "xpath=./div[2]/div[1]/div[1]//*[local-name() = 'svg' and contains(normalize-space(@class), ' ')]")

            const score = await fullStarsSelector.count()
            const content = <string>await this.extractProperty(currentReviewElement, 'xpath=./div[2]/p',
                    node => node.textContent())
            recentReviews.push({
                score, content
            })
        }

        return {
            name: <string>product_name,
            price,
            currency: "SEK",
            images,
            description,
            url: page.url(),
            isDiscounted: originalPriceString !== null,
            brand,
            categoryTree,
            reviews: {
                averageReview,
                reviewCount,
                recentReviews
            },
            articleNumber,
            specifications: specArray
        };
    }

    static async create(): Promise<TrademaxCrawlerDefinition> {
        const detailsDataset = await Dataset.open("__CRAWLEE_TEMPORARY_detailsDataset")
        const listingDataset = await Dataset.open("__CRAWLEE_TEMPORARY_listingDataset")

        return new TrademaxCrawlerDefinition({
            detailsDataset, listingDataset,
            listingUrlSelector: "//div[@data-cy = 'pagination_controls']/a",
            detailsUrlSelector: "//a[contains(@class, 'ProductCard_card__global')]",
            productCardSelector: "//a[contains(@class, 'ProductCard_card__global')]",
            cookieConsentSelector: "#onetrust-accept-btn-handler"
        })
    }

}