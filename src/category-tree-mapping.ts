/*
Hard coded categoryTree for when we cannot scrape category from neither product page nor category page. Namely for the retailer Berno Mobler.
*/

import { log } from "crawlee";
import { Category } from "./types/offer";

export function findCategoryTree(categoryUrl: string): Category[] {
  categoryUrl = categoryUrl.split("?")[0];
  const categoryTree = categoryTreeMapping[categoryUrl];
  if (!categoryTree) {
    log.error(`Cannot find categoryTree for category '${categoryUrl}'`);
    return [];
  }
  return categoryTree;
}

const categoryTreeMapping = {
  "https://bernomobler.se/collections/2-sits-soffa": [
    {
      name: "Vardagsrum",
      url: "https://bernomobler.se/collections/vardsgsrum",
    },
    {
      name: "2-sits soffa",
      url: "https://bernomobler.se/collections/2-sits-soffa",
    },
  ],
  "https://bernomobler.se/collections/3-sits-soffa": [
    {
      name: "Vardagsrum",
      url: "https://bernomobler.se/collections/vardsgsrum",
    },
    {
      name: "3-sits soffa",
      url: "https://bernomobler.se/collections/3-sits-soffa",
    },
  ],
  "https://bernomobler.se/collections/4-sits-soffa": [
    {
      name: "Vardagsrum",
      url: "https://bernomobler.se/collections/vardsgsrum",
    },
    {
      name: "4-sits soffa",
      url: "https://bernomobler.se/collections/4-sits-soffa",
    },
  ],
  "https://bernomobler.se/collections/hornsoffa": [
    {
      name: "Vardagsrum",
      url: "https://bernomobler.se/collections/vardsgsrum",
    },
    {
      name: "Hörnsoffa",
      url: "https://bernomobler.se/collections/hornsoffa",
    },
  ],
  "https://bernomobler.se/collections/baddsoffa": [
    {
      name: "Vardagsrum",
      url: "https://bernomobler.se/collections/vardsgsrum",
    },
    {
      name: "Bäddsoffa",
      url: "https://bernomobler.se/collections/baddsoffa",
    },
  ],
  "https://bernomobler.se/collections/reclinersoffa": [
    {
      name: "Vardagsrum",
      url: "https://bernomobler.se/collections/vardsgsrum",
    },
    {
      name: "Reclinersoffa",
      url: "https://bernomobler.se/collections/reclinersoffa",
    },
  ],
  "https://bernomobler.se/collections/farskinnsfatolj": [
    {
      name: "Vardagsrum",
      url: "https://bernomobler.se/collections/vardsgsrum",
    },
    {
      name: "Fårskinnsfåtölj",
      url: "https://bernomobler.se/collections/farskinnsfatolj",
    },
  ],
  "https://bernomobler.se/collections/fatolj-med-fotpall": [
    {
      name: "Vardagsrum",
      url: "https://bernomobler.se/collections/vardsgsrum",
    },
    {
      name: "Fåtölj med fotpall",
      url: "https://bernomobler.se/collections/fatolj-med-fotpall",
    },
  ],
  "https://bernomobler.se/collections/reclinerfatolj": [
    {
      name: "Vardagsrum",
      url: "https://bernomobler.se/collections/vardsgsrum",
    },
    {
      name: "Reclinerfåtölj",
      url: "https://bernomobler.se/collections/reclinerfatolj",
    },
  ],
  "https://bernomobler.se/collections/fatolj-med-el-funktion": [
    {
      name: "Vardagsrum",
      url: "https://bernomobler.se/collections/vardsgsrum",
    },
    {
      name: "Fåtölj med el-funktion",
      url: "https://bernomobler.se/collections/fatolj-med-el-funktion",
    },
  ],
  "https://bernomobler.se/collections/lift-up-fatolj": [
    {
      name: "Vardagsrum",
      url: "https://bernomobler.se/collections/vardsgsrum",
    },
    {
      name: "Lift-up fåtölj",
      url: "https://bernomobler.se/collections/lift-up-fatolj",
    },
  ],
  "https://bernomobler.se/collections/sittpuffar-och-fotpallar": [
    {
      name: "Vardagsrum",
      url: "https://bernomobler.se/collections/vardsgsrum",
    },
    {
      name: "Sittpuffar och fotpallar",
      url: "https://bernomobler.se/collections/sittpuffar-och-fotpallar",
    },
  ],
  "https://bernomobler.se/collections/skinnfatolj": [
    {
      name: "Vardagsrum",
      url: "https://bernomobler.se/collections/vardsgsrum",
    },
    {
      name: "Skinnfåtölj",
      url: "https://bernomobler.se/collections/skinnfatolj",
    },
  ],
  "https://bernomobler.se/collections/ovriga-fatoljer": [
    {
      name: "Vardagsrum",
      url: "https://bernomobler.se/collections/vardsgsrum",
    },
    {
      name: "Övriga fåtöljer",
      url: "https://bernomobler.se/collections/ovriga-fatoljer",
    },
  ],
  "https://bernomobler.se/collections/soffbord": [
    {
      name: "Vardagsrum",
      url: "https://bernomobler.se/collections/vardsgsrum",
    },
    {
      name: "Soffbord",
      url: "https://bernomobler.se/collections/soffbord",
    },
  ],
  "https://bernomobler.se/collections/satsbord": [
    {
      name: "Vardagsrum",
      url: "https://bernomobler.se/collections/vardsgsrum",
    },
    {
      name: "Satsbord",
      url: "https://bernomobler.se/collections/satsbord",
    },
  ],
  "https://bernomobler.se/collections/smabord": [
    {
      name: "Vardagsrum",
      url: "https://bernomobler.se/collections/vardsgsrum",
    },
    {
      name: "Småbord",
      url: "https://bernomobler.se/collections/smabord",
    },
  ],
  "https://bernomobler.se/collections/avlastningsbord": [
    {
      name: "Matrum",
      url: "https://bernomobler.se/collections/matrum",
    },
    {
      name: "Avlastningsbord",
      url: "https://bernomobler.se/collections/avlastningsbord",
    },
  ],
  "https://bernomobler.se/collections/sido-och-lampbord": [
    {
      name: "Utemöbler",
      url: "https://bernomobler.se/collections/utemobler",
    },
    {
      name: "Sidobord",
      url: "https://bernomobler.se/collections/sido-och-lampbord",
    },
  ],
  "https://bernomobler.se/collections/barbord": [
    {
      name: "Matrum",
      url: "https://bernomobler.se/collections/matrum",
    },
    {
      name: "Barbord",
      url: "https://bernomobler.se/collections/barbord",
    },
  ],
  "https://bernomobler.se/collections/mediabankar": [
    {
      name: "Vardagsrum",
      url: "https://bernomobler.se/collections/vardsgsrum",
    },
    {
      name: "Mediabänkar",
      url: "https://bernomobler.se/collections/mediabankar",
    },
  ],
  "https://bernomobler.se/collections/vitrinskap": [
    {
      name: "Matrum",
      url: "https://bernomobler.se/collections/matrum",
    },
    {
      name: "Vitrinskåp",
      url: "https://bernomobler.se/collections/vitrinskap",
    },
  ],
  "https://bernomobler.se/collections/sideboards": [
    {
      name: "Vardagsrum",
      url: "https://bernomobler.se/collections/vardsgsrum",
    },
    {
      name: "Sideboards",
      url: "https://bernomobler.se/collections/sideboards",
    },
  ],
  "https://bernomobler.se/collections/skap": [
    {
      name: "Vardagsrum",
      url: "https://bernomobler.se/collections/vardsgsrum",
    },
    {
      name: "Skåp",
      url: "https://bernomobler.se/collections/skap",
    },
  ],
  "https://bernomobler.se/collections/rektangulara-matgrupper": [
    {
      name: "Matrum",
      url: "https://bernomobler.se/collections/matrum",
    },
    {
      name: "Rektangulära matgrupper",
      url: "https://bernomobler.se/collections/rektangulara-matgrupper",
    },
  ],
  "https://bernomobler.se/collections/runda-matgrupper": [
    {
      name: "Matrum",
      url: "https://bernomobler.se/collections/matrum",
    },
    {
      name: "Runda matgrupper",
      url: "https://bernomobler.se/collections/runda-matgrupper",
    },
  ],
  "https://bernomobler.se/collections/ovala-matgrupper": [
    {
      name: "Utemöbler",
      url: "https://bernomobler.se/collections/utemobler",
    },
    {
      name: "Ovala matgrupper",
      url: "https://bernomobler.se/collections/ovala-matgrupper",
    },
  ],
  "https://bernomobler.se/collections/rektangulara-matbord": [
    {
      name: "Matrum",
      url: "https://bernomobler.se/collections/matrum",
    },
    {
      name: "Rektangulära matbord",
      url: "https://bernomobler.se/collections/rektangulara-matbord",
    },
  ],
  "https://bernomobler.se/collections/runda-matbord": [
    {
      name: "Matrum",
      url: "https://bernomobler.se/collections/matrum",
    },
    {
      name: "Runda matbord",
      url: "https://bernomobler.se/collections/runda-matbord",
    },
  ],
  "https://bernomobler.se/collections/klaffbord": [
    {
      name: "Matrum",
      url: "https://bernomobler.se/collections/matrum",
    },
    {
      name: "Klaffbord",
      url: "https://bernomobler.se/collections/klaffbord",
    },
  ],
  "https://bernomobler.se/collections/ovala-matbord": [
    {
      name: "Matrum",
      url: "https://bernomobler.se/collections/matrum",
    },
    {
      name: "Ovala matbord",
      url: "https://bernomobler.se/collections/ovala-matbord",
    },
  ],
  "https://bernomobler.se/collections/tillagg": [
    {
      name: "Matrum",
      url: "https://bernomobler.se/collections/matrum",
    },
    {
      name: "Tillägg",
      url: "https://bernomobler.se/collections/tillagg",
    },
  ],
  "https://bernomobler.se/collections/stolar/Karmstolar": [
    {
      name: "Matrum",
      url: "https://bernomobler.se/collections/matrum",
    },
    {
      name: "Karmstolar",
      url: "https://bernomobler.se/collections/stolar/Karmstolar",
    },
  ],
  "https://bernomobler.se/collections/pinnstolar": [
    {
      name: "Matrum",
      url: "https://bernomobler.se/collections/matrum",
    },
    {
      name: "Pinnstolar",
      url: "https://bernomobler.se/collections/pinnstolar",
    },
  ],
  "https://bernomobler.se/collections/barstolar": [
    {
      name: "Matrum",
      url: "https://bernomobler.se/collections/matrum",
    },
    {
      name: "Barstolar",
      url: "https://bernomobler.se/collections/barstolar",
    },
  ],
  "https://bernomobler.se/collections/loungestolar": [
    {
      name: "Matrum",
      url: "https://bernomobler.se/collections/matrum",
    },
    {
      name: "Loungestolar",
      url: "https://bernomobler.se/collections/loungestolar",
    },
  ],
  "https://bernomobler.se/collections/stolar/Pallar-och-sittb%C3%A4nkar": [
    {
      name: "Matrum",
      url: "https://bernomobler.se/collections/matrum",
    },
    {
      name: "Pallar och sittbänkar",
      url: "https://bernomobler.se/collections/stolar/Pallar-och-sittb%C3%A4nkar",
    },
  ],
  "https://bernomobler.se/collections/matstolar-1": [
    {
      name: "Matrum",
      url: "https://bernomobler.se/collections/matrum",
    },
    {
      name: "Matstolar",
      url: "https://bernomobler.se/collections/matstolar-1",
    },
  ],
  "https://bernomobler.se/collections/skap-och-forvaring/Sk%C3%A5p": [
    {
      name: "Matrum",
      url: "https://bernomobler.se/collections/matrum",
    },
    {
      name: "Skåp",
      url: "https://bernomobler.se/collections/skap-och-forvaring/Sk%C3%A5p",
    },
  ],
  "https://bernomobler.se/collections/skap-och-forvaring/Sideboards": [
    {
      name: "Matrum",
      url: "https://bernomobler.se/collections/matrum",
    },
    {
      name: "Sideboards",
      url: "https://bernomobler.se/collections/skap-och-forvaring/Sideboards",
    },
  ],
  "https://bernomobler.se/collections/skap-och-forvaring/Bokhyllor-och-v%C3%A4gghyllor":
    [
      {
        name: "Matrum",
        url: "https://bernomobler.se/collections/matrum",
      },
      {
        name: "Bokhyllor och vägghyllor",
        url: "https://bernomobler.se/collections/skap-och-forvaring/Bokhyllor-och-v%C3%A4gghyllor",
      },
    ],
  "https://bernomobler.se/collections/skap-och-forvaring/Byr%C3%A5": [
    {
      name: "Matrum",
      url: "https://bernomobler.se/collections/matrum",
    },
    {
      name: "Byrå",
      url: "https://bernomobler.se/collections/skap-och-forvaring/Byr%C3%A5",
    },
  ],
  "https://bernomobler.se/collections/latex-baddmadrass": [
    {
      name: "Sovrum",
      url: "https://bernomobler.se/collections/sovrum",
    },
    {
      name: "Latex bäddmadrasser",
      url: "https://bernomobler.se/collections/latex-baddmadrass",
    },
  ],
  "https://bernomobler.se/collections/polyeter-baddmadrasser": [
    {
      name: "Sovrum",
      url: "https://bernomobler.se/collections/sovrum",
    },
    {
      name: "Polyeter bäddmadrasser",
      url: "https://bernomobler.se/collections/polyeter-baddmadrasser",
    },
  ],
  "https://bernomobler.se/collections/dubbelsangar": [
    {
      name: "Sovrum",
      url: "https://bernomobler.se/collections/sovrum",
    },
    {
      name: "Dubbelsängar",
      url: "https://bernomobler.se/collections/dubbelsangar",
    },
  ],
  "https://bernomobler.se/collections/enkelsangar": [
    {
      name: "Sovrum",
      url: "https://bernomobler.se/collections/sovrum",
    },
    {
      name: "Enkelsängar",
      url: "https://bernomobler.se/collections/enkelsangar",
    },
  ],
  "https://bernomobler.se/collections/kompletta-sangpaket": [
    {
      name: "Sovrum",
      url: "https://bernomobler.se/collections/sovrum",
    },
    {
      name: "Kompletta sängpaket",
      url: "https://bernomobler.se/collections/kompletta-sangpaket",
    },
  ],
  "https://bernomobler.se/collections/ramsangar/Dubbels%C3%A4ngar": [
    {
      name: "Sovrum",
      url: "https://bernomobler.se/collections/sovrum",
    },
    {
      name: "Dubbelsängar",
      url: "https://bernomobler.se/collections/ramsangar/Dubbels%C3%A4ngar",
    },
  ],
  "https://bernomobler.se/collections/ramsangar/Enkels%C3%A4ngar": [
    {
      name: "Sovrum",
      url: "https://bernomobler.se/collections/sovrum",
    },
    {
      name: "Enkelsängar",
      url: "https://bernomobler.se/collections/ramsangar/Enkels%C3%A4ngar",
    },
  ],
  "https://bernomobler.se/collections/stallbara-sangar/Dubbels%C3%A4ngar": [
    {
      name: "Sovrum",
      url: "https://bernomobler.se/collections/sovrum",
    },
    {
      name: "Dubbelsängar",
      url: "https://bernomobler.se/collections/stallbara-sangar/Dubbels%C3%A4ngar",
    },
  ],
  "https://bernomobler.se/collections/stallbara-sangar/Enkels%C3%A4ngar": [
    {
      name: "Sovrum",
      url: "https://bernomobler.se/collections/sovrum",
    },
    {
      name: "Enkelsängar",
      url: "https://bernomobler.se/collections/stallbara-sangar/Enkels%C3%A4ngar",
    },
  ],
  "https://bernomobler.se/collections/huvudgavlar": [
    {
      name: "Sovrum",
      url: "https://bernomobler.se/collections/sovrum",
    },
    {
      name: "Huvudgavlar",
      url: "https://bernomobler.se/collections/huvudgavlar",
    },
  ],
  "https://bernomobler.se/collections/sangbord": [
    {
      name: "Sovrum",
      url: "https://bernomobler.se/collections/sovrum",
    },
    {
      name: "Sängbord",
      url: "https://bernomobler.se/collections/sangbord",
    },
  ],
  "https://bernomobler.se/collections/paslakan/P%C3%A5slakan": [
    {
      name: "Sovrum",
      url: "https://bernomobler.se/collections/sovrum",
    },
    {
      name: "Påslakan",
      url: "https://bernomobler.se/collections/paslakan/P%C3%A5slakan",
    },
  ],
  "https://bernomobler.se/collections/overkast": [
    {
      name: "Sovrum",
      url: "https://bernomobler.se/collections/sovrum",
    },
    {
      name: "Överkast",
      url: "https://bernomobler.se/collections/overkast",
    },
  ],
  "https://bernomobler.se/collections/sangkappor-och-sanggavel-overdrag": [
    {
      name: "Sovrum",
      url: "https://bernomobler.se/collections/sovrum",
    },
    {
      name: "Sängkappor och sänggavel överdrag",
      url: "https://bernomobler.se/collections/sangkappor-och-sanggavel-overdrag",
    },
  ],
  "https://bernomobler.se/collections/stora-mattor-1": [
    {
      name: "Mattor",
      url: "https://bernomobler.se/collections/mattor",
    },
    {
      name: "Stora mattor",
      url: "https://bernomobler.se/collections/stora-mattor-1",
    },
  ],
  "https://bernomobler.se/collections/bra-miljoval": [
    {
      name: "Mattor",
      url: "https://bernomobler.se/collections/mattor",
    },
    {
      name: "Bra miljöval",
      url: "https://bernomobler.se/collections/bra-miljoval",
    },
  ],
  "https://bernomobler.se/collections/barnmattor": [
    {
      name: "Mattor",
      url: "https://bernomobler.se/collections/mattor",
    },
    {
      name: "Barnmattor",
      url: "https://bernomobler.se/collections/barnmattor",
    },
  ],
  "https://bernomobler.se/collections/gangmattor": [
    {
      name: "Mattor",
      url: "https://bernomobler.se/collections/mattor",
    },
    {
      name: "Gångmattor",
      url: "https://bernomobler.se/collections/gangmattor",
    },
  ],
  "https://bernomobler.se/collections/flatvavda-gummerade-mattor": [
    {
      name: "Mattor",
      url: "https://bernomobler.se/collections/mattor",
    },
    {
      name: "Flatvävda / Gummerade mattor",
      url: "https://bernomobler.se/collections/flatvavda-gummerade-mattor",
    },
  ],
  "https://bernomobler.se/collections/inomhus-utomhusmattor": [
    {
      name: "Mattor",
      url: "https://bernomobler.se/collections/mattor",
    },
    {
      name: "Inomhus / Utomhusmattor",
      url: "https://bernomobler.se/collections/inomhus-utomhusmattor",
    },
  ],
  "https://bernomobler.se/collections/jutemattor": [
    {
      name: "Mattor",
      url: "https://bernomobler.se/collections/mattor",
    },
    {
      name: "Jutemattor",
      url: "https://bernomobler.se/collections/jutemattor",
    },
  ],
  "https://bernomobler.se/collections/konstsilke-viskosmattor": [
    {
      name: "Mattor",
      url: "https://bernomobler.se/collections/mattor",
    },
    {
      name: "Konstsilke / Viskosmattor",
      url: "https://bernomobler.se/collections/konstsilke-viskosmattor",
    },
  ],
  "https://bernomobler.se/collections/maskinvavda-wiltonmattor": [
    {
      name: "Mattor",
      url: "https://bernomobler.se/collections/mattor",
    },
    {
      name: "Maskinvävda / Wiltonmattor",
      url: "https://bernomobler.se/collections/maskinvavda-wiltonmattor",
    },
  ],
  "https://bernomobler.se/collections/ryamattor": [
    {
      name: "Mattor",
      url: "https://bernomobler.se/collections/mattor",
    },
    {
      name: "Ryamattor",
      url: "https://bernomobler.se/collections/ryamattor",
    },
  ],
  "https://bernomobler.se/collections/tras-garn-bomullsmattor": [
    {
      name: "Mattor",
      url: "https://bernomobler.se/collections/mattor",
    },
    {
      name: "Tras / Garn / Bomullsmattor",
      url: "https://bernomobler.se/collections/tras-garn-bomullsmattor",
    },
  ],
  "https://bernomobler.se/collections/ullmattor": [
    {
      name: "Mattor",
      url: "https://bernomobler.se/collections/mattor",
    },
    {
      name: "Ullmattor",
      url: "https://bernomobler.se/collections/ullmattor",
    },
  ],
  "https://bernomobler.se/collections/tvattbara-mattor": [
    {
      name: "Mattor",
      url: "https://bernomobler.se/collections/mattor",
    },
    {
      name: "Tvättbara mattor",
      url: "https://bernomobler.se/collections/tvattbara-mattor",
    },
  ],
  "https://bernomobler.se/collections/barbord-ute": [
    {
      name: "Utemöbler",
      url: "https://bernomobler.se/collections/utemobler",
    },
    {
      name: "Barbord",
      url: "https://bernomobler.se/collections/barbord-ute",
    },
  ],
  "https://bernomobler.se/collections/cafebord": [
    {
      name: "Utemöbler",
      url: "https://bernomobler.se/collections/utemobler",
    },
    {
      name: "Cafebord",
      url: "https://bernomobler.se/collections/cafebord",
    },
  ],
  "https://bernomobler.se/collections/matbord-ute": [
    {
      name: "Utemöbler",
      url: "https://bernomobler.se/collections/utemobler",
    },
    {
      name: "Matbord",
      url: "https://bernomobler.se/collections/matbord-ute",
    },
  ],
  "https://bernomobler.se/collections/soffbord-ute": [
    {
      name: "Utemöbler",
      url: "https://bernomobler.se/collections/utemobler",
    },
    {
      name: "Soffbord",
      url: "https://bernomobler.se/collections/soffbord-ute",
    },
  ],
  "https://bernomobler.se/collections/balkongset-ute": [
    {
      name: "Utemöbler",
      url: "https://bernomobler.se/collections/utemobler",
    },
    {
      name: "Balkongset",
      url: "https://bernomobler.se/collections/balkongset-ute",
    },
  ],
  "https://bernomobler.se/collections/cafeset-ute": [
    {
      name: "Utemöbler",
      url: "https://bernomobler.se/collections/utemobler",
    },
    {
      name: "Cafesét",
      url: "https://bernomobler.se/collections/cafeset-ute",
    },
  ],
  "https://bernomobler.se/collections/dynboxar": [
    {
      name: "Utemöbler",
      url: "https://bernomobler.se/collections/utemobler",
    },
    {
      name: "Dynboxar",
      url: "https://bernomobler.se/collections/dynboxar",
    },
  ],
  "https://bernomobler.se/collections/mobelskydd": [
    {
      name: "Utemöbler",
      url: "https://bernomobler.se/collections/utemobler",
    },
    {
      name: "Möbelskydd",
      url: "https://bernomobler.se/collections/mobelskydd",
    },
  ],
  "https://bernomobler.se/collections/positionsdynor": [
    {
      name: "Utemöbler",
      url: "https://bernomobler.se/collections/utemobler",
    },
    {
      name: "Positionsdynor",
      url: "https://bernomobler.se/collections/positionsdynor",
    },
  ],
  "https://bernomobler.se/collections/sittdynor": [
    {
      name: "Utemöbler",
      url: "https://bernomobler.se/collections/utemobler",
    },
    {
      name: "Sittdynor",
      url: "https://bernomobler.se/collections/sittdynor",
    },
  ],
  "https://bernomobler.se/collections/fria-hangmattor": [
    {
      name: "Utemöbler",
      url: "https://bernomobler.se/collections/utemobler",
    },
    {
      name: "Fria hängmattor",
      url: "https://bernomobler.se/collections/fria-hangmattor",
    },
  ],
  "https://bernomobler.se/collections/hangmattor-med-stallning": [
    {
      name: "Utemöbler",
      url: "https://bernomobler.se/collections/utemobler",
    },
    {
      name: "Hängmattor med ställning",
      url: "https://bernomobler.se/collections/hangmattor-med-stallning",
    },
  ],
  "https://bernomobler.se/collections/hangstolar": [
    {
      name: "Utemöbler",
      url: "https://bernomobler.se/collections/utemobler",
    },
    {
      name: "Hängstolar",
      url: "https://bernomobler.se/collections/hangstolar",
    },
  ],
  "https://bernomobler.se/collections/horngrupper": [
    {
      name: "Utemöbler",
      url: "https://bernomobler.se/collections/utemobler",
    },
    {
      name: "Hörngrupper",
      url: "https://bernomobler.se/collections/horngrupper",
    },
  ],
  "https://bernomobler.se/collections/modulgrupper": [
    {
      name: "Utemöbler",
      url: "https://bernomobler.se/collections/utemobler",
    },
    {
      name: "Modulgrupper",
      url: "https://bernomobler.se/collections/modulgrupper",
    },
  ],
  "https://bernomobler.se/collections/soffgrupper": [
    {
      name: "Utemöbler",
      url: "https://bernomobler.se/collections/utemobler",
    },
    {
      name: "Soffgrupper",
      url: "https://bernomobler.se/collections/soffgrupper",
    },
  ],
  "https://bernomobler.se/collections/set-och-stolar": [
    {
      name: "Utemöbler",
      url: "https://bernomobler.se/collections/utemobler",
    },
    {
      name: "Set och stolar",
      url: "https://bernomobler.se/collections/set-och-stolar",
    },
  ],
  "https://bernomobler.se/collections/rektangulara-matgrupper-ute": [
    {
      name: "Utemöbler",
      url: "https://bernomobler.se/collections/utemobler",
    },
    {
      name: "Rektangulära matgrupper",
      url: "https://bernomobler.se/collections/rektangulara-matgrupper-ute",
    },
  ],
  "https://bernomobler.se/collections/runda-matgrupper-ute-1": [
    {
      name: "Utemöbler",
      url: "https://bernomobler.se/collections/utemobler",
    },
    {
      name: "Runda matgrupper",
      url: "https://bernomobler.se/collections/runda-matgrupper-ute-1",
    },
  ],
  "https://bernomobler.se/collections/bankar": [
    {
      name: "Utemöbler",
      url: "https://bernomobler.se/collections/utemobler",
    },
    {
      name: "Bänkar",
      url: "https://bernomobler.se/collections/bankar",
    },
  ],
  "https://bernomobler.se/collections/hammockar": [
    {
      name: "Utemöbler",
      url: "https://bernomobler.se/collections/utemobler",
    },
    {
      name: "Hammockar",
      url: "https://bernomobler.se/collections/hammockar",
    },
  ],
  "https://bernomobler.se/collections/utemobler/Soffor-ute": [
    {
      name: "Utemöbler",
      url: "https://bernomobler.se/collections/utemobler",
    },
    {
      name: "Soffor",
      url: "https://bernomobler.se/collections/utemobler/Soffor-ute",
    },
  ],
  "https://bernomobler.se/collections/solstolar-och-solsangar": [
    {
      name: "Utemöbler",
      url: "https://bernomobler.se/collections/utemobler",
    },
    {
      name: "Solstolar och solsängar",
      url: "https://bernomobler.se/collections/solstolar-och-solsangar",
    },
  ],
  "https://bernomobler.se/collections/barstolar-ute": [
    {
      name: "Utemöbler",
      url: "https://bernomobler.se/collections/utemobler",
    },
    {
      name: "Barstolar",
      url: "https://bernomobler.se/collections/barstolar-ute",
    },
  ],
  "https://bernomobler.se/collections/fatoljer-ute": [
    {
      name: "Utemöbler",
      url: "https://bernomobler.se/collections/utemobler",
    },
    {
      name: "Fåtöljer",
      url: "https://bernomobler.se/collections/fatoljer-ute",
    },
  ],
  "https://bernomobler.se/collections/karmstolar-ute-1": [
    {
      name: "Utemöbler",
      url: "https://bernomobler.se/collections/utemobler",
    },
    {
      name: "Karmstolar",
      url: "https://bernomobler.se/collections/karmstolar-ute-1",
    },
  ],
  "https://bernomobler.se/collections/loungestolar-ute-1": [
    {
      name: "Utemöbler",
      url: "https://bernomobler.se/collections/utemobler",
    },
    {
      name: "Loungestolar",
      url: "https://bernomobler.se/collections/loungestolar-ute-1",
    },
  ],
  "https://bernomobler.se/collections/positionsstolar-ute": [
    {
      name: "Utemöbler",
      url: "https://bernomobler.se/collections/utemobler",
    },
    {
      name: "Positionsstolar",
      url: "https://bernomobler.se/collections/positionsstolar-ute",
    },
  ],
  "https://bernomobler.se/collections/stapelbara-stolar-1": [
    {
      name: "Utemöbler",
      url: "https://bernomobler.se/collections/utemobler",
    },
    {
      name: "Stapelbara stolar",
      url: "https://bernomobler.se/collections/stapelbara-stolar-1",
    },
  ],
  "https://bernomobler.se/collections/matstolar-ute": [
    {
      name: "Utemöbler",
      url: "https://bernomobler.se/collections/utemobler",
    },
    {
      name: "Matstolar",
      url: "https://bernomobler.se/collections/matstolar-ute",
    },
  ],
  "https://bernomobler.se/collections/fristaende-parasoll": [
    {
      name: "Utemöbler",
      url: "https://bernomobler.se/collections/utemobler",
    },
    {
      name: "Fristående parasoll",
      url: "https://bernomobler.se/collections/fristaende-parasoll",
    },
  ],
  "https://bernomobler.se/collections/sidoarmsparasoll": [
    {
      name: "Utemöbler",
      url: "https://bernomobler.se/collections/utemobler",
    },
    {
      name: "Sidoarmsparasoll",
      url: "https://bernomobler.se/collections/sidoarmsparasoll",
    },
  ],
  "https://bernomobler.se/collections/parasoller-och-parasollfotter": [
    {
      name: "Utemöbler",
      url: "https://bernomobler.se/collections/utemobler",
    },
    {
      name: "Parasollfötter",
      url: "https://bernomobler.se/collections/parasoller-och-parasollfotter",
    },
  ],
  "https://bernomobler.se/collections/koksmoduler": [
    {
      name: "Utemöbler",
      url: "https://bernomobler.se/collections/utemobler",
    },
    {
      name: "Köksmoduler",
      url: "https://bernomobler.se/collections/koksmoduler",
    },
  ],
  "https://bernomobler.se/collections/eldstader": [
    {
      name: "Utemöbler",
      url: "https://bernomobler.se/collections/utemobler",
    },
    {
      name: "Eldstäder",
      url: "https://bernomobler.se/collections/eldstader",
    },
  ],
  "https://bernomobler.se/collections/gasolvarmare": [
    {
      name: "Utemöbler",
      url: "https://bernomobler.se/collections/utemobler",
    },
    {
      name: "Gasolvärmare",
      url: "https://bernomobler.se/collections/gasolvarmare",
    },
  ],
  "https://bernomobler.se/collections/bordslampor": [
    {
      name: "Belysning",
      url: "https://bernomobler.se/collections/belysning",
    },
    {
      name: "Bordslampor",
      url: "https://bernomobler.se/collections/bordslampor",
    },
  ],
  "https://bernomobler.se/collections/fonsterlampor": [
    {
      name: "Belysning",
      url: "https://bernomobler.se/collections/belysning",
    },
    {
      name: "Fönsterlampor",
      url: "https://bernomobler.se/collections/fonsterlampor",
    },
  ],
  "https://bernomobler.se/collections/golvlampor": [
    {
      name: "Belysning",
      url: "https://bernomobler.se/collections/belysning",
    },
    {
      name: "Golvlampor",
      url: "https://bernomobler.se/collections/golvlampor",
    },
  ],
  "https://bernomobler.se/collections/plafonder": [
    {
      name: "Belysning",
      url: "https://bernomobler.se/collections/belysning",
    },
    {
      name: "Plafonder",
      url: "https://bernomobler.se/collections/plafonder",
    },
  ],
  "https://bernomobler.se/collections/spotlights": [
    {
      name: "Belysning",
      url: "https://bernomobler.se/collections/belysning",
    },
    {
      name: "Spotlights",
      url: "https://bernomobler.se/collections/spotlights",
    },
  ],
  "https://bernomobler.se/collections/taklampor": [
    {
      name: "Belysning",
      url: "https://bernomobler.se/collections/belysning",
    },
    {
      name: "Taklampor",
      url: "https://bernomobler.se/collections/taklampor",
    },
  ],
  "https://bernomobler.se/collections/hatthylla": [
    {
      name: "Övrigt",
      url: "https://bernomobler.se/collections/ovrigt",
    },
    {
      name: "Hatthylla",
      url: "https://bernomobler.se/collections/hatthylla",
    },
  ],
  "https://bernomobler.se/collections/skohylla": [
    {
      name: "Övrigt",
      url: "https://bernomobler.se/collections/ovrigt",
    },
    {
      name: "Skohylla",
      url: "https://bernomobler.se/collections/skohylla",
    },
  ],
  "https://bernomobler.se/collections/tavellister": [
    {
      name: "Övrigt",
      url: "https://bernomobler.se/collections/ovrigt",
    },
    {
      name: "Tavellister",
      url: "https://bernomobler.se/collections/tavellister",
    },
  ],
  "https://bernomobler.se/collections/nyckelskap": [
    {
      name: "Övrigt",
      url: "https://bernomobler.se/collections/ovrigt",
    },
    {
      name: "Nyckelskåp",
      url: "https://bernomobler.se/collections/nyckelskap",
    },
  ],
  "https://bernomobler.se/collections/kladhangare": [
    {
      name: "Övrigt",
      url: "https://bernomobler.se/collections/ovrigt",
    },
    {
      name: "Klädhängare",
      url: "https://bernomobler.se/collections/kladhangare",
    },
  ],
  "https://bernomobler.se/collections/sittbank": [
    {
      name: "Övrigt",
      url: "https://bernomobler.se/collections/ovrigt",
    },
    {
      name: "Sittbänk",
      url: "https://bernomobler.se/collections/sittbank",
    },
  ],
  "https://bernomobler.se/collections/galge": [
    {
      name: "Övrigt",
      url: "https://bernomobler.se/collections/ovrigt",
    },
    {
      name: "Galgar",
      url: "https://bernomobler.se/collections/galge",
    },
  ],
  "https://bernomobler.se/collections/hallmobler/Pallar-och-sittb%C3%A4nkar": [
    {
      name: "Övrigt",
      url: "https://bernomobler.se/collections/ovrigt",
    },
    {
      name: "Pallar",
      url: "https://bernomobler.se/collections/hallmobler/Pallar-och-sittb%C3%A4nkar",
    },
  ],
  "https://bernomobler.se/collections/farskinn": [
    {
      name: "Övrigt",
      url: "https://bernomobler.se/collections/ovrigt",
    },
    {
      name: "Fårskinn",
      url: "https://bernomobler.se/collections/farskinn",
    },
  ],
  "https://bernomobler.se/collections/gardiner": [
    {
      name: "Övrigt",
      url: "https://bernomobler.se/collections/ovrigt",
    },
    {
      name: "Gardiner",
      url: "https://bernomobler.se/collections/gardiner",
    },
  ],
  "https://bernomobler.se/collections/pladar-och-filtar": [
    {
      name: "Övrigt",
      url: "https://bernomobler.se/collections/ovrigt",
    },
    {
      name: "Plädar och filtar",
      url: "https://bernomobler.se/collections/pladar-och-filtar",
    },
  ],
  "https://bernomobler.se/collections/heminredning/Tavlor": [
    {
      name: "Övrigt",
      url: "https://bernomobler.se/collections/ovrigt",
    },
    {
      name: "Tavlor",
      url: "https://bernomobler.se/collections/heminredning/Tavlor",
    },
  ],
  "https://bernomobler.se/collections/speglar/Speglar": [
    {
      name: "Övrigt",
      url: "https://bernomobler.se/collections/ovrigt",
    },
    {
      name: "Speglar",
      url: "https://bernomobler.se/collections/speglar/Speglar",
    },
  ],
  "https://bernomobler.se/collections/dekoration": [
    {
      name: "Övrigt",
      url: "https://bernomobler.se/collections/ovrigt",
    },
    {
      name: "Dekoration",
      url: "https://bernomobler.se/collections/dekoration",
    },
  ],
  "https://bernomobler.se/collections/posters": [
    {
      name: "Övrigt",
      url: "https://bernomobler.se/collections/ovrigt",
    },
    {
      name: "Posters",
      url: "https://bernomobler.se/collections/posters",
    },
  ],
  "https://bernomobler.se/collections/skrivbord": [
    {
      name: "Övrigt",
      url: "https://bernomobler.se/collections/ovrigt",
    },
    {
      name: "Skrivbord",
      url: "https://bernomobler.se/collections/skrivbord",
    },
  ],
  "https://bernomobler.se/collections/skap-och-forvaring": [
    {
      name: "Övrigt",
      url: "https://bernomobler.se/collections/ovrigt",
    },
    {
      name: "Skåp och förvaring",
      url: "https://bernomobler.se/collections/skap-och-forvaring",
    },
  ],
  "https://bernomobler.se/collections/actona-company": [
    {
      name: "Varumärken",
      url: "https://bernomobler.se/collections/varumarken",
    },
    {
      name: "Actona Company",
      url: "https://bernomobler.se/collections/actona-company",
    },
  ],
  "https://bernomobler.se/collections/above-mobler": [
    {
      name: "Varumärken",
      url: "https://bernomobler.se/collections/varumarken",
    },
    {
      name: "Above Möbler",
      url: "https://bernomobler.se/collections/above-mobler",
    },
  ],
  "https://bernomobler.se/collections/amalfi-interior": [
    {
      name: "Varumärken",
      url: "https://bernomobler.se/collections/varumarken",
    },
    {
      name: "Amalfi Interiör",
      url: "https://bernomobler.se/collections/amalfi-interior",
    },
  ],
  "https://bernomobler.se/collections/aneta-home": [
    {
      name: "Varumärken",
      url: "https://bernomobler.se/collections/varumarken",
    },
    {
      name: "Aneta Lightning",
      url: "https://bernomobler.se/collections/aneta-home",
    },
  ],
  "https://bernomobler.se/collections/bellus": [
    {
      name: "Varumärken",
      url: "https://bernomobler.se/collections/varumarken",
    },
    {
      name: "Bellus",
      url: "https://bernomobler.se/collections/bellus",
    },
  ],
  "https://bernomobler.se/collections/bordbirger": [
    {
      name: "Varumärken",
      url: "https://bernomobler.se/collections/varumarken",
    },
    {
      name: "BordBirger",
      url: "https://bernomobler.se/collections/bordbirger",
    },
  ],
  "https://bernomobler.se/collections/broderna-andersson": [
    {
      name: "Varumärken",
      url: "https://bernomobler.se/collections/varumarken",
    },
    {
      name: "Bröderna Andersson",
      url: "https://bernomobler.se/collections/broderna-andersson",
    },
  ],
  "https://bernomobler.se/collections/burhens": [
    {
      name: "Varumärken",
      url: "https://bernomobler.se/collections/varumarken",
    },
    {
      name: "Burhéns",
      url: "https://bernomobler.se/collections/burhens",
    },
  ],
  "https://bernomobler.se/collections/elite-sangar": [
    {
      name: "Varumärken",
      url: "https://bernomobler.se/collections/varumarken",
    },
    {
      name: "Elite Sängar",
      url: "https://bernomobler.se/collections/elite-sangar",
    },
  ],
  "https://bernomobler.se/collections/hagagruppen": [
    {
      name: "Varumärken",
      url: "https://bernomobler.se/collections/varumarken",
    },
    {
      name: "Hagagruppen",
      url: "https://bernomobler.se/collections/hagagruppen",
    },
  ],
  "https://bernomobler.se/collections/kilroy-indbo": [
    {
      name: "Varumärken",
      url: "https://bernomobler.se/collections/varumarken",
    },
    {
      name: "Kilroy Indbo",
      url: "https://bernomobler.se/collections/kilroy-indbo",
    },
  ],
  "https://bernomobler.se/collections/matt-textilgrossisten": [
    {
      name: "Varumärken",
      url: "https://bernomobler.se/collections/varumarken",
    },
    {
      name: "Matt & Textilgrossisten",
      url: "https://bernomobler.se/collections/matt-textilgrossisten",
    },
  ],
  "https://bernomobler.se/collections/mobelform": [
    {
      name: "Varumärken",
      url: "https://bernomobler.se/collections/varumarken",
    },
    {
      name: "Möbelform",
      url: "https://bernomobler.se/collections/mobelform",
    },
  ],
  "https://bernomobler.se/collections/nordic-furniture-group": [
    {
      name: "Varumärken",
      url: "https://bernomobler.se/collections/varumarken",
    },
    {
      name: "Nordic Furniture Group",
      url: "https://bernomobler.se/collections/nordic-furniture-group",
    },
  ],
  "https://bernomobler.se/collections/rowico": [
    {
      name: "Aktuella kampanjer",
      url: "https://bernomobler.sehttps://bernomobler.se/collections/kampanj",
    },
    {
      name: "Rowico Home - 15% på hela sortimentet",
      url: "https://bernomobler.se/collections/rowico",
    },
  ],
  "https://bernomobler.se/collections/skinnwille": [
    {
      name: "Varumärken",
      url: "https://bernomobler.se/collections/varumarken",
    },
    {
      name: "Skinnwille",
      url: "https://bernomobler.se/collections/skinnwille",
    },
  ],
  "https://bernomobler.se/collections/torkelson": [
    {
      name: "Aktuella kampanjer",
      url: "https://bernomobler.sehttps://bernomobler.se/collections/kampanj",
    },
    {
      name: "Torkelson - 15% på hela sortimentet",
      url: "https://bernomobler.se/collections/torkelson",
    },
  ],
  "https://bernomobler.se/collections/venture-design%C2%AE": [
    {
      name: "Varumärken",
      url: "https://bernomobler.se/collections/varumarken",
    },
    {
      name: "Venture Design®",
      url: "https://bernomobler.se/collections/venture-design%C2%AE",
    },
  ],
  "https://bernomobler.se/collections/vind": [
    {
      name: "Varumärken",
      url: "https://bernomobler.se/collections/varumarken",
    },
    {
      name: "VIND",
      url: "https://bernomobler.se/collections/vind",
    },
  ],
  "https://bernomobler.se/collections/mattkampanj": [
    {
      name: "Aktuella kampanjer",
      url: "https://bernomobler.sehttps://bernomobler.se/collections/kampanj",
    },
    {
      name: "Mattkampanj",
      url: "https://bernomobler.se/collections/mattkampanj",
    },
  ],
};
