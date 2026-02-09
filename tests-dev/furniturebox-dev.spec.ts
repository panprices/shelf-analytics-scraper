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
    "https://www.furniturebox.se/mobler/koksmobler/barmobler/barbord";
  const result = (await exploreCategory(targetUrl, "job_test_1")).map(
    (res) => res.userData as ListingProductInfo
  );

  expect(result).toHaveLength(119);
  expect(result.map((p) => p.popularityCategory)).toEqual(
    Array(119).fill([
      {
        name: "Möbler",
        url: "https://www.furniturebox.se/mobler",
      },
      {
        name: "Matplats",
        url: "https://www.furniturebox.se/mobler/koksmobler",
      },
      {
        name: "Barmöbler",
        url: "https://www.furniturebox.se/mobler/koksmobler/barmobler",
      },
      {
        name: "Barbord",
        url: "https://www.furniturebox.se/mobler/koksmobler/barmobler/barbord",
      },
    ])
  );
});

// 1 variant groups - 3 variants
test("Simple test", async () => {
  const targetUrl =
    "https://www.furniturebox.se/mobler/koksmobler/matstolar/altea-matstol-manchester-gra-p338053";

  const result = await scrapeDetails([dummyRequest(targetUrl)]);
  expect(result).toHaveLength(3);
  expect(result.map((p) => p.images.length)).toEqual([3, 3, 3]);
});

// 2 variant groups - 7 variants
test("Simple test", async () => {
  const targetUrl =
    "https://www.furniturebox.se/textilier/mattor/modern-matta/ullmattor/singapore-ullmatta-200x300-ivory-p685751-v340163";

  const result = await scrapeDetails([dummyRequest(targetUrl)]);
  expect(result).toHaveLength(7);
});
