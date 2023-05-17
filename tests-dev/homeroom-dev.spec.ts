import { exploreCategory, scrapeDetails } from "../src/service";

jest.setTimeout(300000);

function dummyRequest(targetUrl: string) {
  return {
    url: targetUrl,
    userData: {
      jobId: "job_test_1",
      url: targetUrl,
      popularityIndex: 1,
      label: "DETAIL",
    },
  };
}

test("Category page", async () => {
  const targetUrl = "https://www.homeroom.se/utemobler-tradgard/mobelskydd";
  const result = await exploreCategory(targetUrl, "job_test_1");

  expect(result).toHaveLength(46);
});

test("Product page with colour variants", async () => {
  const targetUrl =
    "https://www.homeroom.se/ellos-home/matgrupp-gilda-med-bord-och-4-stolar/1615854-01";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);

  expect(result).toHaveLength(2);
  expect(result.map((p) => p.images.length)).toEqual([9, 8]);
  expect(result.map((p) => p.isDiscounted)).toEqual([false, false]);
  expect(result.map((p) => p.price)).toEqual([449900, 449900]);
});

test("Poster with size variants", async () => {
  const targetUrl =
    "https://www.homeroom.se/venture-home/poster-circles/1703384-01";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);

  expect(result).toHaveLength(4);
  expect(result.map((p) => p.images.length)).toEqual([2, 2, 2, 2]);
  expect(result.map((p) => p.sku)).toEqual([
    "1703384-01-345",
    "1703384-01-118",
    "1703384-01-136",
    "1703384-01-48",
  ]);
  expect(result.map((p) => p.isDiscounted)).toEqual([
    false,
    false,
    false,
    false,
  ]);
  expect(result.map((p) => p.price)).toEqual([20300, 22100, 32900, 35400]);
  expect(result.map((p) => p.variantGroupUrl)).toEqual([
    "https://www.homeroom.se/venture-home/poster-circles/1703384-01",
    "https://www.homeroom.se/venture-home/poster-circles/1703384-01",
    "https://www.homeroom.se/venture-home/poster-circles/1703384-01",
    "https://www.homeroom.se/venture-home/poster-circles/1703384-01",
  ]);
});

test("Product page with both colour and size variants", async () => {
  const targetUrl =
    "https://www.homeroom.se/venture-home/ullmatta-loump/1675496-01";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);

  expect(result).toHaveLength(4);
  expect(result.map((p) => p.variantGroupUrl)).toEqual([
    "https://www.homeroom.se/venture-home/ullmatta-loump/1675496-01",
    "https://www.homeroom.se/venture-home/ullmatta-loump/1675496-01",
    "https://www.homeroom.se/venture-home/ullmatta-loump/1675496-02",
    "https://www.homeroom.se/venture-home/ullmatta-loump/1675496-02",
  ]);
});

test("Only 1 image", async () => {
  const targetUrl =
    "https://www.homeroom.se/venture-home/mobelskydd-130-210-160-gra/1560334-01";

  const result = await scrapeDetails([dummyRequest(targetUrl)]);
  expect(result).toHaveLength(1);
  expect(result.map((p) => p.images.length)).toEqual([1]);
  expect(result.map((p) => p.sku)).toEqual(["1560334-01-0"]);
});

test("Product page with long description", async () => {
  const targetUrl =
    "https://www.homeroom.se/ellos-home/ullmatta-carezza/1635249-01";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);

  expect(result[0].sku).toEqual("1635249-01");
});
