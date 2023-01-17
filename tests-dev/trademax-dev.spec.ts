import { scrapeDetails } from "../src/service";

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

// Simple page
test("Simple test", async () => {
  const targetUrl =
    "https://www.trademax.se/utem%C3%B6bler/solskydd/parasoll/leeds-parasoll-300-cm-vitsvart-venture-home-p709439";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);
  expect(result).toHaveLength(1);
  expect(result[0].images.length).toEqual(6);
});

// 1 variant groups - 3 variants
test("Simple test", async () => {
  const targetUrl =
    "https://www.trademax.se/m%C3%B6bler/soffor/soffgrupp/chesterfield-soffgrupp/chesterfield-lyx-soffgrupp-3-sits-2-sits-f%C3%A5t%C3%B6lj-sammet-m%C3%B6rkgr%C3%A5-p600918-v272307";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);

  expect(result).toHaveLength(3);
  expect(result.map((p) => p.images.length)).toEqual([5, 5, 5]);
  expect(result.map((p) => p.price)).toEqual([2349900, 2349900, 2349900]);
});

// Variants in sidebar - 5 variants
test("Simple test", async () => {
  const targetUrl =
    "https://www.trademax.se/heminredning/v%C3%A4ggdekor/tapet/fototapet/fototapet-vatten-droppar-p%C3%A5-flaska-%C3%B6l-350x270-artgeist-sp-z-o-o-p558710-v334951";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);

  expect(result).toHaveLength(5);
  expect(result.map((p) => p.images.length)).toEqual([4, 4, 4, 4, 4]);
});

// 2 variant groups - 24 variants
test("Simple test", async () => {
  const targetUrl =
    "https://www.trademax.se/textilier/mattor/modern-matta/viskosmattor/sikotar-viskos-look-matta-250x350-silver-p1698030-v452113";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);

  expect(result).toHaveLength(24);
  expect(result[0].images.length).toEqual(4);
});
