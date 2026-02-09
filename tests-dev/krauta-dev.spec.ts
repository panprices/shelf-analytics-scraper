import {
  exploreCategory,
  exploreCategoryEndToEnd,
  scrapeDetails,
} from "../src/service";
import { ListingProductInfo } from "../src/types/offer";
import { expectExploreCategory } from "./utils.test";

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

test.only("Category page", async () => {
  const targetUrl =
    "https://www.k-rauta.se/kategori/tradgard-och-fritid/tradgardsmobler/utomhuskok";
  const result = (await exploreCategory(targetUrl, "job_test_1")).map(
    (res) => res.userData as ListingProductInfo
  );

  expectExploreCategory(result, 11, [
    {
      name: "Trädgård & fritid",
      url: "https://www.k-rauta.se/kategori/tradgard-och-fritid",
    },
    {
      name: "Trädgårdsmöbler",
      url: "https://www.k-rauta.se/kategori/tradgard-och-fritid/tradgardsmobler",
    },
    {
      name: "Utomhuskök",
      url: "https://www.k-rauta.se/kategori/tradgard-och-fritid/tradgardsmobler/utomhuskok",
    },
  ]);
});

test("End to end test", async () => {
  const result = await exploreCategoryEndToEnd([
    "https://www.k-rauta.se/kategori/tradgard-och-fritid/tradgardsmobler/utomhuskok",
  ]);
  expect(result).toHaveLength(11);
});
