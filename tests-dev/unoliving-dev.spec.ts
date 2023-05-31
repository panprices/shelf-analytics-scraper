import { exploreCategory, scrapeDetails } from "../src/service";
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
  const targetUrl = "https://unoliving.com/stuen/sofaer/4-personers-sofaer";
  const result = (await exploreCategory(targetUrl, "job_test_1")).map(
    (res) => res.userData as ListingProductInfo
  );

  expectExploreCategory(result, 69, [
    {
      name: "Stuen",
      url: "https://unoliving.com/stuen",
    },
    {
      name: "Sofaer",
      url: "https://unoliving.com/stuen/sofaer",
    },
    {
      name: "4-personers sofaer",
      url: "https://unoliving.com/stuen/sofaer/4-personers-sofaer",
    },
  ]);
});

test("Simple product page", async () => {
  const targetUrl =
    "https://unoliving.com/padova-positionsstol-hvid-flet-gra-hynde";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);

  expect(result).toHaveLength(1);
  expect(result.map((res) => res.images.length)).toEqual([3]);
});

test("Simple product page", async () => {
  const targetUrl = "https://unoliving.com/logger-spisebord-roget-eg-210x100";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);

  expect(result).toHaveLength(1);
  expect(result.map((res) => res.images.length)).toEqual([7]);
});
