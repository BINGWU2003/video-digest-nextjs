# @video-digest-nextjs/mcp-server

Standard MCP stdio server for Video Digest. It wraps the web app's `/api/mcp`
HTTP gateway, so MCP clients can create video digest jobs and read digest
records using a website MCP token.

## Local Usage

Build the package:

```bash
pnpm --filter @video-digest-nextjs/mcp-server build
```

Run it with environment variables:

```bash
VIDEO_DIGEST_WEB_APP_URL=http://localhost:3000 \
VIDEO_DIGEST_MCP_TOKEN=mcp_xxx \
node packages/mcp-server/dist/index.js
```

## MCP Client Config

```json
{
  "mcpServers": {
    "video-digest": {
      "command": "node",
      "args": ["D:/code/next-project/video-digest-nextjs/packages/mcp-server/dist/index.js"],
      "env": {
        "VIDEO_DIGEST_WEB_APP_URL": "http://localhost:3000",
        "VIDEO_DIGEST_MCP_TOKEN": "mcp_xxx"
      }
    }
  }
}
```

## Tools

- `create_video_digest_job`: create a queued video digest task.
- `get_video_digest_record`: read a digest record, transcript, summary and
  delivery status.

The token must have the matching website scopes:

- `digest:create`
- `digest:read`
