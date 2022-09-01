import {scrapeDetails} from "../src/service";
import {persistProductsToDatabase} from "../src/publishing";

jest.mock("../src/publishing")

describe("Homeroom details page", () => {
    test("Mock publishing to database", () => {
        const mockedPublishing = jest.mocked(persistProductsToDatabase, true)

        persistProductsToDatabase({
            total: 10,
            count: 1,
            offset: 0,
            limit: 1,
            items: [
                {
                    field: "dummy"
                }
            ]
        })
        expect(mockedPublishing.mock).toBeDefined()
        expect(mockedPublishing.mock.calls).toHaveLength(1)
    })
    test("Basic information is retrieved correctly", () => {
        const targetUrl = "https://www.homeroom.se/venture-home/matgrupp-polar-bord-med-4st-valleta-stolar/1577644-01"
        const dummyRequest = {
            url: targetUrl,
            userData: {
                url: targetUrl,
                brand: 'Venture Home',
                popularityIndex: 1,
                name: "Matgrupp Polar bord med 4st Penally stolar",
                label: "DETAIL"
            }
        }
        const mockedPublishing = jest.mocked(persistProductsToDatabase, true)

        scrapeDetails([dummyRequest])
    })
})