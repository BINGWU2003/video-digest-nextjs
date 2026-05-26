# @video-digest-nextjs/tsup-config

共享 tsup 配置包，供 packages 下的 TypeScript 子包复用。

## 职责

- 统一 packages 的 tsup 构建选项。
- 默认输出 ESM。
- 生成 `.d.ts` 类型声明。
- 保持文件级输出，不把内部模块打包成单文件。
- 清理 `dist` 并生成 sourcemap。

## 导出项

```txt
@video-digest-nextjs/tsup-config/package
```

## 使用方式

每个需要构建的子包保留自己的 `tsup.config.ts`：

```ts
import { packageConfig } from "@video-digest-nextjs/tsup-config/package";
import { defineConfig } from "tsup";

export default defineConfig({
  ...packageConfig,
  entry: ["src/**/*.ts"],
});
```

业务子包仍需要在自己的 `devDependencies` 中声明：

```json
{
  "tsup": "catalog:"
}
```

原因是 pnpm 执行子包脚本时，`tsup` 可执行文件需要存在于当前包可解析的 `.bin` 环境中。`@video-digest-nextjs/tsup-config` 自己也声明 `tsup`，用于让 JSDoc 类型 `import("tsup").Options` 正确解析。

## 当前公共配置

```txt
bundle: false
clean: true
dts: true
format: ["esm"]
platform: "node"
sourcemap: true
target: "node18"
```

## 边界

- 只维护构建配置。
- 不放业务代码。
- 不替代 TypeScript 类型检查；类型检查仍由 `tsc --noEmit` 执行。
