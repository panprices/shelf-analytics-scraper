from dataclasses import dataclass
import json
import re
import time
from typing import Optional
import requests
import os

import structlog


logger = structlog.get_logger()

DEFAULT_REQUEST_HEADER = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
}


urls = [
    "https://www.ellos.se/venture-home/matgrupp-hamden-med-4-stycken-stolar-modesto/1748457-01-0",
    "https://www.ellos.se/venture-home/baddsoffa-vicky/1666914-05-0",
    "https://www.ellos.se/venture-home/matgrupp-rax-med-4st-stolar-tvist/1746093-01-0",
    "https://www.ellos.se/venture-home/matgrupp-dipp-med-6-st-matstolar-velvet/1694984-01",
    "https://www.ellos.se/venture-home/matstol-petra-2-pack/1666905-01",
    "https://www.ellos.se/venture-home/bokhylla-malmby/1619247-02-0",
    "https://www.ellos.se/venture-home/loungestol-ungskar/1616147-01",
    "https://www.ellos.se/venture-home/matgrupp-break-med-6st-matstolar-alina/1648705-01-0",
    "https://www.ellos.se/venture-home/matbord-ruben/1574537-01",
    "https://www.ellos.se/venture-home/cafeset-cannes-med-2-st-matstolar-cannes/1648492-01",
    "https://www.ellos.se/venture-home/matgrupp-inca-med-4st-matstolar-polar/1639846-01-0",
    "https://www.ellos.se/furniture-fashion/sittpuff-puff-diameter-75-cm/1609185-01-0",
    "https://www.ellos.se/venture-home/kontinentalsang-vaxtorp-sammet-fast/1651937-01-23",
    "https://www.ellos.se/venture-home/matgrupp-doris-bord-och-6st-valleta-stolar/1577619-01",
    "https://www.ellos.se/venture-home/kontinentalsang-arstad-tyg-medium/1651940-01-23",
    "https://www.ellos.se/venture-home/matgrupp-estelle-med-4-st-matstolar-polar/1694944-01-0",
    "https://www.ellos.se/venture-home/matgrupp-lanzo-med-4st-stolar-lilja/1746034-01-0",
    "https://www.ellos.se/venture-home/matgrupp-cassie-modulsoffa-och-brina-soffbord/1607584-01",
    "https://www.ellos.se/venture-home/matbord-pelle/1674544-01-0",
    "https://www.ellos.se/vind/soffbord-salto/1744358-01-0",
    "https://www.ellos.se/vind/bank-angon/1744324-01-0",
    "https://www.ellos.se/venture-home/kontinentalsang-med-fast-alvdalen-tyg/1636643-03-23",
    "https://www.ellos.se/venture-home/kontinentalsang-arstad-sammet-medium/1651941-01-23",
    "https://www.ellos.se/venture-home/fallbar-stol-kaspian-2-pack/1600300-01",
    "https://www.ellos.se/venture-home/kontinentalsang-vaxtorp-sammet-fast/1651937-02-13",
    "https://www.ellos.se/venture-home/matgrupp-yadikon-med-4st-stolar-lilja/1746120-01-0",
    "https://www.ellos.se/venture-home/leah-parasollsten-2-pack/1600304-01",
    "https://www.ellos.se/venture-home/penally-180cm-ek-windu-stol-6-pack/1564836-01-0",
    "https://www.ellos.se/venture-home/matgrupp-silar-med-4-st-matstolar-berit/1669923-03",
    "https://www.ellos.se/venture-home/toscana-matstol/1523917-01",
    "https://www.ellos.se/venture-home/matgrupp-danburi-med-2st-stolar-lilja/1745974-01-0",
    "https://www.ellos.se/venture-home/stol-polar-2-pack/1528163-01",
    "https://www.ellos.se/venture-home/matgrupp-leonora-med-2st-stolar-lilja/1746050-01-0",
    "https://www.ellos.se/venture-home/matgrupp-maggie-med-4st-matstolar-catrine/1626992-01-0",
    "https://www.ellos.se/venture-home/indra-viscose/1565861-07",
    "https://www.ellos.se/venture-home/soffbord-milton-60x120-cm/1600006-01",
    "https://www.ellos.se/venture-home/matgrupp-tempe-med-2st-stolar-lilja/1746100-01-0",
    "https://www.ellos.se/venture-home/kontinentalsang-vaxtorp-sammet-medium/1651938-01-23",
    "https://www.ellos.se/venture-home/matgrupp-pia-inkl-4st-matstolar-penally/1650232-01-0",
    "https://www.ellos.se/venture-home/soffbord-von-staf/1666917-01-0",
    "https://www.ellos.se/vind/soffbord-salto/1744357-01-0",
    "https://www.ellos.se/venture-home/matbord-doris/1619252-01-0",
    "https://www.ellos.se/venture-home/matgrupp-brentwood-bord-och-6-st-leone-stolar/1577627-01-0",
    "https://www.ellos.se/venture-home/parasoll-naxos/1600746-02-0",
    "https://www.ellos.se/venture-home/matgrupp-silar-med-4st-matstolar-comfort/1618939-01-0",
    "https://www.ellos.se/venture-home/bordslampa-england/1650552-01",
    "https://www.ellos.se/venture-home/matstol-kenya/1695250-01",
    "https://www.ellos.se/venture-home/lounge-set-ella/1645056-01-0",
    "https://www.ellos.se/venture-home/puff-castine/1727924-01",
    "https://www.ellos.se/venture-home/vikelund-soffgrupp/1560335-01-0",
    "https://www.ellos.se/vind/stol-orust/1744373-01-0",
    "https://www.ellos.se/venture-home/matgrupp-doris-bord-och-6st-valleta-stolar/1577621-01",
    "https://www.ellos.se/vind/malmon-matstol/1740917-01-0",
    "https://www.ellos.se/venture-home/lounge-set-haiti/1645040-02-0",
    "https://www.ellos.se/venture-home/soffgrupp-bjuv/1645046-02-0",
    "https://www.ellos.se/venture-home/sangbord-piring/1704616-02-0",
    "https://www.ellos.se/venture-home/kontinentalsang-vaxtorp-tyg-medium/1651932-01-23",
    "https://www.ellos.se/venture-home/soffbord-york/1746128-01-0",
    "https://www.ellos.se/venture-home/matgrupp-med-plaza-bord-och-4-st-leone-stolar/1530222-01",
    "https://www.ellos.se/venture-home/matgrupp-copenhagen-med-matstol-comfort/1610243-01-0",
    "https://www.ellos.se/venture-home/matgrupp-dipp-med-6-st-matstolar-gemma/1694859-01",
    "https://www.ellos.se/venture-home/ullmatta-iritti/1576108-01",
    "https://www.ellos.se/venture-home/kontinentalsang-med-fast-vaxtorp-tyg/1636636-02-23",
    "https://www.ellos.se/venture-home/soffbord-ruben/1574549-01-0",
    "https://www.ellos.se/venture-home/matgrupp-silar-med-4-st-matstolar-velvet-stitches/1669925-01-0",
    "https://www.ellos.se/venture-home/matgrupp-salto-inkl-6st-matstolar-penally/1619090-01-0",
    "https://www.ellos.se/venture-home/matgrupp-dipp-med-6-st-matstolar-comfort/1694822-01",
    "https://www.ellos.se/venture-home/matgrupp-doris-bord-och-6st-valleta-stolar/1577615-01",
    "https://www.ellos.se/venture-home/undra-carpet/1573237-02-41",
    "https://www.ellos.se/venture-home/matstol-ark/1653274-01",
    "https://www.ellos.se/venture-home/matgrupp-silar-med-4-st-matstolar-velvet-stitches/1669927-01",
    "https://www.ellos.se/venture-home/soffgrupp-watford/1567271-01-0",
    "https://www.ellos.se/venture-home/sidbord-roxwell/1541305-03-0",
    "https://www.ellos.se/venture-home/sang-alvdalen-180x200/1691072-01-23",
    "https://www.ellos.se/venture-home/matbord-volta-o150/1566789-02-0",
    "https://www.ellos.se/venture-home/matgrupp-estelle-med-4st-matstolar-velvet/1582200-01-0",
    "https://www.ellos.se/venture-home/matgrupp-doris-bord-och-6-st-valleta-stolar/1577598-01",
    "https://www.ellos.se/venture-home/matgrupp-pia-inkl-4st-matstolar-valleta/1650228-01-0",
    "https://www.ellos.se/venture-home/kontinentalsang-med-fast-vaxtorp-sammet/1636645-01-23",
    "https://www.ellos.se/venture-home/matbord-glade/1711791-01-0",
    "https://www.ellos.se/venture-home/matgrupp-danburi-med-4-stycken-stolar-polar/1748469-01-0",
    "https://www.ellos.se/venture-home/matgrupp-polar-med-6st-matstolar-comfort/1564751-01-0",
    "https://www.ellos.se/venture-home/matstol-valleta/1616168-01",
    "https://www.ellos.se/venture-home/kontinentalsang-arstad-tyg-fast/1651942-01-23",
    "https://www.ellos.se/venture-home/indra-viscose/1565861-02-41",
    "https://www.ellos.se/venture-home/matgrupp-med-matbord-pia-ek-100-och-4-st-pia-stol/1566825-01",
    "https://www.ellos.se/venture-home/matgrupp-cassie-modulsoffa-och-brina-soffbord/1607587-01",
    "https://www.ellos.se/venture-home/matgrupp-doris-inkl-6st-matstolar-penally/1619024-01",
    "https://www.ellos.se/venture-home/baddsoffa-vicky/1666914-02-0",
    "https://www.ellos.se/hillerstorp/paviljong-pergolux-300x400-cm/1704048-01",
    "https://www.ellos.se/venture-home/matgrupp-doris-med-6-stycken-vallby-matstolar/1652251-01",
    "https://www.ellos.se/venture-home/matstol-petra-2-pack/1666905-02",
    "https://www.ellos.se/venture-home/matstol-berit/1666899-02",
    "https://www.ellos.se/venture-home/matgrupp-leonora-med-2st-stolar-zeno/1746054-01-0",
    "https://www.ellos.se/venture-home/matgrupp-danburi-med-2st-stolar-edvin/1745973-01-0",
]


def ellos_check_product_exist(url: str) -> Optional[str]:
    response = requests.get(url, headers=DEFAULT_REQUEST_HEADER)
    if response.status_code == 404:
        return None
    if response.status_code >= 200 and response.status_code <= 299:
        return response.url

    logger.info("New status code", status_code=response.status_code)
    return response.url


def main():
    OUTPUT_FILEPATH = "products_not_found.csv"
    product_found = {}
    for product_url in urls:
        found_url = ellos_check_product_exist(product_url)
        if found_url:
            logger.info("Product found", url=product_url)
            product_found[product_url] = found_url
        else:
            logger.warning("Not found", url=product_url)

        # Do not scrape too fast
        time.sleep(0.5)

    print("\nTotal products found:", len(product_found), "out of", len(urls))


main()
