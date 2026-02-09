import { exploreCategory, scrapeDetails } from "../src/service";
import { ProductReviews } from "../src/types/offer";

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
    "https://www.baldai1.lt/minksti-baldai/u-formos-minksti-kampai/";
  const result = await exploreCategory(targetUrl, "job_test_local");

  expect(result).toHaveLength(74);
});

test("Details page", async () => {
  const targetUrl =
    "https://www.baldai1.lt/lauko-baldai/lauko-stalai/lauko-stalas-dallas-3496.html";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);
  expect(result).toHaveLength(1);
  expect(result[0].images).toHaveLength(8);
  expect(result[0].currency).toEqual("EUR");
  expect(result[0].price).toEqual(26700);
  expect(result[0].name).toEqual("Lauko stalas Dallas 3496");
  expect(result[0].sku).toEqual("482522");
  expect(result[0].categoryTree).toHaveLength(2);
});

test("With reviews", async () => {
  const targetUrl =
    "https://www.baldai1.lt/zurnaliniai-staliukai/zurnalinis-staliukas-glendale-101.html";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);
  expect(result).toHaveLength(1);
  expect(result[0].images).toHaveLength(3);

  // @ts-expect-error
  expect(result[0].reviews.averageReview).toEqual(5);
  // @ts-expect-error
  expect(result[0].reviews.reviewCount).toEqual(2);
});

test("1 variant groups - 5 variants", async () => {
  const targetUrl =
    "https://www.baldai1.lt/minksti-baldai/sofos-lovos/sofa-lova-miami-392.html";

  const result = await scrapeDetails([dummyRequest(targetUrl)]);
  expect(result).toHaveLength(5);
  expect(result.map((p) => p.images.length)).toEqual([8, 8, 8, 8, 8]);
  expect(result.map((p) => p.price)).toEqual([
    69700, 69700, 69700, 69700, 69700,
  ]);
});

test("1 variant groups - 2 variants", async () => {
  const targetUrl = "https://www.baldai1.lt/kedes/kede-vg6800.html";

  const result = await scrapeDetails([dummyRequest(targetUrl)]);
  expect(result).toHaveLength(2);
  expect(result.map((p) => p.images.length)).toEqual([5, 5]);
  // Make sure that the images are different
  expect(result[0].images[0]).not.toEqual(result[1].images[0]);
  expect(result.map((p) => p.price)).toEqual([8800, 8800]);
});
