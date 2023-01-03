import { JobContext } from "./types/offer";
import { Storage } from "@google-cloud/storage";
import {
  CACHE_ARCHIVE_NAME,
  CACHES_BUCKET,
  CHROMIUM_USER_DATA_DIR,
  JOBS_DIRECTORY,
} from "./constants";
import decompress from "decompress";
import AdmZip from "adm-zip";
import { log } from "crawlee";

/**
 * Downloads the existent cache from the google storage bucket. It returns whether the cache was already created for
 * this type of operation (as indicated by the marker file). Even if the cache was not updated by a worker operating on
 * the current type of task, we still take any existent cache, but we will update it at the end.
 *
 * @param jobContext
 * @param markerFileName
 */
export async function downloadCache(
  jobContext: JobContext,
  markerFileName: string
): Promise<boolean> {
  const storage = new Storage();
  const bucket = storage.bucket(CACHES_BUCKET);
  const cacheArchive = bucket.file(
    `${JOBS_DIRECTORY}/${jobContext.jobId}/${CACHE_ARCHIVE_NAME}`
  );

  const cacheArchiveExists = (await cacheArchive.exists())[0];
  if (cacheArchiveExists) {
    await cacheArchive.download({
      destination: CACHE_ARCHIVE_NAME,
    });

    await decompress(CACHE_ARCHIVE_NAME, `${CHROMIUM_USER_DATA_DIR}/Default`);
    log.info("Downloaded cache for job");
  }

  const markerFile = bucket.file(
    `${JOBS_DIRECTORY}/${jobContext.jobId}/${markerFileName}`
  );
  return !(await markerFile.exists())[0];
}

export async function uploadCache(
  jobContext: JobContext,
  markerFileName: string
) {
  const zip = new AdmZip();
  zip.addLocalFolder(`${CHROMIUM_USER_DATA_DIR}/Default/Cache`, "Cache");
  zip.addLocalFolder(
    `${CHROMIUM_USER_DATA_DIR}/Default/Code Cache`,
    "Code Cache"
  );

  zip.writeZip(`${CACHE_ARCHIVE_NAME}`);
  const storage = new Storage();
  const bucket = storage.bucket(CACHES_BUCKET);
  await bucket.upload(CACHE_ARCHIVE_NAME, {
    destination: `${JOBS_DIRECTORY}/${jobContext.jobId}/${CACHE_ARCHIVE_NAME}`,
  });
  await bucket
    .file(`${JOBS_DIRECTORY}/${jobContext.jobId}/${markerFileName}`)
    .save("Saved");

  log.info("Updated cache for job");
}
