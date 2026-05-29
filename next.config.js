const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.smitefire.com',
        pathname: '/images/**',
      },
    ],
  },
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com data:",
            "img-src 'self' data: https: blob:",
            "connect-src 'self' https://*.sentry.io https://*.supabase.co wss://*.supabase.co https://discord.com https://cdn.jsdelivr.net",
            "media-src 'self'",
            "frame-ancestors 'none'",
          ].join('; '),
        },
      ],
    },
  ],
  poweredByHeader: false,
};

module.exports = withSentryConfig(nextConfig, {
  silent: true,
  // SENTRY_ORG and SENTRY_PROJECT are only needed at build time for source map uploads.
  // They are optional — if not set, source maps won't upload but the app still works.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: false,
  // Disable tunnelRoute — it adds an API route we don't need at this scale.
  tunnelRoute: undefined,
});
