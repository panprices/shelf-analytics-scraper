import { BlobStorage } from "./abstract";
import { Storage, TransferManager } from "@google-cloud/storage";
import * as Buffer from "node:buffer";
import fs from "fs";

export class GoogleCloudBlobStorage implements BlobStorage {
  private readonly __bucketName;
  private readonly __storage;

  constructor() {
    this.__bucketName = "b2b_shelf_analytics_images";
    this.__storage = new Storage();
  }

  async upload(filePath: string): Promise<void> {
    await this.__storage.bucket(this.__bucketName).upload(filePath, {
      destination: `screenshots/${filePath.split("/").pop()}`,
    });
  }

  async uploadMultiple(filePaths: string[]): Promise<void> {
    const transferManager = new TransferManager(
      this.__storage.bucket(this.__bucketName)
    );
    await transferManager.uploadManyFiles(filePaths, {
      prefix: "screenshots/",
    });
  }

  async uploadFromBuffer(
    buf: Buffer,
    name: string,
    contentType: string
  ): Promise<void> {
    fs.writeFileSync(`storage/screenshots/${name}`, buf);
    await this.__storage
      .bucket(this.__bucketName)
      .file(`screenshots/${name}`)
      .save(buf, {
        contentType,
      });
  }
}
