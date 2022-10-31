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
  description: string;
  // inStock: boolean;  DEPRECATED
  availability: string;
  fetchedAt?: string;
  retailerDomain?: string;

  images: string[];
  // categoryTree: Category[];

  reviews: ProductReviews | "unavailable";

  // if not applicable return an empty array
  specifications: Specification[];
  gtin?: string;

  matchingType?: string; // {match, unknown}
}

export interface RequestBatch {
  jobId: string;
  productDetails: RequestOptions[];
}
