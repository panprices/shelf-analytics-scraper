# Setup

Install node and npm: https://docs.npmjs.com/downloading-and-installing-node-js-and-npm

Run `npm install`

# Getting started with Crawlee

This project uses Playwright through the Crawlee library to scrape product information.
You can find more examples and documentation at the following links:

- [Introduction to Crawlee](https://crawlee.dev/docs/introduction)
- `PlaywrightCrawler` [API documentation](https://crawlee.dev/api/playwright-crawler/class/PlaywrightCrawler)
- Other [examples](https://crawlee.dev/docs/examples/playwright-crawler)

# Create a new scraper

First run this script to create a `scraper.ts` file based on our template

```bash
npm run script:create-scraper gigameubel.nl Gigameubel
```

Then just fill in the missing parts in that new scraper.

# Deployment

Configuration for production deployment on kubernetes is in the k8s/ folder.
Sandbox deployment is still on CloudRun to reduce cost (k8s need an always running pod),
and its configuration is `cloudbuild_sandbox.yaml`.

# Kubernetes

## Installation

Most of the operations on kubernetes can be performed through CLI using the following client:

```commandline
gcloud components install kubectl
```

## Update the pod configuration

To update the pod configuration run the following command:

```commandline
kubectl apply -f k8s/deployment.yaml
```

## Trigger image update (when the pod config stays the same but we update the image)

```commandline
kubectl rollout restart deployment/shelf-analytics-scraper
```

## Misc.

### How to test XPATH locators in the browser

Go to developer console and use
`$x('YOUR_XPATH_HERE')`

### How to record a har file for tests:

Add the following `overrides` option to the crawler:

```javascript
        launchContext: {
          launchOptions: <any>{
            recordHar: {
              path: "example.har",
            },
          },
          experimentalContainers: true,
          launcher:
        },
```

### Start the chromium browser manually (MacOS):

```commandline
open ~/Library/Caches/ms-playwright/chromium-1071/chrome-mac/Chromium.app/
```
