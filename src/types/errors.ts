import { NonRetryableError, RetryRequestError } from "crawlee";

export class IllFormattedPageError extends NonRetryableError {
  constructor(message: string) {
    super(message);
    this.name = "IllFormattedPageError";
  }
}

export class PageNotFoundError extends NonRetryableError {
  constructor(message: string) {
    super(message);
    this.name = "PageNotFoundError";
  }
}

export class CaptchaEncounteredError extends RetryRequestError {
  constructor(message: string) {
    super(message);
    this.name = "CaptchaEncounteredError";
  }
}

export class GotBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GotBlockedError";
  }
}
