declare namespace Express {
  interface Locals {
    validated?: {
      body?: unknown;
      params?: unknown;
      query?: unknown;
    };
  }
}
