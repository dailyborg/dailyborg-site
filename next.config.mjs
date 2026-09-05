/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cloudflare Pages serves images as-is; Next's optimizer is not available at the edge.
  images: { unoptimized: true },
  // Type checking is run separately with `npm run check`; ESLint is not part of the build.
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
};

export default nextConfig;
