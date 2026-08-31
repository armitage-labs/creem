/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@creem_io/better-auth"],
  serverExternalPackages: ["better-sqlite3"],
};

module.exports = nextConfig;
