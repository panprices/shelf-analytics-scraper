import { applicationDefault, initializeApp } from "firebase-admin/app";
import { exploreCategory, scrapeDetails } from "../src/service";
import { ListingProductInfo } from "../src/types/offer";

jest.setTimeout(300000);

initializeApp({
  credential: applicationDefault(),
});

function dummyRequest(url: string) {
  return {
    url: url,
    userData: {
      jobId: "job_test_1",
      url: url,
      label: "DETAIL",
    },
  };
}

test("Category page", async () => {
  const url = "https://www.gigameubel.nl/banken/2-zitsbank";
  const result = (await exploreCategory(url, "job_test_1")).map(
    (res) => res.userData as ListingProductInfo
  );

  expect(result).toHaveLength(44);
  expect(result.map((p) => p.popularityCategory)).toEqual(
    Array(44).fill([
      {
        name: "Banken",
        url: "https://www.gigameubel.nl/banken",
      },
      {
        name: "2-zitsbanken",
        url: "https://www.gigameubel.nl/banken/2-zitsbank",
      },
    ])
  );
});

test("Simple product page", async () => {
  const url =
    "https://www.gigameubel.nl/house-nordic-bankje-aveiro-rotan-naturel";
  const result = await scrapeDetails([dummyRequest(url)]);
  expect(result).toHaveLength(1);
  expect(result[0].images.length).toEqual(3);
  expect(result[0].description?.length).toBeGreaterThan(50);
  expect(result[0].specifications?.length).toBeGreaterThan(7);
  expect(result[0].brand).toEqual("House Nordic");
  expect(result[0].gtin).toEqual("05713917024810");
  expect(result[0].price).toEqual(12500);
  expect(result[0].currency).toEqual("EUR");
});

test("Product with discount", async () => {
  const url =
    "https://www.gigameubel.nl/hsm-collection-decoratieve-bank-rondo-120cm-munggur";
  const result = await scrapeDetails([dummyRequest(url)]);
  expect(result).toHaveLength(1);
  expect(result[0].price).toEqual(16020);
  expect(result[0].originalPrice).toEqual(17800);
});

test("1 variant groups - 3 variants", async () => {
  const url =
    "https://www.gigameubel.nl/house-nordic-tafel-toulon-extra-platen";
  const result = await scrapeDetails([dummyRequest(url)]);

  expect(result).toHaveLength(3);
  expect(result.map((p) => p.images.length)).toEqual([2, 1, 1]);
  expect(result.map((p) => p.price)).toEqual([24400, 33900, 33900]);
  expect(result.map((p) => p.variantGroupUrl)).toEqual(
    Array(3).fill(
      "https://www.gigameubel.nl/house-nordic-tafel-toulon-extra-platen"
    )
  );
});

test("2 variant groups - 4 variants", async () => {
  const url =
    "https://www.gigameubel.nl/3-zits-hoekbank-lord-taupe-links-giga-meubel";
  const result = await scrapeDetails([dummyRequest(url)]);

  expect(result).toHaveLength(4);
  expect(result.map((p) => p.variantGroupUrl)).toEqual(
    Array(4).fill(
      "https://www.gigameubel.nl/3-zits-hoekbank-lord-taupe-links-giga-meubel"
    )
  );
});
