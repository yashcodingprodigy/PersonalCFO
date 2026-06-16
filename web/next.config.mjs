/** @type {import('next').NextConfig} */

// When BUILD_TARGET=mobile we produce a static export (into ./out) that
// Capacitor bundles into the native app. The bundled app talks to the live
// API via NEXT_PUBLIC_API_URL. Custom headers aren't supported by static
// export (and aren't needed in the native shell), so they stay web-only.
const isMobile = process.env.BUILD_TARGET === 'mobile';

const webConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    },
  ],
};

const mobileConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
};

export default isMobile ? mobileConfig : webConfig;
