import { exploreCategory, scrapeDetails } from "../src/service";
import { ListingProductInfo } from "../src/types/offer";

jest.setTimeout(300000);

function dummyRequest(targetUrl: string) {
  return {
    url: targetUrl,
    userData: {
      jobId: "job_test_1",
      url: targetUrl,
      popularityIndex: 1,
      label: "DETAIL",

      categoryUrl: "https://bernomobler.se/collections/rektangulara-matbord",
    },
  };
}

test("Category page", async () => {
  const targetUrl = "https://bernomobler.se/collections/runda-matbord";
  const result = (await exploreCategory(targetUrl, "job_test_1")).map(
    (res) => res.userData as ListingProductInfo
  );

  expect(result).toHaveLength(112);
  expect(result.map((p) => p.popularityCategory)).toEqual(
    Array(112).fill([
      {
        name: "Matrum",
        url: "https://bernomobler.se/collections/matrum",
      },
      {
        name: "Runda matbord",
        url: "https://bernomobler.se/collections/runda-matbord",
      },
    ])
  );
});

test("Basic product page", async () => {
  const targetUrl =
    "https://bernomobler.se/products/rise-avlastningsbord-dubbel-teak-look-svart";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);

  expect(result).toHaveLength(1);
  expect(result.map((res) => res.images.length)).toEqual([4]);
  expect(result.map((p) => p.isDiscounted)).toEqual([false]);
  expect(result.map((p) => p.price)).toEqual([141900]);
  expect(result[0].name).toEqual("Rise avlastningsbord");
  expect(result[0].description?.length).toBeGreaterThan(500);
});

test("Product page with discount", async () => {
  const targetUrl =
    "https://bernomobler.se/products/break-matgrupp-4st-stolar-vit-gra";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);

  expect(result).toHaveLength(1);
  expect(result.map((res) => res.images.length)).toEqual([7]);
  expect(result.map((p) => p.isDiscounted)).toEqual([true]);
  expect(result.map((p) => p.price)).toEqual([464000]);
  expect(result.map((p) => p.originalPrice)).toEqual([580000]);
});
