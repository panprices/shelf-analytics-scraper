import { Locator, Page } from "playwright";
import { log, PlaywrightCrawlingContext } from "crawlee";
import { DetailedProductInfo, ListingProductInfo } from "../../types/offer";
import {
  AbstractCrawlerDefinitionWithSimpleVariants,
  CrawlerLaunchOptions,
} from "../abstract";
import { findElementByCSSProperties } from "../scraper-utils";
import { convertSchemaOrgAvailability } from "../../utils";
import { url } from "node:inspector";

/* 
  PLEASE NOTE:
  Royal Design applies dynamically rendered CSS classes that likely changes
  after each new build of the React powered website. Therefore we can not rely on simple
  CSS selecting based on the class names. Occasionally we can use Xpath's to find the
  elements. Sometimes however we need to do find the elements based on CSS properties.
  In 2024-07-10, Robert had just come up with this method and used it for Trademax.
*/

export class RoyalDesignCrawlerDefinition extends AbstractCrawlerDefinitionWithSimpleVariants {
  // Only needed for category exploration. Return <undefined> otherwise.
  async extractCardProductInfo(
    categoryUrl: string,
    productCard: Locator
  ): Promise<ListingProductInfo> {
    const url = await this.extractProperty(
      productCard,
      'div > a',
      (node) => node.first().getAttribute("href")
    );
    if (!url) throw new Error("Cannot find url of productCard");

    const categoryTree = await this.extractCategoryTreeFromCategoryPage(
      productCard.page().locator("//span[text()='Shop']/../../..//a"),
      1,
      productCard.page().locator("//h1[@color='white' and @font-size='7,,10']")
    );

    return {
      url,
      categoryUrl,
      popularityCategory: categoryTree ? categoryTree : undefined,
    };
  }
  /* PRODUCT DETAILS SELECTOR */
  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    const rootElement = page.locator('body');
    const name = await findElementByCSSProperties(
      rootElement,
      {
        "margin-bottom": "16px",
        "font-size": "24px",
        "font-weight": "500"
      },
      "h1"
    )
    .then((element) => element?.innerText())
    .then(text => text?.trim());
    if (!name) {
      throw new Error("Cannot extract name");
    }
    /* BRAND SELECTOR */
    const brand = await findElementByCSSProperties(
      rootElement,
      {
        "max-width": "100px",
        "max-height": "32px"
      },
      "img"
    )
    .then(
      (element) => element?.getAttribute('alt')
    )
    .then(text => text?.trim());
    /* BRAND URL SELECTOR */
    const brandUrl = await findElementByCSSProperties(
      rootElement,
      {
        "max-width": "100px",
        "max-height": "32px"
      },
      "img"
    )
    .then(
      (element) => element?.locator("..").locator("..").getAttribute('href')
    )
    .then(text => text?.trim());
    /* DESCRIPTION SELECTOR */
    const description = await findElementByCSSProperties(
      rootElement,
      {
        "fontSize": "14px",
        "marginTop": "14px",
        "lineHeight": "21px"
      },
      "span"
    )
    .then(
      (element) => element?.locator("div").innerText()
    )
    .then(text => text?.trim());
    /* NON DISCOUNTED PRICE SELECTOR */
    const nonDiscountedpriceText = await findElementByCSSProperties(
      rootElement,
      {
        "fontSize": "28px",
        "color": "rgb(0, 0, 0)",
        "fontWeight": "300"
      },
      "span"
    )
    .then(
      (element) => element?.first().innerText()
    )
    .then(text => text?.trim())
    /* DISCOUNTED PRICE SELECTOR */
    const discountedPriceText = await findElementByCSSProperties(
      rootElement,
      {
        "fontSize": "28px",
        "color": "rgb(235, 95, 95)",
        "fontWeight": "300"
      },
      "span"
    )
    .then(
      (element) => element?.innerText()
    )
    .then(text => text?.trim());
    /* ORIGINAL PRICE WHEN ON DISCOUNT SELECTOR */
    const originalPriceText = await findElementByCSSProperties(
      rootElement,
      {
        "color": "rgb(128, 128, 128)",
        "textDecoration": "none solid rgb(128, 128, 128)",
        "marginRight": "12px"
      },
      "span"
    )
    .then(
      (element) => element?.innerText()
    )
    .then(text => text?.split("Tid. pris")[1].trim());
    /* RETURN PRICE AS THE DISCOUNTED PRICE IF ON DISCOUNT OTHERWISE NORMAL PRICE */
    let price: number | undefined;
    let originalPrice: number | undefined;
    let isDiscounted: boolean | undefined;
    if (nonDiscountedpriceText !== undefined) {
      price = extractPriceFromPriceText(nonDiscountedpriceText);
      isDiscounted = false;
    } else if (discountedPriceText !== undefined && originalPriceText !== undefined) {
      price = extractPriceFromPriceText(discountedPriceText);
      originalPrice = extractPriceFromPriceText(originalPriceText);
      isDiscounted = true;
    } else {
      throw new Error("Cannot extract price");
    }
    /* HARDCODED CURRENCY */
    const currency = "SEK";
    /* SPECIFICATION SELECTOR */
    const specifications = await this.extractSpecificationsFromTable(
      page.locator("//span[contains(@class, 'product-sku')]/../../..//ancestor::li[1]/div[1]"),
      page.locator("//span[contains(@class, 'product-sku')]/../../..//ancestor::li[1]/div[2]")
    );
    /* DEFAULT SCHEMA ORG SELECTOR */
    const schemaOrgString = await this.extractProperty(
      page,
      "//script[@type='application/ld+json' and contains(text(), 'schema.org') and contains(text(), 'Product')]",
      (node) => node.textContent()
    );
    let schemaOrg = undefined;
    let gtin, availability, mpn, sku, images;
    if (schemaOrgString) {
      try {
        schemaOrg = JSON.parse(schemaOrgString);
        gtin = schemaOrg.gtin13;
        mpn = schemaOrg.mpn;
        sku = schemaOrg.sku;
        images = schemaOrg.image
        availability = convertSchemaOrgAvailability(
          schemaOrg.offers.availability
        );
      } catch (error) {
        log.warning("Error extracting data from schema.org", { error });
      }
    }

