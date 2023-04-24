import { Locator, Page } from "playwright";
import { DetailedProductInfo } from "../../types/offer";
import {
  AbstractCrawlerDefinition,
  AbstractCrawlerDefinitionWithVariants,
  CrawlerDefinitionOptions,
  CrawlerLaunchOptions,
} from "../abstract";
import { extractDomainFromUrl } from "../../utils";
import { Dictionary, log, PlaywrightCrawlingContext } from "crawlee";

export class NordiskaGallerietCrawlerDefinition extends AbstractCrawlerDefinitionWithVariants {
  public constructor(options: CrawlerDefinitionOptions) {
    super(options, "same_tab");
  }

  override async getCurrentVariantState(
    ctx: PlaywrightCrawlingContext
  ): Promise<any> {
    const sku = await this.extractProperty(ctx.page, "#artnr-copy", (node) =>
      node.textContent().then((t) => t?.trim())
    );

    return { sku };
  }

  override async getCurrentVariantUrl(
    ctx: PlaywrightCrawlingContext
  ): Promise<string> {
    await ctx.page.waitForSelector("#artnr-copy", { timeout: 5000 });
    const url = ctx.page.url().split("?")[0];
    const sku = await this.extractProperty(ctx.page, "#artnr-copy", (node) =>
      node.textContent().then((t) => t?.trim())
    );
    log.info(`Current variant url: ${url}?sku=${sku}`);
    return `${url}?sku=${sku}`;
  }

  async selectOptionForParamIndex(
    ctx: PlaywrightCrawlingContext<Dictionary<any>>,
    paramIndex: number,
    optionIndex: number
  ): Promise<void> {
    const dropDowns = ctx.page.locator(".selectmenu");
    const dropDown = dropDowns.nth(paramIndex);

    let option,
      optionVisible = false;
    let tries = 0;
    do {
      await dropDown.click();
      let options = dropDown.locator(".VB_Egenskap");
      option = options.nth(optionIndex);
      optionVisible = await option.isVisible();

      // Let it crash, and the exception will be caught by the caller. The number of options
      // will be recounted then
      if (tries > 5) {
        break;
      }
      tries++;
    } while (!optionVisible);

    await option.click();
    await ctx.page.waitForLoadState("networkidle");

    // Wait for the options in subsequent dropdowns to be loaded
    await ctx.page.waitForTimeout(100);
  }

  async hasSelectedOptionForParamIndex(
    ctx: PlaywrightCrawlingContext<Dictionary<any>>,
    paramIndex: number
  ): Promise<boolean> {
    const dropDowns = ctx.page.locator(".selectmenu");
    const dropDown = dropDowns.nth(paramIndex);

    const dropDownDefault = await dropDown
      .locator(".VB_label")
      .getAttribute("data-default")
      .then((t) => t?.trim());
    const dropDownValue = await dropDown
      .locator(".VB_label")
      .textContent()
      .then((t) => t?.trim());

    return dropDownValue?.toLowerCase() !== dropDownDefault?.toLowerCase();
  }

  async getOptionsForParamIndex(
    ctx: PlaywrightCrawlingContext<Dictionary<any>>,
    paramIndex: number
  ): Promise<number> {
    const dropDowns = ctx.page.locator(".selectmenu");
    const dropDownsCount = await dropDowns.count();
    if (dropDownsCount <= paramIndex) {
      return 0;
    }

    const dropDown = dropDowns.nth(paramIndex);

    await dropDown.click();

    const optionsCount = await dropDown.locator(".VB_Egenskap").count();
    await dropDown.click();

    return optionsCount;
  }

