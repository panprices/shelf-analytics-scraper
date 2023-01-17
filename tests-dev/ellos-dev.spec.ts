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

// 1 variant groups - 2 variants
test("Simple test", async () => {
  const targetUrl =
    "https://www.ellos.se/venture-home/matgrupp-tempe-med-2st-matstolar-polar/1722582-02";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);

  expect(result).toHaveLength(2);
  expect(result.map((p) => p.images.length)).toEqual([8, 6]);
  expect(result.map((p) => p.isDiscounted)).toEqual([true, true]);
  expect(result.map((p) => p.price)).toEqual([314400, 314400]);
  expect(result.map((p) => p.originalPrice)).toEqual([369900, 369900]);
});
