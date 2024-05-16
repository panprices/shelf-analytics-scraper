import { extractPriceFromPriceText } from "../../../src/crawlers/custom/gigameubel";

test.each([
  ["1.295,00", 1295],
  ["160,20", 160.2],
])("createVariantGroupUrl", (priceText, expectedResult) => {
  expect(extractPriceFromPriceText(priceText)).toBe(expectedResult);
});
