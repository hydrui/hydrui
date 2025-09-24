import htmlmin from "html-minifier";
import EleventyVitePlugin from "@11ty/eleventy-plugin-vite";

export default function (eleventyConfig) {
  eleventyConfig.addGlobalData("baseUrl", "https://hydrui.dev");
  eleventyConfig.addTransform("htmlmin", function (content) {
    if (this.page.outputPath && this.page.outputPath.endsWith(".html")) {
      let minified = htmlmin.minify(content, {
        useShortDoctype: true,
        removeComments: true,
        collapseWhitespace: true,
        minifyJS: true,
        processScripts: ["application/ld+json"],
      });
      return minified;
    }
    return content;
  });
  eleventyConfig.addPlugin(EleventyVitePlugin, {
    viteOptions: {
      appType: "custom",
      assetsInclude: ["**/*.xml", "**/*.txt"],
      server: {
        mode: "production",
        middlewareMode: true,
      },
    },
  });
  eleventyConfig.addPassthroughCopy("src");
  return {
    dir: {
      input: "src",
      output: "dist",
    },
  };
}
