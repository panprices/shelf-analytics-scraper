import { log, LoggerJson, LogLevel } from "crawlee";
import { Request, Response, NextFunction } from "express";
import { AsyncLocalStorage } from "async_hooks";
import { v4 as uuidv4 } from "uuid";
import { LocalContextStore } from "./types/utils";
import { readdir } from "fs/promises";
import { MemoryStorage } from "@crawlee/memory-storage";
import fs from "fs";
import { Availability } from "./types/offer";

export const localContext = new AsyncLocalStorage<LocalContextStore>();

/**
 * Config logging for local dev and to debug on GCP.
 */
export const loggingMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  let contextStore: LocalContextStore = {};

  // Config logging
  log.setOptions({
    maxDepth: 10,
  });
  switch (process.env.PANPRICES_ENVIRONMENT) {
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

      // Add a log trace value to a local context.
      // Then the trace can be attached to all log lines.
      const project = process.env.GOOGLE_CLOUD_PROJECT || "panprices";
      const cloudTrace =
        req.get("X-Cloud-Trace-Context") ||
        `projects/${project}/traces/${uuidv4()}`;
      contextStore = {
        logData: {
          "logging.googleapis.com/trace": cloudTrace,
        },
      };
  }

  localContext.run(contextStore, () => {
    // Log request data for easier debug on GCP
    log.info(req.path, {
      payload: req.body,
    });

    next();
  });
};

export class CrawleeLoggerForGCP extends LoggerJson {
  override _log(
    level: LogLevel,
    message: string,
    data?: any,
    exception?: any,
    opts?: Record<string, any>
  ): string {
    const additionalLogData = localContext.getStore()?.logData;
    if (additionalLogData) {
      data = { ...data, ...additionalLogData };
    }

    return super._log(
      level,
      message,
      {
        ...data,
        level: undefined, // use severity instead
        severity: LogLevel[level],
      },
      exception,
      opts
    );
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
  const domain = parsedUrl.hostname
    .replace(/^www\./, "")
    .replace(/^www2\./, "");
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

export function pascalCaseToSnakeCase(text: string): string {
  const regex = /(?<!^)(?=[A-Z])/g;
  return text.replaceAll(regex, "_").toLocaleLowerCase();
}

/**
 * Convert schema.org availability into our own.
 * For example: "http:\/\/schema.org\/InStock" -> "in_stock"
 */
export function convertSchemaOrgAvailability(
  schemaOrgAvailability: string
): string {
  const text = schemaOrgAvailability.split("/").pop();
  if (!text) {
    throw new Error(`Invalid value of schema.org availability: ${text}`);
  }
  return pascalCaseToSnakeCase(text);
}

/**
 * Merge 2 objects while prioritising non-null and defined properties.
 * If both have the same propertise, prioritise obj2 (same as the spread syntax)
 */
export function mergeTwoObjectsPrioritiseNonNull(obj1: any, obj2: any) {
  const merged = { ...obj1, ...obj2 };
  for (const key in obj1) {
    if (!merged[key] && obj1[key]) {
      merged[key] = obj1[key];
    }
  }
  return merged;
}

/** Normalise an url.
 * Especially useful when we need to use the url as an unique identifier.
 */
export function normaliseUrl(url: string, baseWebsiteUrl: string): string {
  return new URL(url, baseWebsiteUrl).href;
}

async function renameFoldersForDeletion(
  rootDir: string,
  uniqueCrawlerKey: string
) {
  // Key-value stores
  const folders = await readdir(rootDir).catch(() => []);

  log.debug("Renaming folders for deletion", {
    rootDir,
    nrFolders: folders.length,
    uniqueCrawlerKey,
  });

  for (const existingFolder of folders) {
    log.debug(existingFolder);
    if (
      existingFolder.startsWith("__CRAWLEE_PANPRICES") &&
      existingFolder.endsWith(uniqueCrawlerKey)
    ) {
      log.debug("Renaming", {
        from: rootDir + "/" + existingFolder,
        to: rootDir + "/" + existingFolder.replace("PANPRICES", "TEMPORARY"),
      });
      log.debug(rootDir + "/" + existingFolder);
      // rename the folder to force deleting when on the next run
      fs.renameSync(
        rootDir + "/" + existingFolder,
        rootDir + "/" + existingFolder.replace("PANPRICES", "TEMPORARY")
      );
    }
  }
}

/**
 * Changes the name of the folders from __CRAWLEE_PANPRICES_* to __CRAWLEE_TEMPORARY_* so they will be deleted on the
 * next run of a crawler on the same instance / pod
 * @param uniqueCrawlerKey
 */
export async function clearStorage(uniqueCrawlerKey: string) {
  const storageClient = new MemoryStorage();

  await renameFoldersForDeletion(
    storageClient.keyValueStoresDirectory,
    uniqueCrawlerKey
  );
  await renameFoldersForDeletion(
    storageClient.datasetsDirectory,
    uniqueCrawlerKey
  );
  await renameFoldersForDeletion(
    storageClient.requestQueuesDirectory,
    uniqueCrawlerKey
  );
}
