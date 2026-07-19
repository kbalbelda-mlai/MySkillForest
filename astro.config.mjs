// @ts-check
import { defineConfig } from "astro/config";
import node from "@astrojs/node";

export default defineConfig(({ command }) => {
  if (command === "dev") {
    return {
      output: "server",
      adapter: node({
        mode: "standalone",
      }),
      site: "http://localhost:4321",
      base: "/",
    };
  }

  return {
    output: "static",
    site: "https://kbalbelda-mlai.github.io",
    base: "/MySkillForest",
  };
});