interface OfferMetadata {
    originalPrice?: number
    schemaOrg?: SchemaOrg
}

interface SchemaOrg {
    sku?: string
}

interface Specification {
    key: string
    value: string
}

interface Category {
    name: string
    url: string
}

interface IndividualReview {
    score: number
    content: string
}

interface ProductReviews {
    reviewCount: number,
    averageReview: number,
    recentReviews: IndividualReview[]
}

// TODO: create 2 product models: one scraped from detail page and one scraped from listings

interface BaseProductInfo {
    brand?: string
    name: string
    description?: string
    url: string
    price: number
    currency: string
    isDiscounted: boolean
    popularityIndex?: number

    originalPrice?: number
    sku?: string
    articleNumber?: string
    metadata?: OfferMetadata
}

interface ListingProductInfo extends BaseProductInfo {
    previewImageUrl: string
    popularityIndex: number
    categoryUrl: string
}

interface DetailedProductInfo extends BaseProductInfo {
    description: string

    images: string[]
    categoryTree: Category[]

    reviews: ProductReviews | "unavailable"

    // if not applicable return an empty array
    specifications: Specification[]
}
