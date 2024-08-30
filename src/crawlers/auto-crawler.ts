import {
  AbstractCrawlerDefinition,
  CrawlerDefinitionOptions,
  CrawlerLaunchOptions,
} from "./abstract.js";
import { Locator, Page } from "playwright";
import { DetailedProductInfo, ListingProductInfo } from "../types/offer.js";
import { log } from "crawlee";
import jsonic from "jsonic";
import {
  convertCurrencySymbolToISO,
  extractCountryFromDomain,
  extractDomainFromUrl,
  parsePrice,
  pascalCaseToSnakeCase,
} from "../utils.js";
import { PriceLiteUnavailableError } from "../types/errors.js";
import { AutoCrawlerErrorHandler } from "../error-handling/detail-error-handling/auto.js";

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

export type LiteOfferStrategy =
  | "schema-json"
  | "schema-attributes"
  | "opengraph"
  | "woocommerce";

class AutoCrawler extends AbstractCrawlerDefinition {
  constructor(
    options: CrawlerDefinitionOptions,
    private readonly disabledStrategies: LiteOfferStrategy[] = []
  ) {
    super(options);

    this.__detailPageErrorHandlers = [
      ...this.__detailPageErrorHandlers,
      new AutoCrawlerErrorHandler(),
    ];
  }

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

