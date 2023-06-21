import { PlaywrightCrawlerOptions, RequestOptions } from "crawlee";
import { CrawlerLaunchOptions } from "../crawlers/abstract";

export interface OfferMetadata {
  originalPrice?: number;
  schemaOrg?: SchemaOrg;
}

export interface SchemaOrg {
  brand?: string;
  sku?: string;
  gtin?: string;
  mpn?: string;
  image?: string[];
}

export interface Specification {
  key: string;
  value: string;
}

export interface Category {
  name: string;
  url: string;
}

export interface IndividualReview {
  score: number;
  content: string;
}

export interface ProductReviews {
  reviewCount: number;
  averageReview: number;
  recentReviews: IndividualReview[];
}

export enum Availability {
  InStock = "in_stock",
  OutOfStock = "out_of_stock",
}

export interface BaseProductInfo {
  name: string;
  url: string;

  brand?: string;
  description?: string;
  price?: number;
  currency?: string;
  originalPrice?: number;
  isDiscounted?: boolean;

  gtin?: string;
  sku?: string;
  mpn?: string;

  popularityIndex?: number;
  popularityCategory?: Category[];
  categoryUrl?: string;
  categoryTree?: Category[];

  fetchedAt?: string;
  retailerDomain?: string;

  metadata?: OfferMetadata;
}

export interface ListingProductInfo extends BaseProductInfo {
  previewImageUrl?: string;
  categoryUrl: string;
}

export interface DetailedProductInfo extends BaseProductInfo {
  availability: string;

  images: string[]; // if not applicable return an empty array
  reviews?: ProductReviews | "unavailable";
  specifications: Specification[]; // if not applicable return an empty array

  // categoryTree: Category[]; is only optional if we already scraped it in the category page.

  matchingType?: string; // {match, unknown}
  variantGroupUrl?: string;
  variant?: number; // 0, 1, 2, 3, ...
}

export interface JobContext {
  jobId: string;
  env: string;
  skipPublishing?: boolean;
  scraperCategoryPage?: string; // "{playwright, cheerio}"
  scraperProductPage?: string; // "{playwright, cheerio}"
}

export interface RequestBatch {
  productDetails: RequestOptions[];
  jobContext: JobContext;
  launchOptions?: CrawlerLaunchOptions;
  overrides?: PlaywrightCrawlerOptions;
}

export interface RequestCategoryExploration extends RequestOptions {
  jobContext: JobContext;
}

export interface RequestSearch extends RequestOptions {
  /** The query used to search, such as GTIN or SKU of a product. */
  query: string;
  /** E.g. amazon.de */
  retailer: string;

  jobContext: JobContext;
}
