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

export interface BaseProductInfo {
  name: string;
  url: string;

  brand?: string;
  description?: string;
  price?: number;
  currency?: string;
  isDiscounted?: boolean;
  originalPrice?: number;

  gtin?: string;
  sku?: string;
  mpn?: string;

  popularityIndex?: number;
  categoryUrl?: string;
  categoryTree?: Category[];

  metadata?: OfferMetadata;
}

export interface ListingProductInfo extends BaseProductInfo {
  previewImageUrl?: string;
  popularityIndex: number;
  categoryUrl: string;
}

export interface DetailedProductInfo extends BaseProductInfo {
  price: number;
  currency: string;
  isDiscounted: boolean;

  availability: string;
  fetchedAt?: string;
  retailerDomain?: string;

  images: string[]; // if not applicable return an empty array
  reviews?: ProductReviews | "unavailable";
  specifications: Specification[]; // if not applicable return an empty array

  //categoryTree is only optional if we already scraped it in the category page.

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
