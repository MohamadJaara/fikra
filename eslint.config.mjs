import nextConfig from "eslint-config-next";

const config = [...nextConfig];

config.push({
  ignores: ["convex/_generated/**"],
});

export default config;
