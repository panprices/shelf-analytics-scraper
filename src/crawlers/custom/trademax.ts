import {AbstractCrawlerDefinition} from "../abstract.js";
import {Locator, Page} from "playwright";
import {Dataset} from "crawlee";

export class TrademaxCrawlerDefinition extends AbstractCrawlerDefinition{
    async extractCardProductInfo(categoryUrl: string, productCard: Locator): Promise<ProductInfo> {
        const imageUrl = <string>await this.extractProperty(productCard, "xpath=(..//img)[1]", this.extractImageFromSrcSet)
        const name = await this.extractProperty(productCard, "..//h3[contains(@class, 'ProductCardTitle__global')]",
            node => node.textContent())
        const priceText = <string>await this.extractProperty(productCard, "..//div[@data-cy = 'current-price']",
                node => node.textContent())
        const originalPriceText = await this.extractProperty(productCard, "..//div[@data-cy = 'original-price']",
            node => node.textContent())
        const isDiscounted = originalPriceText !== null
        const url = <string> await this.extractProperty(productCard, "..//a[1]",
                node => node.getAttribute("href"))

        const result: ProductInfo = {
            name, images: [imageUrl], price: Number(priceText.replace(/\\s/g, '')), isDiscounted, url,
            currency: 'SEK', categoryUrl
        }
        if (isDiscounted) {
            result.originalPrice = Number(originalPriceText.replace(/\\s/g, ''))
        }

        return result
    }

    async extractProductDetails(page: Page): Promise<ProductInfo> {
        await page.waitForSelector("h1[data-cy='product_title']")

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
        const thumbnails = await page
          .locator(".ProductInfoSliderNavigation__global img")
          .evaluateAll((list: HTMLElement[]) =>
            list.map((element) => element.getAttribute("src"))
          );

        // TODO
        const description = null;
        return {
          name: product_name,
          price,
          currency: "SEK",
          images,
          description,
          url: page.url(),
          brand: null,
          // TODO: check if the product is discounted
          isDiscounted: false
        };
    }

    static async create(): Promise<TrademaxCrawlerDefinition> {
        const detailsDataset = await Dataset.open("__CRAWLEE_TEMPORARY_detailsDataset")
        const listingDataset = await Dataset.open("__CRAWLEE_TEMPORARY_listingDataset")

        return new TrademaxCrawlerDefinition({
            detailsDataset, listingDataset,
            listingUrlSelector: "//div[@data-cy = 'pagination_controls']/a",
            detailsUrlSelector: "//a[contains(@class, 'ProductCard_card__global')]",
            productCardSelector: "//a[contains(@class, 'ProductCard_card__global')]"
        })
    }

}