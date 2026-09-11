import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Two lockfiles exist in this repo (root tayeon app + this admin app);
  // pin the workspace root so Turbopack doesn't infer the wrong one.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
