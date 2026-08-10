import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next drops assistant rule files into the project root on every dev start. Off, they are
  // not part of this project and should not be checked in.
  agentRules: false,
  // This project sits next to other repos, so point the build root at itself rather than letting
  // it guess from the nearest lockfile it can find.
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
