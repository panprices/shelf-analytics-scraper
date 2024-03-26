import { createVariantGroupUrl } from "../../../src/crawlers/custom/bygghemma";

test.each([
  [
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-dipp-o115-cm-med-4-berit-stolar/p-1470135-1468458",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-dipp-o115-cm-med-4-berit-stolar/p-1470135",
  ],
  [
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-dipp-o115-cm-med-4-berit-stolar/p-1470135-1468458/",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-dipp-o115-cm-med-4-berit-stolar/p-1470135",
  ],
  [
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-dipp-o115-cm-med-4-berit-stolar/p-1470135",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-dipp-o115-cm-med-4-berit-stolar/p-1470135",
  ],
])("createVariantGroupUrl", (url, expectedResult) => {
  expect(createVariantGroupUrl(url)).toBe(expectedResult);
});