  private parsePriceFromSafeSource(priceContent: string): number | undefined {
    // check if the string is a properly formatted number with regex
    // `parsePrice` doesn't work well with numbers with exactly 3 decimals so we avoid calling that function
    // if we can certify that the price in schema.org is correctly formatted
    if (priceContent.match(/^[0-9]*\.?[0-9]+$/)) {
      return parseFloat(priceContent);
    }
    return parsePrice(priceContent);
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
        price = parsePrice(content);
        currency = content.replace(/[0-9., ]/g, "");
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
          price = parsePrice(content);
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
    const currentPageUrl = normalizeUrl(page.url());

    const product = findBestMatchingEntry(schemaOrgProducts, currentPageUrl);

    try {
      let offers = product.offers || product.Offers || {};
      if (Array.isArray(offers)) {
        log.info(
          "Multiple offers found, searching for the best matching offer based on URL."
        );
      }
      offers = findBestMatchingEntry(offers, currentPageUrl);

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

      let price =
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

      if (price) {
        if (!Number.isFinite(price)) {
          // price is probably a string so we parse it
          price = this.parsePriceFromSafeSource(price);
        }
      }

      // Stop fetching this to avoid occasional JSON format error in the
      // retailer's website schema.org. And we are not using this property
      // for Price Lite.
      // const tentativeImages = product.image || product.Image || [];
      // const images = Array.isArray(tentativeImages)
      //   ? tentativeImages
      //   : [tentativeImages];

      return {
        found: !!price, // price lite does not make sense is if price is missing from the data
        gtin,
        mpn,
        name: product.name,
        price,
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
    const priceContents: string[] | null = await page
      .$eval(
        "[itemprop='price']",
        (el: Element) => {
          return [el.getAttribute("content"), el.textContent]
            .filter((c) => c !== null)
            .map((e) => e as string);
        },
        null
      )
      .catch(() => null);

    if (priceContents && priceContents.length > 0) {
      price = this.parsePriceFromSafeSource(priceContents[0]) ?? null;
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

    if (priceContents && price && !currency) {
      for (const priceContent of priceContents) {
        if (currency) {
          break;
        }

        const potentialIntegratedCurrency = priceContent?.match(/[A-Za-z€$£]+/);
        if (potentialIntegratedCurrency) {
          currency = potentialIntegratedCurrency[0];
          if (["$", "€", "£"].includes(currency)) {
            currency = convertCurrencySymbolToISO(currency);
          }
        }
      }
    }

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
      gtin: null,
      mpn: null,
      name,
      price,
      currency,
      availability,
      images,
    };
  }

  async fetchWooCommerceData(page: Page): Promise<PriceOffer> {
    // Example page: https://rorbutiken.se/produkt/fmm-9000e-flexi-takduschset-forkromad
    const domain = extractDomainFromUrl(page.url());
    const country = extractCountryFromDomain(domain);

    const priceContent = await page
      .$eval(
        "//div[contains(@class, 'price-wrapper')]" +
          "//span[contains(@class, 'woocommerce-Price-amount') and not(ancestor::*[@aria-hidden='true'])]",
        (el: Element) => {
          return el.textContent || null;
        }
      )
      .catch(() => null);
    if (!priceContent) {
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

    const currencySymbol = await page.$eval(
      ".woocommerce-Price-currencySymbol",
      (e) => e.textContent || null
    );
    const price = parsePrice(priceContent.trim());

    return {
      found: !!price,
      gtin: null,
      mpn: null,
      name: null,
      // Avoid using `parsePriceFromSafeSource` because this field is more likely to contain the price formatted for
      // visualization (including thousands separators, currency etc.)
      price,
      currency: currencySymbol
        ? convertCurrencySymbolToISO(currencySymbol, country)
        : null,
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

    if (!this.disabledStrategies.includes("schema-json")) {
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
    }

    if (!this.disabledStrategies.includes("schema-attributes")) {
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
        log.warning(
          `Problem extracting product details with schema attributes`,
          {
            error,
          }
        );
      }
    }

    if (!this.disabledStrategies.includes("opengraph")) {
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
    }

    if (!this.disabledStrategies.includes("woocommerce")) {
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
        log.warning(
          `Problem extracting product details with WooCommerce data`,
          {
            error,
          }
        );
      }
    }

    throw new PriceLiteUnavailableError("Cannot extract price lite data");
  }

  async extractProductDetails(page: Page): Promise<DetailedProductInfo> {
    await this.tryHandlePriceComparisionWebsiteRedirectUrl(page);
    const product = await this.fetchProductData(page);

    if (product.availability) {
      product.availability = pascalCaseToSnakeCase(product.availability);
    }

    return product;
  }

  static async create(
    launchOptions: CrawlerLaunchOptions,
    disabledStrategies: LiteOfferStrategy[] = []
  ): Promise<AutoCrawler> {
    const [detailsDataset, listingDataset] =
      await AbstractCrawlerDefinition.openDatasets(
        launchOptions?.uniqueCrawlerKey
      );

    return new AutoCrawler(
      {
        detailsDataset,
        listingDataset,
        listingUrlSelector: "",
        detailsUrlSelector: "",
        productCardSelector: "",
        cookieConsentSelector: "",
        dynamicProductCardLoading: false,
        launchOptions,
      },
      disabledStrategies
    );
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

// Helper function to normalize URLs by removing query parameters, decoding entities, etc.
function normalizeUrl(url: string): string {
  try {
    // Decode any encoded characters (like %20 for spaces)
    let normalizedUrl = decodeURIComponent(url);

    // Remove trailing slashes
    normalizedUrl = normalizedUrl.replace(/\/+$/, "");

    return normalizedUrl;
  } catch (error) {
    log.error(`Error normalizing URL: ${url}`, { error });
    return url;
  }
}

/**
 * Tests if urlTest is included in `urlCurrent`.
 *
 * The operation ignores the order of query parameters, and check only if all the parameters of `urlTest` are defined
 * with the same values in `urlCurrent`.
 * @param urlCurrent
 * @param urlTest
 */
function isIncluded(urlCurrent: string, urlTest: string): boolean {
  if (urlCurrent.includes(urlTest)) {
    // if `urlTest` is a substring of `urlCurrent` we don't need to parse the urls
    return true;
  }

  // https://battenhome.co/blabla -> https://battenhome.co
  if (urlTest.startsWith("/")) {
    // If the test URL does not contain the domain, we assume the same domain as the current URL
    urlTest = `${urlCurrent.split("/").slice(0, 3).join("/")}${urlTest}`;
  }

  if (urlCurrent.split("?")[0] !== urlTest.split("?")[0]) {
    // The base query is different, there is no point in looking at the query parameters
    return false;
  }

  const parsedUrlCurrent = new URL(urlCurrent);
  const parsedUrlTest = new URL(urlTest);

  const currentQueryParamsDict = Object.fromEntries(
    parsedUrlCurrent.searchParams.entries()
  );

  for (const [key, value] of parsedUrlTest.searchParams.entries()) {
    if (!currentQueryParamsDict[key] || currentQueryParamsDict[key] !== value) {
      return false;
    }
  }

  return true;
}

/**
 * Find the entry with the closes matching URL.
 *
 * An entry can be either an offer (most common) or a product, when the retailer gives us more than one product in
 * schema.org
 *
 * @param entries
 * @param currentPageUrl
 */
function findBestMatchingEntry<T extends { url: string }>(
  entries: T[],
  currentPageUrl: string
): T {
  // Get the URL of the current page
  let matchingEntry = null;
  let longestMatchLength = 0;
  // Loop through the entries to find the longest URL match within the current page URL
  for (let i = 0; i < entries.length; i++) {
    const entryUrl = entries[i].url;
    if (entryUrl && isIncluded(currentPageUrl, entryUrl)) {
      const matchLength = entryUrl.length;
      // If this match is longer than the previous longest, update the matching offer.
      // The reason for this is that we could have a base URL like amazon.com/flos-lamp
      // match but also have a variant URL like amazon.com/flos-lamp?variant=123 in
      // which case we want to return the second offer since it's the correct one.
      if (matchLength > longestMatchLength) {
        matchingEntry = entries[i];
        longestMatchLength = matchLength;
      }
    }
  }

  if (matchingEntry) {
    return matchingEntry;
  }
  log.info(
    "No matching entry found for the current page URL, assuming the first one."
  );
  return entries[0]; // Default to the first offer if no match is found
}

export { AutoCrawler };
