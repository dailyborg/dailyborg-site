/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cloudflare Pages serves images as-is; Next's optimizer is not available at the edge.
  images: { unoptimized: true },
  // Type checking is run separately with `npm run check`; ESLint is not part of the build.
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
  // Baseline security headers for every route. public/_headers covers the static
  // asset paths that Cloudflare Pages serves without touching a function.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
