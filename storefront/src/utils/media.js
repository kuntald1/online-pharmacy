// The PillPoints backend returns image URLs in two different shapes
// depending on the endpoint:
//   1. Absolute, baked with whatever host the backend thinks it's running
//      on (e.g. "http://localhost:8020/uploads/x.png") — this works fine
//      when the backend and browser are on the same machine (local dev),
//      but on a real visitor's browser "localhost" means their own
//      computer, not the server — the request fails outright
//      (net::ERR_CONNECTION_REFUSED), which is exactly what broke image
//      loading in production here.
//   2. Bare relative paths (e.g. "/uploads/x.png") — some endpoints
//      (returns, profile image) return this shape instead.
//
// This handles both, and leaves an already-correct absolute URL (a real
// host, e.g. production already returning "https://pillpoints.duckdns.org/...")
// untouched. Same logic already proven correct on the mobile app's
// src/utils/media.ts — ported here since the storefront had no equivalent
// at all (every component was using the raw backend value directly).

import { API_BASE } from "../api/client";

export function resolveImageUrl(url) {
  if (!url) return undefined;

  // Absolute URL pointing at localhost/127.0.0.1 (dev-only artifact baked
  // into the backend's response) — rewrite the host to match wherever this
  // app is actually configured to reach the API.
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(url)) {
    return url.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i, API_BASE);
  }

  // Bare relative path — prefix with the API base so the browser gets a
  // fully-qualified URL.
  if (url.startsWith("/")) {
    return `${API_BASE}${url}`;
  }

  // Already an absolute URL with a real host — leave as is.
  return url;
}
