import { log, LoggerJson, LogLevel } from "crawlee";
import { AsyncLocalStorage } from "async_hooks";
import { v4 as uuidv4 } from "uuid";

export const localContext = new AsyncLocalStorage();

/**
 * Add a log trace value to a local context.
 * Then the trace can be attached to all log lines to help debugging on production.
 */
export const loggingMiddleware = (req, res, next) => {
  const project = process.env.GOOGLE_CLOUD_PROJECT || "panprices";
  const cloudTrace = req.get("X-Cloud-Trace-Context");

  let trace;
  if (cloudTrace && project) {
    const [traceId] = cloudTrace.split("/");
    trace = `projects/${project}/traces/${traceId}`;
  } else {
    trace = uuidv4();
  }

  return localContext.run({ trace }, next);
};

export class CrawleeLoggerForGCP extends LoggerJson {
  override _log(
    level: LogLevel,
    message: string,
    data?: any,
    exception?: any,
    opts?: Record<string, any>
  ): string {
    const additionalLogData = localContext.getStore() || {};

    return super._log(
      level,
      message,
      {
        ...data,
        ...additionalLogData,
        level: undefined, // use severity instead
        severity: LogLevel[level],
      },
      exception,
      opts
    );
  }
}

export function configCrawleeLogger(cloudTrace?: string) {
  log.setOptions({
    maxDepth: 10,
  });

  switch (process.env.PANPRICES_ENVIRONMENT) {
    // Local dev setting:
    case "local":
      log.setOptions({
        level: LogLevel.DEBUG,
      });
      break;

    case "sandbox":
    case "production":
    default:
      log.setOptions({
        logger: new CrawleeLoggerForGCP(),
        level: LogLevel.INFO,
      });
    // const project = process.env.GOOGLE_CLOUD_PROJECT || "panprices";
    // if (cloudTrace && project) {
    //   const [trace] = cloudTrace.split("/");
    //   log.setOptions({
    //     data: {
    //       "logging.googleapis.com/trace": `projects/${project}/traces/${trace}`,
    //     },
    //   });
    // }
  }
}
/**
 * Extract domain from URL.
 *
 * Example: https://www.homeroom.se/venture-home/kontinentalsang-fjaras-tyg-medium/1651926-03-23
 *  => homeroom.se
 */
export function extractDomainFromUrl(url: string): string {
  const parsedUrl = new URL(url);
  const domain = parsedUrl.hostname.replace(/^www\./, "");
  return domain;
}

/**
 * Extract a number from a text.
 * Will throw an Error if there isn't exactly 1 number.
 *
 * Examples:
 * "EAN code : 7350133233787" => 7350133233787
 */
export function extractNumberFromText(text: string): number {
  const matches = text.replace(/ /g, "").match(/\d+/);
  if (!matches) throw Error(`No number found in text: ${text}`);
  if (matches.length > 1)
    throw Error(`More than 1 number found in text: ${text}`);

  const num = parseInt(matches[0]);
  return num;
}

/**
 * Convert currency symbol to ISO 4217 code.
 */
export function convertCurrencySymbolToISO(symbol: string): string {
  const symbolToCode: Record<string, string> = {
    "€": "EUR",
    $: "USD", // for some reason the quotation mark is not needed and removed by prettier
  };

  const code = symbolToCode[symbol];
  if (!code) throw Error(`Unknown currency symbol: ${symbol}`);

  return code;
}
