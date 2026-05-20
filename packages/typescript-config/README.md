# @repo/typescript-config

共享 TypeScript 配置包，供 monorepo 内所有 apps 和 packages 继承。

## 职责

- 统一 TypeScript 编译目标和严格模式。
- 为 Next.js 应用提供专用配置。
- 为 React library 包提供 JSX 配置。

## 配置文件

```txt
base.json
  通用 TypeScript 配置。

nextjs.json
  Next.js 应用配置。

react-library.json
  React library 配置。
```

## 使用方式

普通 TypeScript 包：

```json
{
  "extends": "@repo/typescript-config/base.json"
}
```

Next.js 应用：

```json
{
  "extends": "@repo/typescript-config/nextjs.json"
}
```

## 边界

- 只维护 TypeScript 配置。
- 不放构建脚本。
- 不依赖业务包。
