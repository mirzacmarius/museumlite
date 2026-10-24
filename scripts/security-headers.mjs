/**
 * Response headers for the app, derived from the deployment's own
 * configuration so no host is hard-coded twice.
 *
 * The Content-Security-Policy ships in report-only mode: violations reach
 * Sentry (when a DSN is configured) without blocking anything, so the policy
 * can be tightened before it is enforced.
 */

function origin(value) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Sentry accepts browser security reports at
 * `https://<host>/api/<project>/security/?sentry_key=<public key>`; the
 * parts come from the DSN `https://<public key>@<host>/<project>`.
 */
export function sentrySecurityReportUri(dsn) {
  if (!dsn) return null;
  let parsed;
  try {
    parsed = new URL(dsn);
  } catch {
    return null;
  }
  const project = parsed.pathname.split("/").filter(Boolean).pop();
  if (!parsed.username || !project) return null;
  return `${parsed.protocol}//${parsed.host}/api/${project}/security/?sentry_key=${parsed.username}`;
}

export function contentSecurityPolicy({
  convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL,
  convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
  webUrl = process.env.NEXT_PUBLIC_WEB_URL,
  sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN,
  nodeEnv = process.env.NODE_ENV,
} = {}) {
  const convexOrigin = origin(convexUrl);
  // HTTP actions (owned uploads, export downloads) live on the deployment's
  // `.convex.site` host unless a site URL is configured, as in the app.
  const convexSiteOrigin =
    origin(convexSiteUrl) ??
    (convexOrigin?.endsWith(".convex.cloud")
      ? convexOrigin.replace(/\.cloud$/, ".site")
      : null);
  // Framed content: PDF previews from storage, Sketchfab models, and the
  // public portal preview from the marketing site.
  const frames = new Set(["'self'", "https://sketchfab.com"]);
  if (convexOrigin) frames.add(convexOrigin);
  for (const portal of [
    origin(webUrl),
    "https://www.museumlite.com",
    nodeEnv === "production" ? null : "http://localhost:3001",
  ]) {
    if (portal) frames.add(portal);
  }
  const connect = new Set([
    "'self'",
    "https://vitals.vercel-insights.com",
    "https://*.ingest.sentry.io",
    "https://*.ingest.us.sentry.io",
    "https://*.ingest.de.sentry.io",
  ]);
  const images = new Set([
    "'self'",
    "data:",
    "blob:",
    "https://lh3.googleusercontent.com",
  ]);
  const media = new Set(["'self'", "blob:"]);
  if (convexOrigin) {
    connect.add(convexOrigin);
    connect.add(convexOrigin.replace(/^http/, "ws"));
    images.add(convexOrigin);
    media.add(convexOrigin);
  }
  if (convexSiteOrigin) connect.add(convexSiteOrigin);

  // Next.js inlines bootstrap scripts without nonces, and development needs
  // eval for fast refresh; both stay visible in the reports.
  const scripts = [
    "'self'",
    "'unsafe-inline'",
    "https://va.vercel-scripts.com",
  ];
  if (nodeEnv !== "production") scripts.push("'unsafe-eval'");

  const directives = {
    "default-src": ["'self'"],
    "script-src": scripts,
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": [...images],
    "media-src": [...media],
    "font-src": ["'self'", "data:"],
    "connect-src": [...connect],
    "worker-src": ["'self'", "blob:"],
    "frame-src": [...frames],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
  };
  const reportUri = sentrySecurityReportUri(sentryDsn);
  if (reportUri) directives["report-uri"] = [reportUri];

  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

/** Headers for every response of the app. */
export function securityHeaders(options = {}) {
  return [
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value:
        "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
    },
    {
      key: "Content-Security-Policy-Report-Only",
      value: contentSecurityPolicy(options),
    },
  ];
}
