# @video-digest-nextjs/eslint-config

共享 ESLint 配置包，供 monorepo 内的 apps 和 packages 复用。

## 职责

- 暴露基础 TypeScript ESLint 配置。
- 暴露 Next.js 应用配置。
- 暴露 React library 配置。
- 保持 lint 规则在 workspace 内一致。

## 导出项

```txt
@video-digest-nextjs/eslint-config/base
@video-digest-nextjs/eslint-config/next-js
@video-digest-nextjs/eslint-config/react-internal
```

## 使用方式

普通 TypeScript 包：

```js
import { config } from "@video-digest-nextjs/eslint-config/base";

export default config;
```

Next.js 应用：

```js
import { nextJsConfig } from "@video-digest-nextjs/eslint-config/next-js";

export default nextJsConfig;
```

## 边界

- 只放 lint 配置。
- 不放项目业务规则。
- 不依赖任何业务包。
