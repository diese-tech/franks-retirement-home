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
};
module.exports = nextConfig;
