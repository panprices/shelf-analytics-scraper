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

test.only("Category page", async () => {
  const targetUrl =
    "https://www.bygghemma.se/inredning-och-belysning/mobler/soffor/2-sits-soffa";
  const products = (await exploreCategory(targetUrl, "job_test_1")).map(
    (res) => res.userData as ListingProductInfo
  );

  expect(products).toHaveLength(61);
  expect(products.map((p) => p.popularityCategory)).toEqual(
    Array(61).fill([
      {
        name: "Inredning & belysning",
        url: "https://www.bygghemma.se/inredning-och-belysning",
      },
      {
        name: "Möbler",
        url: "https://www.bygghemma.se/inredning-och-belysning/mobler",
      },
      {
        name: "Soffor",
        url: "https://www.bygghemma.se/inredning-och-belysning/mobler/soffor",
      },
      {
        name: "2-sits soffa",
        url: "https://www.bygghemma.se/inredning-och-belysning/mobler/soffor/2-sits-soffa",
      },
    ])
  );
});

test("Product page - choose color", async () => {
  const targetUrl =
    "https://www.bygghemma.se/tradgard-och-utemiljo/utemobler-och-tradgardsmobler/tradgardsbord/aluminiumbord/cafebord-venture-design-denzel/p-750780-750781";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);

  expect(result).toHaveLength(2);
  expect(result.map((res) => res.images.length)).toEqual([16, 2]);
});
test("Product page - choose color (delete later)", async () => {
  const targetUrl =
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-med-bianca-matbord-och-4-annika-matstolar/p-1470147-1468495";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);

  expect(result).toHaveLength(4);
  expect(result.map((res) => res.images.length)).toEqual([3, 3, 3, 3]);
});

test("Product page - choose dropdown", async () => {
  const targetUrl =
    "https://www.bygghemma.se/inredning-och-belysning/hemtextilier/mattor/orientaliska-mattor-och-persiska-mattor/orientalisk-matta-venture-home-cleo/p-1752594-1752598";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);

  expect(result).toHaveLength(3);
});

test("Product page - 2 variants group", async () => {
  const targetUrl =
    "https://www.bygghemma.se/inredning-och-belysning/hemtextilier/sangklader/overkast/overkast-venture-home-lias/p-1563643-1563646";
  const result = await scrapeDetails([dummyRequest(targetUrl)]);

  expect(result).toHaveLength(4);
});
// test("Product page with discount", async () => {
//   const targetUrl =
//     "https://bernomobler.se/products/break-matgrupp-4st-stolar-vit-gra";
//   const result = await scrapeDetails([dummyRequest(targetUrl)]);

//   expect(result).toHaveLength(1);
//   expect(result.map((res) => res.images.length)).toEqual([7]);
//   expect(result.map((p) => p.isDiscounted)).toEqual([true]);
//   expect(result.map((p) => p.price)).toEqual([464000]);
//   expect(result.map((p) => p.originalPrice)).toEqual([580000]);
// });
