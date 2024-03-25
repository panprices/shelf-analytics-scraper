import _ from "lodash";
import { DetailedProductInfo } from "../src/types/offer";

/**
 * Expect two product list to equals.
 * This disregard some irrelevant fields such as fetchedAt.
 * @param result
 * @param expectedResult
 */
export function expectScrapeDetailsResultToEqual(
  result: DetailedProductInfo[],
  expectedResult: DetailedProductInfo[]
) {
  for (let i = 0; i < expectedResult.length; i++) {
    result[i] = _.omit(result[i], ["fetchedAt"]);
    expectedResult[i] = _.omit(expectedResult[i], ["fetchedAt"]);
  }

  expect(result).toEqual(expectedResult);
}

/**
 * Expect two arrays to contain equal values, in any order.
 * @param result
 * @param expectedResult
 */
export function expectToIncludeSameMembers(result, expectedResult) {
  expect(result).toEqual(expect.arrayContaining(expectedResult));
  expect(expectedResult).toEqual(expect.arrayContaining(result));
}
