import { packageConfig } from "@video-digest-nextjs/tsup-config/package";
import { defineConfig } from "tsup";

export default defineConfig({
  ...packageConfig,
  entry: ["src/**/*.ts"],
});
