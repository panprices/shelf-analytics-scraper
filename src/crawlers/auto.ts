import { AbstractCrawlerDefinition, CrawlerLaunchOptions } from "./abstract";
import { Locator, Page } from "playwright";
import { DetailedProductInfo, ListingProductInfo } from "../types/offer";
import { log } from "crawlee";
import jsonic from "jsonic";
import { extractDomainFromUrl, pascalCaseToSnakeCase } from "../utils";
import { IllFormattedPageError, PageNotFoundError } from "../types/errors";

interface PriceOffer {
  found: boolean;
  name: string | null;
  gtin: string | null;
  mpn: string | null;
  price: number | null;
  currency: string | null;
  availability: string | null;
  images: string[];
  metadata?: any;
}

class AutoCrawler extends AbstractCrawlerDefinition {
  extractCardProductInfo(
    _categoryUrl: string,
    _productCard: Locator
  ): Promise<ListingProductInfo | undefined> {
    return Promise.resolve(undefined);
  }

  private async tryHandlePriceComparisionWebsiteRedirectUrl(page: Page) {
    if (isComparisonWebsite(page)) {
      // Wait untilt the page is redirected to a retailer wesite
      let timeWaited = 0;
      while (isComparisonWebsite(page) && timeWaited < 10_000) {
        await page.waitForTimeout(1000);
        timeWaited += 1000;
      }
    }
  }

  async fetchOpenGraphMetadata(page: Page): Promise<PriceOffer> {
    // Example page: https://www.baldai1.lt/spintos/spinta-hartford-254-matine-balta-baltas-marmuras.html

    const productNameTagOptions = ["og:title"];
    const priceCurrencyTagOptions = ["g:sale_price", "g:price"];
    const priceTagOptions = [
      "og:sale_price:amount",
      "og:price:amount",
      "product:sale_price:amount",
      "product:price:amount",
    ];
    const currencyTagOptions = [
      "og:sale_price:currency",
      "og:price:currency",
      "product:sale_price:currency",
      "product:price:currency",
    ];
    const availabilityTagOptions = [
      "g:availability",
      "og:availability",
      "product:availability",
    ];
    const imageTagOptions = [
      "og:image",
      "og:image:url",
      "product:image",
      "product:image:url",
      "image_link",
      "additional_image_link",
    ];

    let name: string | null = null;
    let price: number | null = null;
    let currency: string | null = null;
    let availability: string | null = null;
    let images: string[] = [];

    // Fetch name of the product
    for (const tagOption of productNameTagOptions) {
      name = await page
        .$eval(
          `meta[property='${tagOption}']`,
          (el) => el.getAttribute("content"),
          null
        )
        .catch(() => null);
      if (name) break;
    }

    // Fetch price and currency from combined tag options first
    for (const tagOption of priceCurrencyTagOptions) {
      const content = await page
        .$eval(`meta[property='${tagOption}']`, (el) =>
          el.getAttribute("content")
        )
        .catch(() => {});
      if (content) {
        const parts = content.split(" ");
        price = parseFloat(parts[0]);
        currency = parts[1];
        break;
      }
    }

    // If not found, try separate price and currency tags
    if (!price) {
      for (const tagOption of priceTagOptions) {
        const content = await page
          .$eval(
            `meta[property='${tagOption}']`,
            (el) => el.getAttribute("content"),
            null
          )
          .catch(() => null);
        if (content) {
          price = parseFloat(content);
          break;
        }
      }
    }

    if (!currency) {
      for (const tagOption of currencyTagOptions) {
        currency = await page
          .$eval(
            `meta[property='${tagOption}']`,
            (el) => el.getAttribute("content"),
            null
          )
          .catch(() => null);
        if (currency) break;
      }
    }

    // Fetch availability
    for (const tagOption of availabilityTagOptions) {
      availability = await page
        .$eval(
          `meta[property='${tagOption}']`,
          (el) => el.getAttribute("content"),
          null
        )
        .catch(() => null);
      if (availability) break;
    }

    // Fetch images
    // for (const tagOption of imageTagOptions) {
    //   const content = await page
    //     .$eval(
    //       `meta[property='${tagOption}']`,
    //       (el) => el.getAttribute("content"),
    //       null
    //     )
    //     .catch(() => null);
    //   if (content) {
    //     images.push(content);
    //   }
    // }
    images = [];

    return {
      found: price !== null,
      name,
      gtin: null, // not implemented
      mpn: null, // not implemented
      price,
      currency,
      availability,
      images,
    };
  }

