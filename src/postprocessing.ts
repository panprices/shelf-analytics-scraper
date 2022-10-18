import { DetailedProductInfo } from "./types/offer";

export function postProcessProductDetails(products: DetailedProductInfo[]) {
  products.forEach((p) => {
    switch (p.currency) {
      // SEK, USD, EUR
      default: {
        p.price = p.price * 100;
      }
    }
  });

  return products;
}
