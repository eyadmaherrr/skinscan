import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';
const apiOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_API_BASE_URL ? new URL(process.env.NEXT_PUBLIC_API_BASE_URL).origin : '';
  } catch {
    return '';
  }
})();

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  `connect-src 'self'${apiOrigin ? ` ${apiOrigin}` : ''}`,
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=()' },
  ...(isProd
    ? [
        { key: 'Content-Security-Policy', value: csp },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
      ]
    : []),
];

// ONNX Runtime ships native binaries for every platform (~200 MB). Only the
// build platform's binaries are traced into the server bundle.
const ortPlatforms = ['darwin/arm64', 'darwin/x64', 'linux/arm64', 'linux/x64', 'win32/arm64', 'win32/x64'];
const keep = `${process.platform}/${process.arch}`;
const ortExcludes = ortPlatforms
  .filter((p) => p !== keep)
  .map((p) => `./node_modules/onnxruntime-node/bin/napi-v6/${p}/**`);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // English (app/(en)) and Arabic (app/ar) each have their own root layout, so
  // unknown URLs use app/global-not-found.tsx.
  experimental: { globalNotFound: true },
  serverExternalPackages: ['onnxruntime-node', 'sharp'],
  // The models and ONNX Runtime's native library (loaded dynamically by its
  // Node binding, so not found by tracing) must ship with the API routes.
  outputFileTracingIncludes: {
    '/api/skin-scan': ['./models/**/*', `./node_modules/onnxruntime-node/bin/napi-v6/${keep}/**/*`],
    '/api/health': ['./models/**/*', `./node_modules/onnxruntime-node/bin/napi-v6/${keep}/**/*`],
  },
  outputFileTracingExcludes: {
    '/*': ortExcludes,
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
