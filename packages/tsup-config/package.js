/** @type {import("tsup").Options} */
export const packageConfig = {
  bundle: false,
  clean: true,
  dts: true,
  format: ["esm"],
  platform: "node",
  sourcemap: true,
  target: "node18",
};
