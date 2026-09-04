// Custom error class with HTTP status code support
class AppError extends Error {
  public isOperational: boolean;
  constructor(
    public statusCode: number,
    message: string,
    stack?: string,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.isOperational = true;

    // Capture the stack trace
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export { AppError };
