import dts from "bun-plugin-dts";
import * as Bun from "bun";

await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  minify: true,
});
