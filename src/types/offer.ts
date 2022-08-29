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

// TODO: create 2 product models: one scraped from detail page and one scraped from listings

interface ProductInfo {
    brand: string | null
    name: string | null
    description?: string | null
    url: string
    categoryUrl?: string
    price: number
    currency: string
    isDiscounted: boolean
    popularityIndex: number
    images?: string[]
    categoryTree?: Category[]

    originalPrice?: number
    sku?: string | null
    metadata?: OfferMetadata
    specifications?: Specification[]
}
