import { Locator, Page } from "playwright";
import { log, PlaywrightCrawlingContext } from "crawlee";
import { DetailedProductInfo, ListingProductInfo, Category, Specification } from "../../types/offer.js";
import { AbstractCrawlerDefinition, CrawlerLaunchOptions } from "../abstract.js";
import { convertSchemaOrgAvailability } from "../../utils.js";

export class MacysCrawlerDefinition extends AbstractCrawlerDefinition {
  private async setShippingCountryCookie(page: Page) {
    await page.context().addCookies([
      {
        name: "shippingCountry",
        value: "US",
        domain: ".macys.com",
        path: "/",
      },
    ]);

    // Wait for the page to process the cookie and reload
    await page.reload({ waitUntil: "networkidle" });
    
    // Additional wait to ensure the page has fully processed the cookie
    await page.waitForTimeout(2000);
  }

  /**
   * Common setup tasks for both category and product pages
   */
  private async setupPage(page: Page, targetUrl: string, isCategoryPage: boolean = false) {
    if (isCategoryPage) {
      // For category pages, set the cookie and then navigate back to the target page
      await this.setShippingCountryCookie(page);
      await page.goto(targetUrl, { waitUntil: "networkidle" });
    } else {
      // For product pages, just set the cookie on the current page
      await this.setShippingCountryCookie(page);
    }
  }

  override async extractCategoryTree(locator: Locator | Page, _depth: number): Promise<Category[]> {
    const categoryTree: Category[] = [];
    
    // Get all breadcrumb links
    const breadcrumbLinks = await locator.locator("nav.breadcrumbs a.p-menuitem-link").all();
    
    // Process all breadcrumb links (including the first one as it's the real top-level category)
    for (let i = 0; i < breadcrumbLinks.length; i++) {
      const link = breadcrumbLinks[i];
      const name = await link.locator("span.p-menuitem-text").textContent();
      const url = await link.getAttribute("href");
      
      if (name && url) {
        categoryTree.push({
          name: name.trim(),
          url: url
        });
      }
    }
    
    return categoryTree;
  }

  /**
   * This method is needed for category exploration. It receives a product card and extracts some things from that.
   *
   * A product card = the area that defines the content for a product in a category page
   *
   * @param categoryUrl
   * @param productCard
   */
  async extractCardProductInfo(
    categoryUrl: string,
    productCard: Locator
  ): Promise<ListingProductInfo> {
    const url = await this.extractProperty(productCard, "a.brand-and-name", (node) =>
      node.getAttribute("href")
    );
    if (!url) throw new Error("Cannot find url of productCard");

    const name = await this.extractProperty(productCard, "h3.product-name", (node) =>
      node.textContent()
    ).then((text) => text?.trim());
    if (!name) throw new Error("Cannot find name of productCard");

    const brand = await this.extractProperty(productCard, "div.product-brand", (node) =>
      node.textContent()
    ).then((text) => text?.trim());

    const categoryTree = await this.extractCategoryTree(productCard.page(), 0);

    return {
      name,
      url,
      brand,
      categoryUrl,
      popularityCategory: categoryTree,
    };
  }

  /**
   * This method implements the logic of getting all the product details from a product page
   * @param page
   */
  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    // Set up the page with required cookies
    await this.setupPage(page, page.url(), false);

    // Extract schema.org data from the productMktData script
    const schemaOrgString = await this.extractProperty(
      page,
      "//script[@id='productMktData']",
      (node) => node.textContent()
    );

    let schemaOrg;
    let name;
    let brand;
    let brandUrl;
    let images: string[] = [];
    let gtin;
    let description;
    let price;
    let currency;
    let availability;
    let sku;
    let specifications: Specification[] = [];

    const categoryTree = await this.extractCategoryTree(page, 0);

    if (schemaOrgString) {
      try {
        schemaOrg = JSON.parse(schemaOrgString);
        name = schemaOrg.name;
        brand = schemaOrg.brand?.name;
        images = schemaOrg.image || [];
        description = schemaOrg.description;

        // Extract price and currency from the first offer
        if (schemaOrg.offers && schemaOrg.offers.length > 0) {
          const firstOffer = schemaOrg.offers[0];
          price = parseFloat(firstOffer.price);
          currency = firstOffer.priceCurrency;
          // The SKU in Macy's offers is actually the GTIN
          gtin = firstOffer.SKU?.replace(/USA$/, '');
          // Use productID as our SKU since that's Macy's internal identifier
          sku = String(schemaOrg.productID);
          availability = convertSchemaOrgAvailability(firstOffer.availability);
        }
      } catch (error) {
        log.warning("Error extracting data from schema.org", { error });
      }
    }

    // Extract brand URL
    brandUrl = await this.extractProperty(
      page,
      'label[itemprop="brand"] a.link',
      (node) => node.getAttribute("href")
    );

    // Extract product specifications
    const specElements = await page.locator('div.long-description-available ul.details li.column ul.margin-left-xs li span').all();
    for (const element of specElements) {
      const text = await element.textContent();
      if (text) {
        const trimmedText = text.trim();
        // Split on first colon if it exists
        const [key, value] = trimmedText.split(':').map(s => s.trim());
        specifications.push({
          key: key || trimmedText, // If no colon, use whole text as key
          value: value || "" // If no colon, use empty string as value
        });
      }
    }

    // Fallback to basic extraction if schema.org parsing failed
    if (!name) {
      name = await this.extractProperty(page, "", (element) =>
        element.innerText()
      ).then((text) => text?.trim());
    }

    return {
      name,
      url: page.url(),
      brand,
      brandUrl,
      description,
      price,
      currency,
      gtin,
      availability,
      images,
      categoryTree,
      sku,
      specifications,
      metadata: { schemaOrg },
    };
  }

  /**
   * This method should get all the category URLs available on an "Intermediate Category Page"
   *
   * An intermediate category page can be:
   * - the homepage
   * - a category page that is not a "leaf" category, (i.e. has sub-categories)
   * @param _ctx
   */
  override async crawlIntermediateCategoryPage(
    ctx: PlaywrightCrawlingContext
  ): Promise<void> {
    // Set up the page with required cookies
    await this.setupPage(ctx.page, ctx.request.url, true);

    // await ctx.enqueueLinks({
    //   selector: ,
    //   label: "LIST",
    // });
  }

  /**
   * This method is called for each category page to extract product information
   */
  override async crawlListPage(ctx: PlaywrightCrawlingContext): Promise<void> {
    // Set up the page with required cookies, starting from macys.com
    await this.setupPage(ctx.page, ctx.request.url);

    // Call the parent class's crawlListPage to handle the rest
    await super.crawlListPage(ctx);
  }

  static async create(
    launchOptions?: CrawlerLaunchOptions
  ): Promise<MacysCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets(
        launchOptions?.uniqueCrawlerKey
      );

    return new MacysCrawlerDefinition({
      detailsDataset,
      listingDataset,
      /**
       * Defining these selectors is necessary for category exploration
       *
       * See the docs for details:
       * https://www.notion.so/getloupe/Deep-indexed-retailers-Overall-project-structure-and-getting-started-c9c6af62a53a4591859486ffb0c64af9#04f074d7711a4f128f58bb6057886689
       */
      // detailsUrlSelector: ,
      productCardSelector: "li.cell.sortablegrid-product",
      listingUrlSelector: "a.next-button",
      // cookieConsentSelector: ,
      dynamicProductCardLoading: false,
      launchOptions,
    });
  }
}
