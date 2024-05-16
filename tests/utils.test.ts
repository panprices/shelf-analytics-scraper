import {
  convertSchemaOrgAvailability,
  extractDomainFromUrl,
  mergeTwoObjectsPrioritiseNonNull,
  pascalCaseToSnakeCase,
} from "../src/utils";

test.each([
  [
    "https://www.homeroom.se/venture-home/kontinentalsang-fjaras-tyg-medium/1651926-03-23",
    "homeroom.se",
  ],
  ["https://ebuy24.dk/shop/765-havebord-rundt-med-2-stole/", "ebuy24.dk"],
])("Extract domain from url: %s", (url, expectedDomain) => {
  expect(extractDomainFromUrl(url)).toEqual(expectedDomain);
});

test.each([
  ["Discontinued", "discontinued"],
  ["InStock", "in_stock"],
  ["OutOfStock", "out_of_stock"],
  ["IHaveAQuestion", "i_have_a_question"],
  ["already_a_snake_case", "already_a_snake_case"],
])("PascalCase to snake_case", (text, expectedResult) => {
  expect(pascalCaseToSnakeCase(text)).toEqual(expectedResult);
});

test.each([
  ["http://schema.org/Discontinued", "discontinued"],
  ["http://schema.org/InStock", "in_stock"],
])("convertSchemaOrgAvailability", (schemaOrgText, expectedResult) => {
  expect(convertSchemaOrgAvailability(schemaOrgText)).toEqual(expectedResult);
});

test.each([
  [
    { name: "Table", price: 1000 },
    { name: undefined, currency: "SEK" },
    { name: "Table", price: 1000, currency: "SEK" },
  ],
  [
    { name: null, price: 1000 },
    { name: "Table", currency: "SEK" },
    { name: "Table", price: 1000, currency: "SEK" },
  ],
  // Should prioritise 2nd object if both have a property
  [
    { name: "Table", price: 1000 },
    { name: "Venture Design Table group", currency: "SEK" },
    { name: "Venture Design Table group", price: 1000, currency: "SEK" },
  ],
])("mergeTwoObjectsPrioritiseNonNull", (obj1, obj2, expectedResult) => {
  console.log(obj1);

  expect(mergeTwoObjectsPrioritiseNonNull(obj1, obj2)).toEqual(expectedResult);
});
