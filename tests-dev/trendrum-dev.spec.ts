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
    },
  };
}

test("Category page", async () => {
  const targetUrl = "https://www.trendrum.se/barbord-cafebord";
  const result = await exploreCategory(targetUrl, "job_test_1");

  expect(result).toHaveLength(55);
});

test("Product page", async () => {
  const targetUrl = "https://www.trendrum.se/tromso-runt-matbord-120-cm-vit-ek";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);
  const product = result[0];

  expect(product.images.length).toEqual(2);
  expect(product.name).toEqual("Tromsö runt matbord 120 cm - Vit / Ek");
  expect(product.price).toEqual(349000);
  expect(product.categoryTree?.length).toEqual(3);
  expect(product.specifications.length).toEqual(2);
});

test("Product page with mpn", async () => {
  const targetUrl = "https://www.trendrum.se/kenya-matbord-220-x-100-cm-teak";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);

  expect(result[0].mpn).toEqual("9526-244");
});

test("With variants", async () => {
  const targetUrl = "https://www.trendrum.se/handvavd-ullmatta-gabbeh-bla";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);

  expect(result.length).toEqual(3);
  expect(result.map((item) => item.images.length)).toEqual([1, 1, 1]);
  expect(result.map((item) => item.name)).toEqual([
    "Handvävd ullmatta Gabbeh - Blå - 140x200 cm",
    "Handvävd ullmatta Gabbeh - Blå - 170x240 cm",
    "Handvävd ullmatta Gabbeh - Blå - 200x300 cm",
  ]);
  expect(result.map((item) => item.price)).toEqual([419000, 549000, 819000]);
  expect(result[0].specifications).toContainEqual({
    key: "Bredd",
    value: "140 cm",
  });
  expect(result[1].specifications).toContainEqual({
    key: "Bredd",
    value: "170 cm",
  });
});
