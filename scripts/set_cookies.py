import subprocess
import json
import time
import os

import requests

dir_path = os.path.dirname(os.path.realpath(__file__))

product_url = (
    "https://www.wayfair.de/accessoires/pdp/apelt-kissenfuellung-aaat1734.html"
)


def set_cookie_for_an_IP():
    # Clean the storage folder. Just to make sure we don't persist the cookies between
    # sessions and
    os.system("rm -r storage/")

    bashCommand = "npm run dev"
    with subprocess.Popen(bashCommand.split()) as process:
        # output, error = process.communicate()
        # print(output)

        time.sleep(10)

        make_requests()

        # This doesn't work
        process.terminate()
        process.kill()

    os.system("kill -9 $(lsof -t -i:8080)")


def make_requests():
    url = "http://localhost:8080/scrapeDetails"
    payload = json.dumps(
        {
            "launchOptions": {"ignoreVariants": True},
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
    for _ in range(10):
        set_cookie_for_an_IP()
