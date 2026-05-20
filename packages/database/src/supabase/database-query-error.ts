export class DatabaseQueryError extends Error {
  constructor(
    message: string,
    readonly cause: unknown,
  ) {
    super(message);
    this.name = "DatabaseQueryError";
  }
}
