import { RequestOptions } from "crawlee";

export interface OfferMetadata {
  originalPrice?: number;
  schemaOrg?: SchemaOrg;
}

export interface SchemaOrg {
  sku?: string;
  mpn?: string;
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
  brand?: string;
  name: string;
  description?: string;
  url: string;
  price: number;
  currency: string;
  isDiscounted: boolean;
  popularityIndex?: number;
  categoryTree?: Category[];

  originalPrice?: number;
  gtin?: string;
  sku?: string;
  articleNumber?: string;
  metadata?: OfferMetadata;
}

export interface ListingProductInfo extends BaseProductInfo {
  previewImageUrl: string;
  popularityIndex: number;
  categoryUrl: string;
}

export interface DetailedProductInfo extends BaseProductInfo {
  availability: string;
  fetchedAt?: string;
  retailerDomain?: string;

  images: string[]; // if not applicable return an empty array
  reviews: ProductReviews | "unavailable";
  specifications: Specification[]; // if not applicable return an empty array

  matchingType?: string; // {match, unknown}
  productGroupUrl?: string;
  variant?: number; // 0, 1, 2, 3, ...
}

export interface JobContext {
  jobId: string;
  env: string;
}
export interface RequestBatch {
  productDetails: RequestOptions[];
  jobContext: JobContext;
}
