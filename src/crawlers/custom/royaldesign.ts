import { Locator, Page } from "playwright";
import { log, PlaywrightCrawlingContext } from "crawlee";
import { DetailedProductInfo, ListingProductInfo } from "../../types/offer";
import { AbstractCrawlerDefinition, CrawlerLaunchOptions } from "../abstract";
import { findElementByCSSProperties } from "../scraper-utils";
import { convertSchemaOrgAvailability } from "../../utils";

export class RoyalDesignCrawlerDefinition extends AbstractCrawlerDefinition {

  // Only needed for category exploration. Return <undefined> otherwise.
  async extractCardProductInfo(
    categoryUrl: string,
    productCard: Locator
  ): Promise<ListingProductInfo> {
    const url = await this.extractProperty(productCard, "", (node) =>
      node.getAttribute("href")
    );
    if (!url) throw new Error("Cannot find url of productCard");

    const categoryTree = await this.extractCategoryTreeFromCategoryPage(
      productCard.page().locator(""),
      0,
      productCard.page().locator("")
    );
    return {
      url,
      categoryUrl,
      popularityCategory: categoryTree ? categoryTree : undefined,
    };
  }

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
    if (!rootElement) {
      throw new Error("Cannot extract rootElement");
    }
    
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
    if (!rootElement) {
      throw new Error("Cannot extract rootElement");
    }

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
    if (!rootElement) {
      throw new Error("Cannot extract rootElement");
    }

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
    if (!rootElement) {
      throw new Error("Cannot extract rootElement");
    }

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
      (element) => element?.innerText()
    )
    .then(text => text?.trim())
    if (!rootElement) {
      throw new Error("Cannot extract rootElement");
    }

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
    if (!rootElement) {
      throw new Error("Cannot extract rootElement");
    }

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
    if (!rootElement) {
      throw new Error("Cannot extract rootElement");
    }

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
    }

    // I will hardcode this for now as this seems to be the way we usually do this.
    // but it should be possible to do this dynamically from grabbing the currency
    // from the website.
    const currency = "SEK";

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
      images, // if not applicable return an empty array
      // specifications, // if not applicable return an empty array
      // reviews,
      //
      // variantGroupUrl,
      // variant: 0, // 0, 1, 2, 3, ...
      //
      // metadata: { schemaOrg },
    };
  }

  // Remove this if the retailer doesn't need category indexing
  override async crawlIntermediateCategoryPage(
    ctx: PlaywrightCrawlingContext
  ): Promise<void> {
    await ctx.enqueueLinks({
      // selector: ,
      label: "LIST",
    });
  }

  static async create(
    launchOptions?: CrawlerLaunchOptions
  ): Promise<RoyalDesignCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets(
        launchOptions?.uniqueCrawlerKey
      );

    return new RoyalDesignCrawlerDefinition({
      detailsDataset,
      listingDataset,

      // Only needed for category exploration
      // listingUrlSelector: ,
      // detailsUrlSelector: ,
      // productCardSelector: ,
      // cookieConsentSelector: ,
      // dynamicProductCardLoading: false,
      launchOptions,
    });
  }
}

export function extractPriceFromPriceText(priceText: string): number {
  /** 1 643 kr -> 1643 */
  return parseFloat(
    priceText.replace(/\s/g, "").replace("kr", "").trim()
  );
}
