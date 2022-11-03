import { log, LoggerJson, LogLevel } from "crawlee";

export class CrawleeLoggerForGCP extends LoggerJson {
  override _log(
    level: LogLevel,
    message: string,
    data?: any,
    exception?: any,
    opts?: Record<string, any>
  ): string {
    return super._log(
      level,
      message,
      {
        ...data,
        severity: level,
      },
      exception,
      opts
    );
  }
}

export function configCrawleeLogger(cloudTrace?: string) {
  if (
    !process.env.PANPRICES_ENVIRONMENT ||
    process.env.PANPRICES_ENVIRONMENT === "local"
  )
    return; // use default setting for local development

  // Production setting:
  log.setOptions({
    logger: new CrawleeLoggerForGCP(),
  });
  const project = process.env.GOOGLE_CLOUD_PROJECT || "panprices";
  if (cloudTrace && project) {
    const [trace] = cloudTrace.split("/");
    log.setOptions({
      data: {
        "logging.googleapis.com/trace": `projects/${project}/traces/${trace}`,
      },
    });
  }
}

export function extractRootUrl(url: string): string {
  const parsedUrl = new URL(url);
  return `${parsedUrl.protocol}//${parsedUrl.host}`;
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
