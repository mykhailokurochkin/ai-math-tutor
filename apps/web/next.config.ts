import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ai-math-tutor/tutor-harness"],
  serverExternalPackages: ["@langchain/langgraph", "@langchain/core"],
};

export default nextConfig;
