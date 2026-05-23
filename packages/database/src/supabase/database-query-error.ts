export class DatabaseQueryError extends Error {
  constructor(
    message: string,
    readonly cause: unknown,
  ) {
    super(message);
    this.name = "DatabaseQueryError";
  }
}

type SupabaseErrorLike = {
  code?: string;
  message?: string;
};

export function isMissingDatabaseSchemaError(caught: unknown) {
  const cause = caught instanceof DatabaseQueryError ? caught.cause : caught;

  if (!isSupabaseErrorLike(cause)) {
    return false;
  }

  return (
    cause.code === "PGRST205" ||
    cause.message?.includes("Could not find the table") === true
  );
}

function isSupabaseErrorLike(cause: unknown): cause is SupabaseErrorLike {
  return typeof cause === "object" && cause !== null;
}
