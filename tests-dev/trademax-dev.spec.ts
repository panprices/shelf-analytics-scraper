import { applicationDefault, initializeApp } from "firebase-admin/app";
import { exploreCategory, scrapeDetails } from "../src/service";
import { ListingProductInfo } from "../src/types/offer";

jest.setTimeout(300000);

initializeApp({
  credential: applicationDefault(),
});

function dummyRequest(targetUrl: string) {
  return {
    url: targetUrl,
    userData: {
      jobId: "job_test_1",
      url: targetUrl,
      label: "DETAIL",
    },
  };
}

test("Category page", async () => {
  const targetUrl =
    "https://www.trademax.se/utem%C3%B6bler/solskydd/parasoll/parasollfot";
  const result = (await exploreCategory(targetUrl, "job_test_1")).map(
    (res) => res.userData as ListingProductInfo
  );

  expect(result).toHaveLength(61);
  expect(result.map((p) => p.popularityCategory)).toEqual(
    Array(61).fill([
      {
        name: "Utemöbler",
        url: "https://www.trademax.se/utem%C3%B6bler",
      },
      {
        name: "Solskydd",
        url: "https://www.trademax.se/utem%C3%B6bler/solskydd",
      },
      {
        name: "Parasoll",
        url: "https://www.trademax.se/utem%C3%B6bler/solskydd/parasoll",
      },
      {
        name: "Parasollfot",
        url: "https://www.trademax.se/utem%C3%B6bler/solskydd/parasoll/parasollfot",
      },
    ])
  );
});

test("Simple product page", async () => {
  const targetUrl =
    "https://www.trademax.se/utem%C3%B6bler/solskydd/parasoll/leeds-parasoll-300-cm-vitsvart-venture-home-p709439";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);
  expect(result).toHaveLength(1);
  expect(result[0].images.length).toEqual(6);
});

test("1 variant groups - 3 variants", async () => {
  const targetUrl =
    "https://www.trademax.se/m%C3%B6bler/soffor/soffgrupp/chesterfield-soffgrupp/chesterfield-lyx-soffgrupp-3-sits-2-sits-f%C3%A5t%C3%B6lj-sammet-m%C3%B6rkgr%C3%A5-p600918-v272307";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);

  expect(result).toHaveLength(3);
  expect(result.map((p) => p.images.length)).toEqual([5, 5, 5]);
  expect(result.map((p) => p.price)).toEqual([1699900, 1699900, 1699900]);
});

test("Variants in sidebar - 5 variants", async () => {
  const targetUrl =
    "https://www.trademax.se/heminredning/v%C3%A4ggdekor/tapet/fototapet/fototapet-vatten-droppar-p%C3%A5-flaska-%C3%B6l-350x270-artgeist-sp-z-o-o-p558710-v334951";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);

  expect(result).toHaveLength(5);
  expect(result.map((p) => p.images.length)).toEqual([4, 4, 4, 4, 4]);
});

test("2 variant groups - 24 variants", async () => {
  const targetUrl =
    "https://www.trademax.se/textilier/mattor/modern-matta/viskosmattor/sikotar-viskos-look-matta-250x350-silver-p1698030-v452113";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);

  expect(result).toHaveLength(24);
  expect(result[0].images.length).toEqual(10);
});
