import { createVariantGroupUrl } from "../../../src/crawlers/custom/bygghemma";

test("createVariantGroupUrl", () => {
  expect(
    createVariantGroupUrl(
      "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-dipp-o115-cm-med-4-berit-stolar/p-1470135-1468458"
    )
  ).toBe(
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-dipp-o115-cm-med-4-berit-stolar/p-1470135"
  );
  expect(
    createVariantGroupUrl(
      "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-dipp-o115-cm-med-4-berit-stolar/p-1470135-1468458/"
    )
  ).toBe(
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-dipp-o115-cm-med-4-berit-stolar/p-1470135"
  );

  expect(
    createVariantGroupUrl(
      "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-dipp-o115-cm-med-4-berit-stolar/p-1470135"
    )
  ).toBe(
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-dipp-o115-cm-med-4-berit-stolar/p-1470135"
  );
});
