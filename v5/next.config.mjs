/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/v5',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
