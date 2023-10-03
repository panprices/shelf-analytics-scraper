# Getting started with Crawlee

This example uses `PlaywrightCrawler` to recursively crawl https://crawlee.dev using the browser automation library [Playwright](https://playwright.dev).

You can find more examples and documentation at the following links:

- [Step-by-step tutorial](https://crawlee.dev/docs/introduction) for Crawlee
- `PlaywrightCrawler` [API documentation](https://crawlee.dev/api/playwright-crawler/class/PlaywrightCrawler)
- Other [examples](https://crawlee.dev/docs/examples/playwright-crawler)

# test-crawlee

# How to test XPATH locators in the browser

Go to developer console and use
`$x('YOUR_XPATH_HERE')`

# How to record a har file for tests:

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
