The triangle of sadness consists of the following retailers:

- trademax
- chilli
- furniturebox

They are all managed by the same group. They blocked our dedicated IP addresses.

We are scraping them shared datacenter proxies from oxylabs.

Logs:

# 14.02.2023

We noticed an issue on the triangle of sadness retailers. The error is: `net::ERR_CONNECTION_CLOSED`.

To address this we changed from the german proxies in the shared datacenter pool to the british (UK) ones.
This is just delaying the problem for the moment.

# 15.02.2023

We went over the traffic / bandwidth threshold for the shared datacenter proxies.

Looking at the logs of the last successful run, we noticed that the log "Looking at product page" appeared about 103k
times, which is a lot. Will further investigate if some of these are duplicates.

A patch solution is to implement the workflow in which we only scrape product pages we already know of instead of doing
category indexing. This means we still need to fix the category indexing in the near future.

One improvement we discussed is to use cheerio for the first attempt at a detail page. The issue in this approach (at
least the one we identified so far) is that we can't access different variants in this way (which involves clicking
buttons). The thinking is that we do all the detail scraping with cheerio at first, and then just for the pages where
we had a matched SKU, we follow the URLs and do a full indexing (grabbing all the info that requires button clicking).

# 21.02.2023

Disabled variant checking for the triangle of sadness retailers. We did this because for now we only want to go to
urls we already know of. And we supposedly know the URLs for each different variant. This helps save up traffic.

# 16.03.2023

We tried to scrape products from Trademax by going to the brand page: https://www.trademax.se/varum%C3%A4rken/venture-home
and https://www.trademax.se/varum%C3%A4rken/furniture-fashion.
From this we noticed that:

- Their brand page does not have all the products from a brand. We saw products that exist when we scrape
  their category pages, but do not exist in the brand page.
- They probably do remove and add products quite frequently. We found 160K products in their sitemap.xml,
  which 114K we know of, but we have 190K products in our DB.
  Toan also saw that some urls in our DB are broken.
