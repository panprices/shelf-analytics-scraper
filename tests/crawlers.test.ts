import {
  extractASINFromUrl,
  normalizeAmazonUrl,
} from "../src/crawlers/custom/amazon";

// Normally these tests would go under tests/crawlers/custom/amazon.test.ts,
// but since the tests in the /crawler folder are not working well at the moment,
// Toan has moved them here for now.
describe("extractASINFromUrl", () => {
  test.each([
    ["https://www.amazon.com/dp/B08P3S7P6K", "B08P3S7P6K"],
    [
      "https://www.amazon.de/-/en/Venture-Home-1007-331-Polyether-Cushion/dp/B09Y6198Y4",
      "B09Y6198Y4",
    ],
    [
      "https://www.amazon.de/-/en/Venture-Fleece-table-plywood-steel/dp/B0BQ3VBVQF/ref=sr_1_1?crid=3T5VV4Z8LJ9NG&keywords=7340206996688&qid=1687165850&sprefix=7340206996688%2Caps%2C102&sr=8-1",
      "B0BQ3VBVQF",
    ],
    [
      "https://www.amazon.de/-/en/Venture-Fleece-table-plywood-steel/dp/B0BQ3VBVQF?ref=sr_1_1",
      "B0BQ3VBVQF",
    ],
  ])("Extract ASIN from a valid Amazon product URL", (url, expectedASIN) => {
    const asin = extractASINFromUrl(url);
    expect(asin).toEqual(expectedASIN);
  });
});

describe("standardiseAmazonUrl", () => {
  test.each([
    [
      "https://www.amazon.de/dp/B08P3S7P6K",
      "https://www.amazon.de/-/en/dp/B08P3S7P6K",
    ],
    [
      "https://www.amazon.de/-/en/Venture-Home-1007-331-Polyether-Cushion/dp/B09Y6198Y4",
      "https://www.amazon.de/-/en/dp/B09Y6198Y4",
    ],
    [
      "https://www.amazon.de/-/en/Venture-Fleece-table-plywood-steel/dp/B0BQ3VBVQF/ref=sr_1_1?crid=3T5VV4Z8LJ9NG&keywords=7340206996688&qid=1687165850&sprefix=7340206996688%2Caps%2C102&sr=8-1",
      "https://www.amazon.de/-/en/dp/B0BQ3VBVQF",
    ],
    // Amazon US
    [
      "https://www.amazon.com/Gimars-Memory-Keyboard-Support-Computer/dp/B01M11FLUJ/ref=pd_ci_mcx_mh_mcx_views_0",
      "https://www.amazon.com/-/en/dp/B01M11FLUJ",
    ],
  ])("Extract ASIN from a valid Amazon product URL", (url, expectedResult) => {
    const newUrl = normalizeAmazonUrl(url);
    expect(newUrl).toEqual(expectedResult);
  });
});