    return {
      name,
      url: page.url(),

      brand,
      brandUrl,
      description,
      price,
      currency,
      isDiscounted,
      originalPrice,
      availability,
      //
      gtin,
      sku,
      mpn,
      //
      images,
      specifications,
      // reviews,
      //
      // variantGroupUrl,
      // variant: 0, // 0, 1, 2, 3, ...
      //
      metadata: { schemaOrg },
    };
  }

  /* We are a bit lucky with Royal Design to find that the variant drop 
  down contains link items to all the possible variant that we can 
  access without any need for naviation.*/
  override async extractVariantUrls(
    ctx: PlaywrightCrawlingContext
  ): Promise<string[]> {
    const variantUrls = [];
    for (const a of await ctx.page
      .locator("//div[@role='combobox']/a")
      .all()) {
      const url = await a.getAttribute("href");
      if (url) variantUrls.push(url);
    }
    return variantUrls;
  }

  /* On Royal Design's homepage they have an element called "seo-links"
  in which they seem to list all links on their website, similar to a sitemap.
  When we are after all the sub category pages we can easily find them within
  this "seo-links" element. One problem though is that we will also receive
  links to blog posts, brand pages and other things which we do not want. 
  The simple solution below is to filter on URLs which starts with one of 
  the root categories since Royal Design's category pages always starts with
  either of these root categories in their URL's.
  */
  override async crawlIntermediateCategoryPage(
    ctx: PlaywrightCrawlingContext
  ): Promise<void> {
    // Get all links from this seo-links object at Royal Design
    const linksLocator = await ctx.page
      .locator('ul[data-type="seo-links"] a')
      .all();
    // We are only interested in the sub categories of the main categories
    // TODO: Fetch these root categories from the website instead of hardcoding
    const wantedURLs = [
      '/servering', '/inredning', '/belysning', '/mobler',
      '/koket', '/textil-och-mattor', '/utemobler', '/belysning'
    ]
    // Convert the wantedURLs array to a single regex pattern
    const regexPattern = new RegExp(`^(${wantedURLs.join('|')})`);
    const links: string[] = []; 
    for (const link of linksLocator) {
      const path = await link
        .getAttribute("href")
        .then(url => {
          if (url && regexPattern.test(url)) {
            links.push("https://royaldesign.se" + url);
          }
        });
    }
    // Return the links to the crawl queue
    await ctx.enqueueLinks({
      urls: links,
      label: 'LIST',
    });
  }

  static async create(
    launchOptions?: CrawlerLaunchOptions
  ): Promise<RoyalDesignCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinitionWithSimpleVariants.openDatasets(
        launchOptions?.uniqueCrawlerKey
      );

    return new RoyalDesignCrawlerDefinition({
      detailsDataset,
      listingDataset,
      listingUrlSelector: "//button[a[contains(text(), 'Nästa')]]//a",
      productCardSelector: '//div[@data-type="product_list_item"]',
      dynamicProductCardLoading: false,
      launchOptions,
    });
  }

  override async crawlListPage(ctx: PlaywrightCrawlingContext): Promise<void> {
    if (!this.productCardSelector) {
      log.info("No product card selector defined, skipping");
      return;
    }

    await ctx.page.locator(this.productCardSelector).nth(0).waitFor();

    await this.scrollToBottom(ctx);
    await this.registerProductCards(ctx);

    if (this.listingUrlSelector) {
      await ctx.enqueueLinks({
        selector: this.listingUrlSelector,
        label: "LIST",
      });
    }
  }
}

export function extractPriceFromPriceText(priceText: string): number {
  /** 1 643 kr -> 1643 */
  return parseFloat(
    priceText.replace(/\s/g, "").replace("kr", "").trim()
  );
}
