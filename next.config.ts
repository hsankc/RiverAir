import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // There is an unrelated package-lock.json in the user's home directory, and
    // without this Next walks up and picks that as the workspace root.
    root: path.resolve(process.cwd()),
  },
};

export default nextConfig;