  async fetchJsonSchema(page: Page): Promise<PriceOffer> {
    let schemaOrgProducts: any[] = [];
    const schemaOrgScripts = await page.$$eval(
      "script[type='application/ld+json']",
      (elements) => elements.map((el) => el.textContent || "")
    );

    schemaOrgScripts.forEach((scriptText) => {
      try {
        // Removing potential CDATA and comments within the script content
        const cleanedScriptText = scriptText
          .replace(/\/\*.*?\*\//gs, "")
          .replace(/<!\[CDATA\[.*?\]\]>/gs, "");
        let schema = null;
        try {
          schema = JSON.parse(cleanedScriptText.replace(/\n/gi, " "));
        } catch (error) {
          schema = jsonic(cleanedScriptText.replace(/\n/gi, " "));
        }
        if (!schema) return;

        if (Array.isArray(schema)) {
          schemaOrgProducts.push(
            ...schema.filter((item) => item["@type"]?.endsWith("Product"))
          );
        } else if (schema["@type"]?.endsWith("Product")) {
          schemaOrgProducts.push(schema);
        } else if (
          Object.keys(schema).filter((k) => k === "@graph").length > 0
        ) {
          schemaOrgProducts.push(
            ...schema["@graph"].filter((item: any) =>
              item["@type"]?.endsWith("Product")
            )
          );
        }
      } catch (error) {
        log.warning(`JSON parsing error for script`, { error });
      }
    });

    if (schemaOrgProducts.length === 0) {
      return {
        found: false,
        gtin: null,
        mpn: null,
        name: null,
        price: null,
        currency: null,
        availability: null,
        images: [],
      };
    }

    const product = schemaOrgProducts[0];

    try {
      let offers = product.offers || product.Offers || {};
      if (Array.isArray(offers)) {
        log.info(
          "Multiple offers found, assuming the first is the correct one."
        );
        offers = offers[0];
      }

      if (offers["@type"]?.endsWith("AggregateOffer")) {
        log.info(
          "AggregateOffer found, assuming the first individual offer is the correct one."
        );
        offers = offers.offers[0];
      }

      const gtin =
        offers.gtin ||
        offers.gtin14 ||
        offers.gtin13 ||
        offers.gtin12 ||
        offers.gtin8 ||
        product.gtin ||
        product.gtin14 ||
        product.gtin13 ||
        product.gtin12 ||
        product.gtin8;
      const mpn = offers.mpn || product.mpn;

      const price =
        offers.priceSpecification?.price ||
        offers.PriceSpecification?.Price ||
        offers.price ||
        offers.Price;
      const currency =
        offers.priceSpecification?.priceCurrency ||
        offers.PriceSpecification?.PriceCurrency ||
        offers.priceCurrency ||
        offers.PriceCurrency;
      const availability =
        offers.availability?.split("/").pop() ||
        offers.Availability?.split("/").pop();

      // Stop fetching this to avoid occasional JSON format error in the
      // retailer's website schema.org. And we are not using this property
      // for Price Lite.
      // const tentativeImages = product.image || product.Image || [];
      // const images = Array.isArray(tentativeImages)
      //   ? tentativeImages
      //   : [tentativeImages];

      return {
        found: true,
        gtin,
        mpn,
        name: product.name,
        price: parseFloat(price),
        currency,
        availability,
        images: [],
        metadata: product,
      };
    } catch (error) {
      log.error(`Error processing product offers`, { error });
    }

    return {
      found: false,
      gtin: null,
      mpn: null,
      name: null,
      price: null,
      currency: null,
      availability: null,
      images: [],
    };
  }

  async fetchSchemaAttributes(page: Page): Promise<PriceOffer> {
    let name: string | null = null;
    let price: number | null = null;
    let currency: string | null = null;
    let availability: string | null = null;

    // Attempt to fetch the product name
    const nameLocator = await page.locator(
      "[itemtype='https://schema.org/Product'] [itemprop='name']"
    );
    if ((await nameLocator.count()) === 1) {
      name =
        (await nameLocator.getAttribute("content")) ||
        (await nameLocator.textContent());
    } else if ((await nameLocator.count()) > 1) {
      log.warning(
        "Found more than 1 html element for product name with schema.org attributes"
      );
    }

    // Attempt to fetch the price
    const priceContent: string | null = await page
      .$eval(
        "[itemprop='price']",
        (el: Element) => {
          return el.getAttribute("content") || el.textContent || null;
        },
        null
      )
      .catch(() => null);

    if (priceContent) {
      let processedPrice = priceContent.trim();
      if (processedPrice.includes(" ")) {
        const priceParts = processedPrice.split(" ");
        const priceExpression = /\d{1,3}([,.]\d{3,3})*([,.]\d+)?/;

        // The price may be expressed as "€ 379,00" or "379,00 €"
        if (priceExpression.test(priceParts[0])) {
          processedPrice = priceParts[0];
        } else if (priceExpression.test(priceParts[1])) {
          processedPrice = priceParts[1];
        }
      }
      if (processedPrice.includes(",")) {
        // Handling European number format, e.g., 1.234,56
        if (processedPrice.indexOf(",") === processedPrice.length - 3) {
          processedPrice = processedPrice.replace(/\./g, "").replace(",", ".");
        } else {
          processedPrice = processedPrice.replace(",", ".");
        }
      }
      price = parseFloat(processedPrice);
    }

    // Attempt to fetch the currency
    currency = await page
      .$eval(
        "[itemprop='priceCurrency']",
        (el: Element) => {
          return el.getAttribute("content") || el.textContent || null;
        },
        null
      )
      .catch(() => null);

    // Attempt to fetch the availability
    const availabilityContent: string | null = await page
      .$eval(
        "[itemprop='availability']",
        (el: Element) => {
          return el.getAttribute("href") || null;
        },
        null
      )
      .catch(() => null);

    if (availabilityContent) {
      const parts = availabilityContent.split("/");
      availability = parts[parts.length - 1];
    }

    // DEPRECATED: the images found this way usually include tiny thumbnails
    // const images = await page
    //   .$$eval(
    //     "img[itemprop='image']",
    //     (elements: Element[]) => {
    //       return elements
    //         .map((el) => el.getAttribute("src") || null)
    //         .filter((el) => el !== null);
    //     },
    //     null
    //   )
    //   .then((images) =>
    //     images.filter((image) => image !== null).map((i) => i as string)
    //   );
    const images: string[] = [];

    return {
      found: price !== null,
      name,
      price,
      currency,
      availability,
      images,
    };
  }

  async fetchWooCommerceData(page: Page): Promise<PriceOffer> {
    // Example page: https://rorbutiken.se/produkt/fmm-9000e-flexi-takduschset-forkromad
    const priceContent = await page
      .$eval(".woocommerce-Price-amount", (el: Element) => {
        return el.textContent || null;
      })
      .catch(() => null);
    if (!priceContent) {
      return {
        found: false,
        name: null,
        price: null,
        currency: null,
        availability: null,
        images: [],
      };
    }

    const availabilityInStock = await page
      .$eval(".stock.in-stock", () => true)
      .catch(() => false);

    const images = await page
      .$$eval(
        ".woocommerce-product-gallery__wrapper img",
        (elements: Element[]) => {
          return elements.map((el) => el.getAttribute("src") || null);
        }
      )
      .then((r) => r.filter((i) => i !== null).map((i) => i as string));

    return {
      found: true,
      name: null,
      price: parseFloat(
        priceContent.trim().split(" ")[0].trim().replace(",", ".")
      ),
      currency: null,
      availability: availabilityInStock ? "in_stock" : "out_of_stock",
      images,
    };
  }

  async fetchProductData(page: Page): Promise<DetailedProductInfo> {
    let found = false,
      name = null,
      gtin = null,
      mpn = null,
      price = null,
      currency = null,
      availability = null,
      images = [];

    try {
      let metadata = undefined;
      ({
        found,
        name,
        gtin,
        mpn,
        price,
        currency,
        availability,
        images,
        metadata,
      } = await this.fetchJsonSchema(page));

      if (found) {
        log.info("Product scraped using schema.org JSON data");
        return {
          url: page.url(),
          name: name ? name : undefined,
          gtin: gtin ? gtin : undefined,
          mpn: mpn ? mpn : undefined,
          price: price ? price : undefined,
          currency: currency ? currency : undefined,
          availability: availability ? availability : undefined,
          images,
          specifications: [],
          metadata,
        };
      }
    } catch (error) {
      log.warning(`Problem extracting product details with schema json`, {
        error,
      });
    }

    try {
      ({ found, name, gtin, mpn, price, currency, availability, images } =
        await this.fetchSchemaAttributes(page));

      if (found) {
        log.info("Product scraped using schema.org attributes data");
        return {
          url: page.url(),
          name: name ? name : undefined,
          gtin: gtin ? gtin : undefined,
          mpn: mpn ? mpn : undefined,
          price: price ? price : undefined,
          currency: currency ? currency : undefined,
          availability: availability ? availability : undefined,
          images,
          specifications: [],
        };
      }
    } catch (error) {
      log.warning(`Problem extracting product details with schema attributes`, {
        error,
      });
    }

    try {
      ({ found, name, gtin, mpn, price, currency, availability, images } =
        await this.fetchOpenGraphMetadata(page));

      if (found) {
        log.info("Product scraped using OpenGraph data");
        return {
          url: page.url(),
          name: name ? name : undefined,
          gtin: gtin ? gtin : undefined,
          mpn: mpn ? mpn : undefined,
          price: price ? price : undefined,
          currency: currency ? currency : undefined,
          availability: availability ? availability : undefined,
          images,
          specifications: [],
        };
      }
    } catch (error) {
      log.warning(`Problem extracting product details with open graph`, {
        error,
      });
    }

    try {
      ({ found, name, gtin, mpn, price, currency, availability, images } =
        await this.fetchWooCommerceData(page));

      if (found) {
        log.info("Product scraped using WooCommerce data");
        return {
          url: page.url(),
          name: name ? name : undefined,
          gtin: gtin ? gtin : undefined,
          mpn: mpn ? mpn : undefined,
          price: price ? price : undefined,
          currency: currency ? currency : undefined,
          availability: availability ? availability : undefined,
          images,
          specifications: [],
        };
      }
    } catch (error) {
      log.warning(`Problem extracting product details with WooCommerce data`, {
        error,
      });
    }

    throw new Error("Cannot extract price light data");
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    await this.tryHandlePriceComparisionWebsiteRedirectUrl(page);
    const product = await this.fetchProductData(page);

    if (product.availability) {
      product.availability = pascalCaseToSnakeCase(product.availability);
    }

    if (!product.name) {
      throw new IllFormattedPageError("Cannot extract name of product");
    }

    return product;
  }

  static async create(
    launchOptions: CrawlerLaunchOptions
  ): Promise<AutoCrawler> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets(
        launchOptions?.uniqueCrawlerKey
      );

    return new AutoCrawler({
      detailsDataset,
      listingDataset,
      listingUrlSelector: "",
      detailsUrlSelector: "",
      productCardSelector: "",
      cookieConsentSelector: "",
      dynamicProductCardLoading: false,
      launchOptions,
    });
  }
}

function isComparisonWebsite(page: Page) {
  const domain = extractDomainFromUrl(page.url());
  const comparisonWebsiteDomainIncludes = [
    "pricerunner",
    "prisjakt",
    "idealo",
    "google",
  ];

  for (const domainInclude of comparisonWebsiteDomainIncludes) {
    if (domain.includes(domainInclude)) {
      return true;
    }
  }
  return false;
}

export { AutoCrawler };
