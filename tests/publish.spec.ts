import {prepareForBigQuery} from "../src/publishing";

describe("Conversion for bigquery", () => {
    test("Camel case is correctly converted to snake case", () => {
        const dummyObject = {
            simpleWord: "value",
            repeatingStartSymbol: "value",
            abcAbcAbc: "value"
        }

        const convertedObject = prepareForBigQuery([dummyObject])[0]

        expect(convertedObject).toHaveProperty("simple_word")
        expect(convertedObject).toHaveProperty("repeating_start_symbol")
        expect(convertedObject).toHaveProperty("abc_abc_abc")
    })
})