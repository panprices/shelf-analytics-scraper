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