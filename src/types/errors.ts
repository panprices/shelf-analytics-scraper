class IllFormattedPageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IllFormattedPageError";
  }
}

class PageNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PageNotFoundError";
  }
}

class CaptchaEncounteredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CaptchaEncounteredError";
  }
}

export { IllFormattedPageError, PageNotFoundError, CaptchaEncounteredError };
