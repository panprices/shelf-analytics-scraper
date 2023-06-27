import { NonRetryableError } from "crawlee";

export class IllFormattedPageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IllFormattedPageError";
  }
}

export class PageNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PageNotFoundError";
  }
}

export class CaptchaEncounteredError extends NonRetryableError {
  constructor(message: string) {
    super(message);
    this.name = "CaptchaEncounteredError";
  }
}

export class GotBlockedError extends NonRetryableError {
  constructor(message: string) {
    super(message);
    this.name = "GotBlockedError";
  }
}
