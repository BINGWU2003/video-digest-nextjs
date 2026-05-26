import type { Options } from "tsup";

const config: Options = {
  bundle: false,
  clean: true,
  dts: true,
  format: ["esm"],
  platform: "node",
  sourcemap: true,
  target: "node18",
};

export default config;
