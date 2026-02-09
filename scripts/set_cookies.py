import subprocess
import json
import time
import os

import requests

dir_path = os.path.dirname(os.path.realpath(__file__))

# CHANGE THIS if you want to do retailers other than wayfair
product_url = "https://www.wayfair.de/moebel/pdp/hykkon-sofa-tomlin-d110017167.html?piid=382835855%2C382835846"
ips = [
    "<PROXY_IP>",
    "<PROXY_IP>",
    "<PROXY_IP>",
    "<PROXY_IP>",
    "<PROXY_IP>",
    "<PROXY_IP>",
    "<PROXY_IP>",
    "<PROXY_IP>",
    "<PROXY_IP>",
    "<PROXY_IP>",
    "<PROXY_IP>",
    "<PROXY_IP>",
    "<PROXY_IP>",
    "<PROXY_IP>",
    "<PROXY_IP>",
    "<PROXY_IP>",
    "<PROXY_IP>",
    "<PROXY_IP>",
    "<PROXY_IP>",
    "<PROXY_IP>",
    "<PROXY_IP>",
    "<PROXY_IP>",
]


def set_cookie_for_an_IP(ip: str):
    # Clean the storage folder. Just to make sure we don't persist the cookies between
    # sessions.
    os.system("rm -r storage/")

    bashCommand = "npm run dev"
    with subprocess.Popen(bashCommand.split()) as process:
        # output, error = process.communicate()
        # print(output)

        time.sleep(10)

        make_requests(ip)

        process.terminate()
        process.kill()

    # The process.kill() doesn't seem to work well, so we do this as well to make sure:
    os.system("kill -9 $(lsof -t -i:8080)")
    print("Set cookie for IP: " + ip + " successfully")


def make_requests(ip: str):
    url = "http://localhost:8080/scrapeDetails"
    payload = json.dumps(
        {
            "launchOptions": {
                "ignoreVariants": True,
                "ip": ip,
            },
            "overrides": {"headless": False},
            "productDetails": [
                {
                    "url": product_url,
                    "userData": {
                        "jobId": "job_test_toan_local",
                        "url": "",
                        "label": "DETAIL",
                        "matchingType": "non_match",
                    },
                },
            ],
            "jobContext": {
                "jobId": "job_test_toan_local",
                "env": "production",
                "skipPublishing": True,
                "scraperCategoryPage": "playwright",
                "scraperProductPage": "playwright",
            },
        }
    )
    headers = {
        "X-Cloud-Trace-Context": "projects/panprices/traces/trace_toan_local",
        "Content-Type": "application/json",
    }

    response = requests.request("POST", url, headers=headers, data=payload)
    print(response.text)


if __name__ == "__main__":
    for ip in ips:
        set_cookie_for_an_IP(ip)
