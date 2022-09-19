import {prepareForBigQuery} from "../src/publishing";

describe("Conversion for bigquery", () => {
    test("Camel case is correctly converted to snake case", () => {
        const dummyObject = {
            fetchedAt: "value",
            categoryTree: "value",
        }

        const convertedObject = prepareForBigQuery([dummyObject])[0]

        expect(convertedObject).toHaveProperty("fetched_at")
        expect(convertedObject).toHaveProperty("category_tree")
    })
})