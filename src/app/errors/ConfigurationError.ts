// Internal configuration error representing startup or environment validation failure
class ConfigurationError extends Error {
  public readonly code = "CONFIGURATION_ERROR" as const;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export { ConfigurationError };
