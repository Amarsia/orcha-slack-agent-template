import type { NextConfig } from "next";
import { withOrcha } from "orchajs/next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
};

export default async function configureNext() {
  return withOrcha(nextConfig);
}
