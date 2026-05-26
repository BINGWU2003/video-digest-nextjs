# @video-digest-nextjs/eslint-config

共享 ESLint 配置包，供 monorepo 内 apps 和 packages 复用。

## 职责

- 统一 TypeScript、React、Next.js 和 Turbo 相关 lint 规则。
- 暴露不同场景的 flat config。
- 保持 workspace 内 lint 行为一致。

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

React library：

```js
import { reactInternalConfig } from "@video-digest-nextjs/eslint-config/react-internal";

export default reactInternalConfig;
```

## 边界

- 只放 lint 配置。
- 不放业务规则。
- 不依赖业务包。

## 相关命令

```bash
pnpm lint
```
