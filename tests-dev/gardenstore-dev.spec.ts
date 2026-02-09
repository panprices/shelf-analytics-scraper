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

test("Category page", async () => {
  const targetUrl = "https://www.gardenstore.se/utemobler/grupper/matgrupper";
  const result = (await exploreCategory(targetUrl, "job_test_1")).map(
    (res) => res.userData as ListingProductInfo
  );

  expectExploreCategory(result, 44, [
    {
      name: "Utemöbler & Trädgårdsmöbler",
      url: "https://www.gardenstore.se/utemobler",
    },
    {
      name: "Möbelgrupper",
      url: "https://www.gardenstore.se/utemobler/grupper",
    },
    {
      name: "Matgrupper",
      url: "https://www.gardenstore.se/utemobler/grupper/matgrupper",
    },
  ]);
});
