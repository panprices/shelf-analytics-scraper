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
    {"sku": "1139375"},
    {"sku": "1475862"},
    {"sku": "1350731"},
]

logger = structlog.get_logger()

DEFAULT_REQUEST_HEADER = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
}


def venture_design_search_url(query: str) -> str:
    return f"https://www.venturedesign.se/search/{query}"


def trademax_search_url(query: str) -> str:
    return f"https://www.trademax.se/search?q={query}"


def trademax_search_by_sku(sku: str) -> Optional[str]:
    """Find the product on Trademax and return the product url"""
    url = trademax_search_url(sku)
    response = requests.get(url, headers=DEFAULT_REQUEST_HEADER)
    if response.status_code >= 300:
        raise Exception(f"Request error, status_code: {response.status_code}")

    html = response.text
    with open("./tmp.html", "w") as f:
        f.write(html)

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


def main():
    OUTPUT_FILEPATH = "products_not_found.csv"
    product_found = {}

    # convert_to_search_url = trademax_search_url
    convert_to_search_url = bygghemma_search_url

    for p in missing_products:
        sku = str(p["sku"])
        product_url = trademax_search_by_sku(sku)
        if product_url is not None:
            logger.info(
                "Product found",
                sku=sku,
                search_url=trademax_search_url(sku),
                url=product_url,
            )
            product_found[p["sku"]] = product_url
        else:
            logger.warning(
                "Not found", sku=sku, search_url=trademax_search_url(sku), url=None
            )

        # Do not scrape too fast
        # time.sleep(0.5)

    print(
        "\nTotal products found:", len(product_found), "out of", len(missing_products)
    )

    with open("products_found.csv", "w") as f:
        for url in product_found.values():
            f.write(url)
            f.write("\n")

    not_found = set([p["sku"] for p in missing_products]) - set(product_found.keys())
    not_found = list(not_found)

    with open(OUTPUT_FILEPATH, "w") as f:
        for sku in not_found:
            f.write(sku)
            f.write("\n")


if __name__ == "__main__":
    main()