  async checkInvalidVariant(
    _: PlaywrightCrawlingContext<Dictionary<any>>,
    __: number[]
  ): Promise<boolean> {
    return false;
  }
  /**
   * This retailer does not use category scraping, it gets the URLs from sitemap
   */
  extractCardProductInfo(): Promise<undefined> {
    return Promise.resolve(undefined);
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    const headlineName = await this.extractProperty(
      page,
      ".ArtikelnamnFalt",
      (node) => node.textContent().then((t) => t?.trim())
    );
    const variantSubName = await this.extractProperty(
      page,
      "//div[contains(@class, 'VB_label')]//span[contains(@class, 'variant-beskr')]",
      async (nodes) => {
        const nodesCount = await nodes.count();
        return Promise.all(
          Array.from({ length: nodesCount }, (_, i) => {
            return nodes
              .nth(i)
              .textContent()
              .then((t) => t?.trim());
          })
        ).then((texts) => texts.join(" ").trim());
      }
    );
    const name = `${headlineName} ${variantSubName ?? ""}`.trim();

    const sku = await this.extractProperty(page, "#artnr-copy", (node) =>
      node.textContent().then((t) => t?.trim())
    );

    const brand = await this.extractProperty(
      page,
      "//div[@id='VarumarkeText']//a[last()]",
      (node) => node.textContent()
    );
    const description = await this.extractProperty(page, "#prodtext", (node) =>
      node.textContent().then((t) => t?.trim())
    );

    const priceExtractor = (node: Locator) =>
      node.textContent().then((t) => t?.replace(/[^0-9]/g, ""));
    let priceString = await this.extractProperty(
      page,
      ".PrisBOLD",
      priceExtractor
    );

    let isDiscounted = false,
      originalPriceString = undefined;
    if (!priceString) {
      priceString = await this.extractProperty(
        page,
        ".PrisREA",
        priceExtractor
      );
      isDiscounted = true;
      originalPriceString = await this.extractProperty(
        page,
        ".PrisORD",
        priceExtractor
      );
    }
    const originalPrice = originalPriceString
      ? parseFloat(originalPriceString)
      : undefined;

    const schemaOrgString = await this.extractProperty(
      page,
      "//script[@type='application/ld+json' and contains(text(), 'schema.org') and contains(text(), '\"Product\"')]",
      (node) => node.textContent()
    );
    const schemaOrg = JSON.parse(schemaOrgString ?? "{}");

    // For pages with variants schema org is an array with the different variants
    // Otherwise schema org is a single object
    const hasVariants = Array.isArray(schemaOrg);

    const schemaOrgProduct = hasVariants
      ? schemaOrg.find((s: Dictionary) => s["sku"] === sku)
      : schemaOrg;
    const currency = schemaOrgProduct?.["offers"]?.["priceCurrency"];
    const mpn = schemaOrgProduct?.["mpn"];
    const gtin = schemaOrgProduct?.["gtin8"] ?? schemaOrgProduct?.["gtin13"];

    const categoryTree = await this.extractCategoryTree(
      page.locator(
        "//div[contains(@class, 'breadcrumbwrap')]" +
          "//li[contains(@class, 'breadcrumb-item') and not(contains(@class, 'active'))]/a"
      )
    );
    const inStock = await this.extractProperty(
      page,
      "#TextLagerIdFalt",
      (node) =>
        node
          .getAttribute("class")
          .then((c) => c?.includes("instock").toString())
    );
    const availability = inStock === "true" ? "in_stock" : "out_of_stock";

    const imagesString = await this.extractProperty(
      page,
      "//div[@id='carousel']//a[contains(@class, 'item')]/img[1]",
      async (nodes) => {
        const nodesCount = await nodes.count();
        return Promise.all(
          Array.from({ length: nodesCount }, (_, i) => i).map(async (i) => {
            let src = await nodes.nth(i).getAttribute("src");
            if (!src) {
              src = await nodes.nth(i).getAttribute("data-src");
            }
            return src;
          })
        ).then((images) => JSON.stringify(images));
      }
    );
    const images = JSON.parse(imagesString ?? "[]");

    const reviewsAverageString = await this.extractProperty(
      page,
      ".average-grade",
      (node) =>
        node
          .textContent()
          .then((t) => t?.replace(/[^0-9\/.]/g, "").split("/")[0])
    );
    const reviewsCountString = await this.extractProperty(
      page,
      ".tab-reviews-trigger",
      (node) =>
        node
          .textContent()
          .then(
            (t) => t?.match(/\(([^)]+)\)/)?.[1]?.replace(/[^0-9]/g, "") ?? "0"
          )
    );

    const reviewsString = await this.extractProperty(
      page,
      "//div[@id='article-grades-list']/div[contains(@class, 'grade-wrap')]",
      async (nodes) => {
        const reviewsCount = await nodes.count();
        return Promise.all(
          Array.from({ length: reviewsCount }, (_, i) => i).map(async (i) => {
            const review = await nodes.nth(i);
            const reviewContent = await review
              .locator("//div[contains(@class, 'row')][3]")
              .textContent();
            const reviewScore = await review
              .locator("//div[contains(@class, 'row')][2]//span")
              .getAttribute("class")
              .then((c) =>
                c
                  ?.split(" ")
                  .find((c) => c.startsWith("betyg") && c.length === 6)
                  ?.replace("betyg", "")
              );

            return {
              score: Number(reviewScore),
              content: reviewContent,
            };
          })
        ).then((reviews) => JSON.stringify(reviews));
      }
    );
    const recentReviews = JSON.parse(reviewsString ?? "[]");

    const specsString = await this.extractProperty(
      page,
      ".property-row",
      async (nodes) => {
        const specsCount = await nodes.count();
        return Promise.all(
          Array.from({ length: specsCount }, (_, i) => i).map(async (i) => {
            const spec = await nodes.nth(i);
            const specName = await spec.locator("div").nth(0).textContent();
            const specValue = await spec.locator("div").nth(1).textContent();

            return {
              key: specName,
              value: specValue,
            };
          })
        ).then((specs) => JSON.stringify(specs));
      }
    );
    const specifications = JSON.parse(specsString ?? "[]");

    // return a Dummy `DetailedProductInfo` object
    return {
      name: name,
      // For pages with variants we modify the URL to store the different products
      // Otherwise we just return the original URL
      url: hasVariants ? `${page.url()}#sku=${sku}` : page.url(),

      brand: brand,
      description: description,
      price: Number(priceString),
      currency: currency,
      isDiscounted: isDiscounted,
      originalPrice,

      gtin: gtin,
      sku: sku,
      mpn: mpn,

      categoryUrl: categoryTree[categoryTree.length - 1].url,
      categoryTree: categoryTree,

      metadata: { schemaOrg: schemaOrgProduct },

      availability: availability,
      fetchedAt: new Date().toISOString(),
      retailerDomain: extractDomainFromUrl(page.url()),

      images: images, // if not applicable return an empty array
      reviews: {
        averageReview: Number(reviewsAverageString),
        reviewCount: Number(reviewsCountString),
        recentReviews: recentReviews,
      },
      specifications: specifications, // if not applicable return an empty array

      //categoryTree is only optional if we already scraped it in the category page.

      variantGroupUrl: "",
      variant: 0, // 0, 1, 2, 3, ...
    };
  }

  static async create(
    launchOptions?: CrawlerLaunchOptions
  ): Promise<NordiskaGallerietCrawlerDefinition> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets();

    return new NordiskaGallerietCrawlerDefinition({
      detailsDataset,
      listingDataset,
      launchOptions,
    });
  }
}
