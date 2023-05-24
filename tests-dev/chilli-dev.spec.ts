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
    },
  };
}

test("Category page", async () => {
  const targetUrl =
    "https://www.chilli.se/m%C3%B6bler/barnm%C3%B6bler/barnbord";
  const result = (await exploreCategory(targetUrl, "job_test_1")).map(
    (res) => res.userData as ListingProductInfo
  );

  expect(result).toHaveLength(98);
  expect(result.map((p) => p.popularityCategory)).toEqual(
    Array(98).fill([
      {
        name: "Möbler",
        url: "https://www.chilli.se/m%C3%B6bler",
      },
      {
        name: "Barnmöbler",
        url: "https://www.chilli.se/m%C3%B6bler/barnm%C3%B6bler",
      },
      {
        name: "Barnbord",
        url: "https://www.chilli.se/m%C3%B6bler/barnm%C3%B6bler/barnbord",
      },
    ])
  );
});

test("Simple product page", async () => {
  const targetUrl =
    "https://www.chilli.se/m%C3%B6bler/soffor/soffgrupp/soffgrupp-walton-lyx-3-sits-2-sits-f%C3%A5t%C3%B6lj-sammet-m%C3%B6rkgr%C3%A5-p600918-v272307";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);
  expect(result).toHaveLength(3);
  expect(result.map((p) => p.images.length)).toEqual([5, 5, 5]);
});
