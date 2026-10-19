/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/v5',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  reactStrictMode: false,
  swcMinify: true,
  poweredByHeader: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
