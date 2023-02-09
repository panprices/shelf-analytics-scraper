import { exploreCategory, scrapeDetails } from "../src/service";

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
  const targetUrl = "https://www.venturedesign.se/innemobler/bord/matbord";
  const result = await exploreCategory(targetUrl, "job_test_1");

  expect(result).toHaveLength(109);
});
