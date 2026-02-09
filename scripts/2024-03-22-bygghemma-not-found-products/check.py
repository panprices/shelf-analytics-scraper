from dataclasses import dataclass
import json
import re
import time
from typing import Optional
import requests
import os

import structlog

# import pytest


# PUT PRODUCTS TO SCRAPET HERE
missing_products = [
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-furniture-och-fashion-stone-med-4-polly-stolar/p-1769997",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-furniture-och-fashion-stone-med-6-polly-stolar/p-1770009",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-bianca-rund-med-4-peggy-stolar/p-1412655",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-bootcut-o110-cm-med-4-polly-stolar/p-1826954",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-camden-med-4-opelika-stolar/p-1826964",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-chicago-med-6-peggy-stolar/p-1416897-1412587",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-copenhagen-med-4-polly-stolar/p-1769957-1769958",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-copenhagen-med-4-polly-stolar/p-1769957-1769959",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-copenhagen-med-6-peggy-stolar/p-1142857-1142448",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-cornelia-med-6-peggy-stolar-svart/p-1155615-1155616",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-danburi-med-4-lily-stolar/p-1835414",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-danburi-med-4-petra-stolar/p-1835413",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-danburi-med-4-polar-boucle-stolar/p-1835411",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-danburi-med-4-polar-sammet-stolar/p-1835410",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-danburi-med-4-polar-stolar/p-1835409",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-danburi-med-4-polly-stolar/p-1835412",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-danburi-svart-med-4-polar-stolar/p-1832671",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-disa-rund-med-4-corina-stolar/p-1178714-1026660",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-disa-rund-med-4-corina-stolar/p-1178714-1178715",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-durango-o-120-cm-med-4-polly-stolar/p-1827040",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-estelle-med-4-corina-stolar-manchestelle/p-1247296-1244732",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-estelle-med-4-valor-stolar-polyestelletyg/p-1186533-1186535",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-glade-o-100-cm-med-4-polly-stolar/p-1827061",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-gronvik-med-4-polly-stolar/p-1832688",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-ina-med-4-corina-stolar-polyester/p-1244752",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-ina-med-4-peggy-stolar/p-1178915-1178916",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-ina-med-4-pobbie-stolar-polyester/p-1244755",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-isolde-med-4-berit-stolar/p-1832692",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-isolde-med-4-chico-stolar/p-1832693",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-isolde-med-4-edina-stolar/p-1832694",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-isolde-med-4-modesto-stolar/p-1832695",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-isolde-med-4-montros-stolar/p-1832696",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-isolde-med-4-night-stolar/p-1832698",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-isolde-med-4-polar-stolar/p-1832699",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-isolde-med-4-rosie-stolar/p-1832700",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-isolde-med-4-selma-stolar/p-1832701",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-isolde-med-4-stella-stolar/p-1832702",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-isolde-med-4-yesterday-stolar/p-1832703",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-jane-med-6-peggy-stolar/p-1178969",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-jenni-med-6-corina-stolar/p-1026686",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-kaseidon-o100-cm-med-4-st-modesto-stolar/p-1827500-1827502",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-kaseidon-o100-cm-med-4-st-polar-stolar/p-1827505-1827506",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-lanzo-o120-cm-med-4-st-rosie-stolar/p-1827533-1827534",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-lanzo-o120-cm-med-4-st-rosie-stolar/p-1827533-1827536",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-madde-med-4-corina-stolar-polyestertyg/p-1179008-1179010",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-madde-med-6-walter-stolar/p-1248000",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-med-bianca-matbord-och-4-peggy-matstolar/p-1468451",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-monte-carlo-med-4-peggy-stolar/p-1412560",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-olivia-med-4-polly-stolar/p-1817012-1769974",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-olivia-med-4-polly-stolar/p-1817012-1816653",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-olivia-o-110-cm-med-4-modesto-stolar/p-1827081-1827082",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-pelle-casper-med-4-stolar-ek-gra/p-816563",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-piata-med-6-peggy-stolar-svart/p-1412666",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-plake-ek-med-4-plake-stolar/p-1247337-1244892",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-plake-med-4-laura-stolar/p-1026712-1244886",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-plake-med-4-peggy-stolar-runt/p-1178267-1178268",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-plake-med-4-pobbie-stolar-design-med-snurrfunktion-konstlader/p-1178313-1178314",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-plake-med-4-valentina-stolar-polyestertyg-runt/p-1178328-1178332",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-plake-med-4-walerina-stolar/p-1247340-1244910",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-pobbie-med-4-walter-stolar/p-1247992",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-pobbie-med-6-corina-stolar/p-1026737-1155698",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-pobbie-med-6-peggy-stolar-vit/p-1178418-1178419",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-pobbie-med-6-walter-stolar-svart/p-1244959",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-pontus-william-med-6-stolar/p-752960",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-roxanna-gra-bord-med-4-corina-stolar/p-1061478-1061479",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-roxanna-gra-bord-med-4-peggy-stolar/p-1117333-1117335",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-salt-med-6-peggy-stolar/p-1178489-1178491",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-san-francisco-med-4-peggy-stolar/p-1416899-1412606",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-shy-med-6-corina-matstolar/p-1223270-1223272",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-silvia-med-4-archie-stolar-runt/p-1178527",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-silvia-med-4-bergen-stolar-sammet/p-1416974-1416975",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-silvia-med-4-bergen-stolar-sammet/p-1416974-1416976",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-silvia-med-4-bergen-stolar-sammet/p-1416974-1416977",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-silvia-med-4-corina-stolar/p-1178534-1178536",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-silvia-med-4-corina-stolar-runt/p-1178538",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-silvia-med-4-elisa-stolar-sammet/p-1416981-1416982",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-silvia-med-4-geneva-stolar-runt/p-1178542-1178543",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-silvia-med-4-kungshamn-stolar-sammet/p-1416984-1416985",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-silvia-med-4-laura-stolar-runt/p-1178545",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-silvia-med-4-phoi-stolar-runt/p-1178547",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-silvia-med-4-pobbie-stolar-runt-polyestertyg/p-1178557",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-silvia-med-4-pooya-stolar/p-1247990",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-silvia-med-4-pop-stolar-runt/p-1178559-1178561",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-silvia-med-4-sly-stolar-runt/p-1178563-1178565",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-silvia-med-4-valentina-stitcthes-stolar-mikrofiber/p-1416996-1416997",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-silvia-med-4-valentina-stitcthes-stolar-polyesterlinen/p-1416990-1416991",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-silvia-med-4-valentina-stitcthes-stolar-sammet/p-1416993-1416994",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-silvia-med-4-valentina-stolar-konstlader-runt/p-1178587",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-silvia-med-4-valentina-stolar-manchester-runt/p-1178573-1178576",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-silvia-med-4-valentina-stolar-polyestertyg-runt/p-1178584",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-silvia-med-4-valentina-stolar-polyestertyg-runt/p-1178584-1178585",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-silvia-med-4-valentina-stolar-sammet-runt/p-1178577-1178578",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-silvia-med-4-valentina-stolar-sammet-runt/p-1178577-1178581",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-silvia-med-4-valentina-stolar-sammet-runt/p-1178577-1178583",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-silvia-med-4-vera-stolar-polyestertyg-runt/p-1178595-1178597",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-silvia-med-4-walerina-stolar-mikrofiber/p-1417002-1417003",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-silvia-med-4-walerina-stolar-mikrofiber/p-1417002-1417004",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-silvia-med-4-walerina-stolar-sammet/p-1416999-1417000",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-silvia-med-4-wrigley-stolar-runt/p-1178598",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-silvia-med-6-peggy-stolar/p-1178609-1178611",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-tempe-140-cm-med-4-kenth-stolar/p-1827112",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-tempe-140-cm-med-4-polly-stolar/p-1827117",
    "https://www.bygghemma.se/inredning-och-belysning/mobler/bord/matgrupp/matgrupp-venture-home-vail-med-6-polly-stolar/p-1827136",
    "https://www.bygghemma.se/tradgard-och-utemiljo/utemobler-och-tradgardsmobler/tradgardsgrupp/utemobler-matgrupp/cafegrupp-venture-home-cane-med-2-lindos-stolar/p-1272621-1272015",
    "https://www.bygghemma.se/tradgard-och-utemiljo/utemobler-och-tradgardsmobler/tradgardsgrupp/utemobler-matgrupp/matgrupp-venture-home-aleyna-152-och-210-med-4-siri-karmstolar/p-1136673-1136675",
    "https://www.bygghemma.se/tradgard-och-utemiljo/utemobler-och-tradgardsmobler/tradgardsgrupp/utemobler-matgrupp/matgrupp-venture-home-bois-med-6-levi-stolar/p-1728124-1278038",
    "https://www.bygghemma.se/tradgard-och-utemiljo/utemobler-och-tradgardsmobler/tradgardsgrupp/utemobler-matgrupp/matgrupp-venture-home-borneo-bord-med-6-bois-stolar/p-1813354-1813355",
    "https://www.bygghemma.se/tradgard-och-utemiljo/utemobler-och-tradgardsmobler/tradgardsgrupp/utemobler-matgrupp/matgrupp-venture-home-borneo-bord-med-6-bois-stolar/p-1813354-1813356",
    "https://www.bygghemma.se/tradgard-och-utemiljo/utemobler-och-tradgardsmobler/tradgardsgrupp/utemobler-matgrupp/matgrupp-venture-home-borneo-bord-med-6-copacabana-stolar/p-1813357-1813359",
    "https://www.bygghemma.se/tradgard-och-utemiljo/utemobler-och-tradgardsmobler/tradgardsgrupp/utemobler-matgrupp/matgrupp-venture-home-borneo-bord-med-6-lina-stolar/p-1813360-1813362",
    "https://www.bygghemma.se/tradgard-och-utemiljo/utemobler-och-tradgardsmobler/tradgardsgrupp/utemobler-matgrupp/matgrupp-venture-home-break-bord-med-4-malina-stolar/p-1813375-1813376",
    "https://www.bygghemma.se/tradgard-och-utemiljo/utemobler-och-tradgardsmobler/tradgardsgrupp/utemobler-matgrupp/matgrupp-venture-home-break-med-2-santorini-stolar/p-1816595-1816596",
    "https://www.bygghemma.se/tradgard-och-utemiljo/utemobler-och-tradgardsmobler/tradgardsgrupp/utemobler-matgrupp/matgrupp-venture-home-break-med-6-lindos-stolar/p-1279289-1277833",
    "https://www.bygghemma.se/tradgard-och-utemiljo/utemobler-och-tradgardsmobler/tradgardsgrupp/utemobler-matgrupp/matgrupp-venture-home-cot-med-4-lindos-stolar/p-1279279-1277582",
    "https://www.bygghemma.se/tradgard-och-utemiljo/utemobler-och-tradgardsmobler/tradgardsgrupp/utemobler-matgrupp/matgrupp-venture-home-holmbeck-bord-med-6-malina-stolar/p-1813432-1813434",
    "https://www.bygghemma.se/tradgard-och-utemiljo/utemobler-och-tradgardsmobler/tradgardsgrupp/utemobler-matgrupp/matgrupp-venture-home-julle-med-6-minos-matstolar/p-1272030-1272031",
    "https://www.bygghemma.se/tradgard-och-utemiljo/utemobler-och-tradgardsmobler/tradgardsgrupp/utemobler-matgrupp/matgrupp-venture-home-lina-bord-med-4-malina-stolar/p-1813439-1813440",
    "https://www.bygghemma.se/tradgard-och-utemiljo/utemobler-och-tradgardsmobler/tradgardsgrupp/utemobler-matgrupp/matgrupp-venture-home-lova-160-och-240-med-6-siri-matstolar/p-1115425-1111194",
    "https://www.bygghemma.se/tradgard-och-utemiljo/utemobler-och-tradgardsmobler/tradgardsgrupp/utemobler-matgrupp/matgrupp-venture-home-peoria-med-6-leon-stapelbara-matstolar/p-1279286-1277805",
    "https://www.bygghemma.se/tradgard-och-utemiljo/utemobler-och-tradgardsmobler/tradgardsgrupp/utemobler-matgrupp/matgrupp-venture-home-perla-152-och-210-med-6-siri-matstolar/p-1136740-1136741",
    "https://www.bygghemma.se/tradgard-och-utemiljo/utemobler-och-tradgardsmobler/tradgardsgrupp/utemobler-matgrupp/matgrupp-venture-home-plarra-med-6-lumi-matstolar/p-1279278-1277531",
]
logger = structlog.get_logger()

