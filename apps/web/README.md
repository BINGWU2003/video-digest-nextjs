# 视频摘要 Web

这是视频摘要产品的 Next.js Web 应用。

## 本地启动

在仓库根目录运行：

```bash
pnpm --filter web dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## Supabase 登录配置

复制环境变量示例：

```bash
cp apps/web/env.local.example apps/web/.env.local
```

然后填入 Supabase 项目配置：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

如果你的 Supabase 项目仍使用旧版 anon key，也可以填：

```bash
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

登录相关页面和路由：

- `/login`：邮箱密码登录/注册
- `/auth/callback`：邮箱确认和 PKCE 回调
- `/dashboard`、`/records`、`/settings/*`：需要登录后访问

Supabase 控制台里建议把本地回调地址加入允许列表：

```txt
http://localhost:3000/auth/callback
```
