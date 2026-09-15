import { env } from "../config/env.js";

// Helper to resolve safe callback URLs restricting redirects strictly to the trusted frontend origin
export const resolveCallbackURL = (
  redirectTo?: string,
  defaultPath = "/dashboard",
): string => {
  if (!redirectTo) {
    return `${env.FRONTEND_URL}${defaultPath}`;
  }

  // Prevent protocol-relative URLs (e.g. "//evil.com")
  if (redirectTo.startsWith("//")) {
    return `${env.FRONTEND_URL}${defaultPath}`;
  }

  // If an absolute URL is provided, strictly validate origin match
  if (redirectTo.startsWith("http://") || redirectTo.startsWith("https://")) {
    try {
      const targetUrl = new URL(redirectTo);
      const trustedUrl = new URL(env.FRONTEND_URL);

      if (targetUrl.origin === trustedUrl.origin) {
        return redirectTo;
      }
    } catch {
      // Invalid URL syntax: fall back safely to default trusted path
      return `${env.FRONTEND_URL}${defaultPath}`;
    }

    // External or untrusted domain: safely fall back to default path on trusted origin
    return `${env.FRONTEND_URL}${defaultPath}`;
  }

  // Relative path resolution (ensures leading slash)
  return `${env.FRONTEND_URL}${redirectTo.startsWith("/") ? redirectTo : `/${redirectTo}`}`;
};
