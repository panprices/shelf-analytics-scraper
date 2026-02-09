import { exploreCategory, scrapeDetails } from "../src/service";
import { ListingProductInfo } from "../src/types/offer";

jest.setTimeout(300000);

test("Category page", async () => {
  const targetUrl = "https://www.venturedesign.se/innemobler/bord/matbord";
  const result = (await exploreCategory(targetUrl, "job_test_1")).map(
    (res) => res.userData as ListingProductInfo
  );

  expect(result).toHaveLength(116);
  expect(result.map((p) => p.popularityCategory)).toEqual(
    Array(116).fill([
      {
        name: "Innemöbler",
        url: "https://www.venturedesign.se/innemobler",
      },
      {
        name: "Bord",
        url: "https://www.venturedesign.se/innemobler/bord",
      },
      {
        name: "Matbord",
        url: "https://www.venturedesign.se/innemobler/bord/matbord",
      },
    ])
  );
});
