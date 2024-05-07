import { extractDomainFromUrl, pascalCaseToSnakeCase } from "../src/utils";

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
