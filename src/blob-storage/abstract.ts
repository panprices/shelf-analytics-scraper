import Buffer from "node:buffer";

export interface BlobStorage {
  uploadFromBuffer(
    buf: Buffer,
    name: string,
    contentType: string
  ): Promise<void>;

  upload(filePath: string): Promise<void>;

  uploadMultiple(filePaths: string[]): Promise<void>;
}
