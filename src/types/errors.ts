class IllFormattedPageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IllFormattedPageError";
  }
}

export { IllFormattedPageError };
