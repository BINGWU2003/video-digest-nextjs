export type VideoDigestMcpServerConfig = {
  token: string;
  webAppUrl: string;
};

export function loadConfig(env: NodeJS.ProcessEnv): VideoDigestMcpServerConfig {
  const webAppUrl =
    env.VIDEO_DIGEST_WEB_APP_URL ?? env.WEB_APP_URL ?? "http://localhost:3000";
  const token = env.VIDEO_DIGEST_MCP_TOKEN ?? env.MCP_TOKEN;

  if (!token) {
    throw new Error(
      "Missing VIDEO_DIGEST_MCP_TOKEN. Create an MCP token in the web app settings page and pass it as an environment variable.",
    );
  }

  return {
    token,
    webAppUrl: normalizeBaseUrl(webAppUrl),
  };
}

function normalizeBaseUrl(value: string) {
  try {
    const url = new URL(value);

    url.pathname = url.pathname.replace(/\/+$/, "");
    url.search = "";
    url.hash = "";

    return url.toString().replace(/\/$/, "");
  } catch {
    throw new Error(`Invalid VIDEO_DIGEST_WEB_APP_URL: ${value}`);
  }
}
