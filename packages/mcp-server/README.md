# @video-digest-nextjs/mcp-server

Video Digest 的标准 MCP stdio 服务。它通过网站侧 `/api/mcp` HTTP gateway 转发请求，让 MCP 客户端可以使用网站生成的 MCP Token 创建视频摘要任务、读取视频摘要记录、字幕、摘要和邮件投递状态。

## 包信息

- npm 包名：`@video-digest-nextjs/mcp-server`
- CLI bin：`video-digest-mcp-server`
- 运行方式：MCP stdio server
- 后端入口：`VIDEO_DIGEST_WEB_APP_URL/api/mcp`

## 本地使用

先构建包：

```bash
pnpm --filter @video-digest-nextjs/mcp-server build
```

再通过环境变量启动：

```bash
VIDEO_DIGEST_WEB_APP_URL=http://localhost:3000 \
VIDEO_DIGEST_MCP_TOKEN=mcp_xxx \
node packages/mcp-server/dist/index.js
```

环境变量说明：

- `VIDEO_DIGEST_WEB_APP_URL`：Video Digest 网站地址，本地开发一般是 `http://localhost:3000`
- `VIDEO_DIGEST_MCP_TOKEN`：在网站「MCP 令牌」页面创建的 Token

## MCP 客户端配置

本地源码方式：

```json
{
  "mcpServers": {
    "video-digest": {
      "command": "node",
      "args": [
        "D:/code/next-project/video-digest-nextjs/packages/mcp-server/dist/index.js"
      ],
      "env": {
        "VIDEO_DIGEST_WEB_APP_URL": "http://localhost:3000",
        "VIDEO_DIGEST_MCP_TOKEN": "mcp_xxx"
      }
    }
  }
}
```

发布到 npm 后，客户端配置可改为：

```json
{
  "mcpServers": {
    "video-digest": {
      "command": "video-digest-mcp-server",
      "env": {
        "VIDEO_DIGEST_WEB_APP_URL": "https://your-domain.com",
        "VIDEO_DIGEST_MCP_TOKEN": "mcp_xxx"
      }
    }
  }
}
```

## 工具

- `create_video_digest_job`：创建一个排队中的视频摘要任务。
- `get_video_digest_record`：读取视频摘要记录，以及对应的字幕、摘要和邮件投递状态。

## 权限范围

MCP Token 需要包含对应 scope：

- `digest:create`
- `digest:read`

## 构建和测试

包使用 tsup 构建，测试使用 Vitest。

```bash
pnpm --filter @video-digest-nextjs/mcp-server build
pnpm --filter @video-digest-nextjs/mcp-server test
```

## 常用命令

```bash
pnpm --filter @video-digest-nextjs/mcp-server lint
pnpm --filter @video-digest-nextjs/mcp-server check-types
pnpm --filter @video-digest-nextjs/mcp-server build
pnpm --filter @video-digest-nextjs/mcp-server test
```