DEFAULT_REQUEST_HEADER = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
}


def venture_design_search_url(query: str) -> str:
    return f"https://www.venturedesign.se/search/{query}"


# @pytest.mark.skip
# def test_trademax_search_by_sku():
#     products = [
#         {"sku": 1875662},
#         {"sku": 1209935},
#         {"sku": 2266765},
#     ]
#     expect = [
#         "https://www.trademax.se/m%C3%B6bler/stolar/f%C3%A5t%C3%B6ljer/f%C3%A5t%C3%B6lj-rakel-svart-p1730164-v1375662",
#         None,
#         "https://www.trademax.se/utem%C3%B6bler/utomhusgrupp/caf%C3%A9grupp/borneo-cafeset-70-cm-2-st-tablas-matstolar-m%C3%B6rkgr%C3%A5svart-p1766765",
#     ]

#     for i, p in enumerate(products):
#         result = trademax_search_by_sku(str(p["sku"]))
#         print(f"Found product {p['sku']}: {result}")
#         assert result == expect[i]


def bygghemma_search_url(query):
    return f"https://www.bygghemma.se/sok/?phrase={query}"


def bygghemma_search_by_sku(sku):
    """Find the product on Trademax and return the product url"""
    url = bygghemma_search_url(sku)
    response = requests.get(url, headers=DEFAULT_REQUEST_HEADER)
    if response.status_code >= 300:
        raise Exception(f"Request error, status_code: {response.status_code}")

    html = response.text
    # with open("./tmp.html", "w") as f:
    #     f.write(html)

    # Check to see if there are any search result:
    if html.find(f'sku_id":"{sku}') == -1:
        return None

    # Find the 1st url as the result:
    pattern = r'"uri":"(\\\/[^"]+)"'
    match = re.search(pattern, html)
    if match:
        uri = match.group(1)
        return "https://www.trademax.se" + uri.replace("\\/", "/")

    return None


def _bygghemma_check_product(url) -> str | None:
    response = requests.get(url, headers=DEFAULT_REQUEST_HEADER)
    if response.status_code >= 300:
        raise Exception(f"Request error, status_code: {response.status_code}")

    # Check to see if we got redirected to a product page:
    if re.search(r"/p-\d+", response.url):
        return response.url

    return None


def bygghemma_check_products_exist():
    OUTPUT_FILEPATH = "products_not_found.csv"
    product_found = {}

    logger.info(f"Checking {len(missing_products)} products")

    for product_url in missing_products:
        found_url = _bygghemma_check_product(product_url)

        if found_url:
            logger.info("Product found", url=product_url)
            product_found[product_url] = found_url
        else:
            logger.warning("Not found", url=product_url)

        # Do not scrape too fast
        time.sleep(0.2)

    print(
        "\nTotal products found:", len(product_found), "out of", len(missing_products)
    )
    print(list(product_found.keys()))


if __name__ == "__main__":
    bygghemma_check_products_exist()
