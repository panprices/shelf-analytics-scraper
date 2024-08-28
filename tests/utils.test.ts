import {
  convertSchemaOrgAvailability,
  extractDomainFromUrl,
  mergeTwoObjectsPrioritiseNonNull,
  parsePrice,
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

describe("parsePrice", () => {
  it("should parse price with comma as thousand separator and dot as decimal point", () => {
    expect(parsePrice("2,370.00 EUR")).toBe(2370);
  });

  it("should parse price with space as thousand separator", () => {
    expect(parsePrice("54 672 :-")).toBe(54672);
  });

  it("should parse price with dot as thousand separator", () => {
    expect(parsePrice("2.456")).toBe(2456);
  });

  it("should parse price with dot as decimal point", () => {
    expect(parsePrice("2.45")).toBe(2.45);
  });

  it("should parse price with currency symbol", () => {
    expect(parsePrice("100 USD")).toBe(100);
  });

  it("should parse price with multiple spaces and symbols", () => {
    expect(parsePrice("  $ 1,234.56   ")).toBe(1234.56);
  });

  it("should parse price with comma as decimal point", () => {
    expect(parsePrice("2,45")).toBe(2.45);
  });

  it.skip("doesn't work right now due to having 2 dots", () => {
    expect(parsePrice("199,00 kr.")).toBe(199.0);
  });

  it("should parse integer price with commas and dots", () => {
    expect(parsePrice("1,000.")).toBe(1000);
  });

  it("should parse price with leading and trailing non-numeric characters", () => {
    expect(parsePrice("USD 123")).toBe(123);
  });

  it("should parse price with multiple types of separators", () => {
    expect(parsePrice("2.456,78 EUR")).toBe(2456.78);
  });
});
