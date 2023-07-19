import { log } from "crawlee";
import {
  persistProductsToDatabase,
  prepareForBigQuery,
} from "../src/publishing";
import { DetailedProductInfo } from "../src/types/offer";

describe("Test publishing to BigQuery", () => {
  test("Camel case is correctly converted to snake case", () => {
    const dummyObject = {
      fetchedAt: "value",
      categoryTree: "value",
    };
    const convertedObject = prepareForBigQuery([dummyObject])[0];
    expect(convertedObject).toHaveProperty("fetched_at");
    expect(convertedObject).toHaveProperty("category_tree");
  });

  test("Publishing to BigQuery", async () => {
    const today = new Date().toISOString().split("T")[0];
    const jobId = `job_unit_test_${today}`;
    const products: DetailedProductInfo[] = [
      {
        price: 785200,
        isDiscounted: true,
        specifications: [
          { key: "dybdeCm", value: "190" },
          { key: "højdeCm", value: "75" },
          { key: "breddeCm", value: "90" },
          { key: "leveres", value: "Usamlet" },
          {
            key: "materiale",
            value:
              "Bord: Træ, Jern, MDF, Finer. Stol: 20% Polyester, 80% PU kunstlæder, Jern.",
          },
          { key: "sædeDCm", value: "42" },
          { key: "sædeHCm", value: "49" },
          { key: "maxBæreevneKg", value: "200" },
          { key: "eanNummer", value: "6096501318304" },
          { key: "vægt", value: "41.5 kg." },
        ],
        categoryTree: [
          { name: "Shop", url: "https://ebuy24.dk/shop" },
          { name: "Spisestue", url: "https://ebuy24.dk/shop/6-spisestue" },
          {
            name: "Spisebordssæt",
            url: "https://ebuy24.dk/shop/198-spisebordssaet",
          },
          {
            name: "SpisebordssætBordLængde190Cm",
            url: "https://ebuy24.dk/shop/778-spisebordssaet-bord-laengde-190-cm",
          },
        ],
        fetchedAt: "2023-07-14T14:38:32.121Z",
        sku: "GR22333",
        mpn: "GR22333",
        images: [
          "https://shop14872.sfstatic.io/upload_dir/shop/60-GR22333_1.jpg",
          "https://shop14872.sfstatic.io/upload_dir/shop/60-GR22333_2.jpg",
          "https://shop14872.sfstatic.io/upload_dir/shop/60-GR22333_3.jpg",
          "https://shop14872.sfstatic.io/upload_dir/shop/60-GR22333_10.jpg",
          "https://shop14872.sfstatic.io/upload_dir/shop/60-GR22333_11.jpg",
          "https://shop14872.sfstatic.io/upload_dir/shop/60-GR22333_12.jpg",
          "https://shop14872.sfstatic.io/upload_dir/shop/60-GR22333_13.jpg",
          "https://shop14872.sfstatic.io/upload_dir/shop/60-GR22333_14.jpg",
        ],
        availability: "in_stock",
        url: "https://ebuy24.dk/shop/778-spisebordssaet-bord-laengde-190-cm/18213-pippibl-spisebordssaet-spisebord-sort-og-6-kenth-stole-pu-kunstlaeder-sort/",
        popularityIndex: 37,
        originalPrice: 1046900,
        description:
          "PippiBL spisebordssæt spisebord sort og 6 Kenth stole PU kunstlæder sort. Pippi bord 60-15574-888. Bord cm: L190 x D90 x H75. Bord: Træ, Jern, MDF, Finer. Kenth stol 60-15567-458. Antal 6 stk. Stol cm: B40 x H76 x D52. Sædehøjde cm: 48,5. Sædedybde cm: 42. Sædebredde cm: 40. Max vægt kg.: 200. PU kunstlæder. Stol: 20% Polyester, 80% PU kunstlæder, Jern.",
        gtin: "06096501318304",
        name: "PippiBL spisebordssæt spisebord sort og 6 Kenth stole PU kunstlæder sort.",
        currency: "DKK",
        retailerDomain: "ebuy24.dk",
        reviews: undefined,
        popularityCategory: undefined,
      },
    ];
    log.setOptions({
      maxDepth: 10,
    });
    await persistProductsToDatabase(products, jobId);
  });
});
