import { extractDomain } from "../src/utils";

test.each([
  [
    "https://www.homeroom.se/venture-home/kontinentalsang-fjaras-tyg-medium/1651926-03-23",
    "homeroom.se",
  ],
  ["https://ebuy24.dk/shop/765-havebord-rundt-med-2-stole/", "ebuy24.dk"],
])("Extract domain from url: %s", (url, expectedDomain) => {
  expect(extractDomain(url)).toEqual(expectedDomain);
});
