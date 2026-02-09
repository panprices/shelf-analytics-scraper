import { cleanUpBrandName } from "../../../src/crawlers/custom/norliving";

test.each([
  ["Margit Brandt eget lager", "Margit Brandt"],
  ["Margit Brandt - eget lager", "Margit Brandt"],
  ["Eget lager - Venture design", "Venture design"],
  ["EGET LAGER - Specktrum", "Specktrum"],
])("cleanUpBrandName", (brandName, expectedResult) => {
  expect(cleanUpBrandName(brandName)).toEqual(expectedResult);
});
