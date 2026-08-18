import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import adapter from "svelte-adapter-bun";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    experimental: { remoteFunctions: true },
    alias: {
      "elysia-api": "src/routes/api/[...slugs]/+server.ts",
    },
    version: {
      pollInterval: 5000,
    },
  },
  compilerOptions: {
    experimental: {
      async: true,
    },
  },
};

export default config;
