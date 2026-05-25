import type { SummaryRow, VideoRecordRow } from "@repo/database";

export function createSummaryEmailSubject() {
  return "你的视频摘要已生成";
}

export function createSummaryEmailText(
  record: VideoRecordRow,
  summary: SummaryRow,
  links: SummaryEmailLinks,
) {
  const keyPoints = getSummaryEmailKeyPoints(summary);

  return [
    "你的视频摘要已生成",
    "",
    `视频标题：${getSummaryEmailTitle(record, summary)}`,
    `平台：${record.platform}`,
    `生成时间：${formatEmailDate(summary.createdAt)}`,
    "",
    "摘要",
    truncateText(summary.shortSummary ?? summary.markdown ?? "摘要已生成。", 500),
    "",
    keyPoints.length > 0 ? "关键要点" : null,
    ...keyPoints.map((point) => `- ${point}`),
    "",
    links.recordUrl ? `查看完整摘要：${links.recordUrl}` : null,
    `打开源视频：${record.sourceUrl}`,
    "",
    "这封邮件是你在视频摘要工具中请求生成并投递的结果。",
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

export function createSummaryEmailHtml(
  record: VideoRecordRow,
  summary: SummaryRow,
  links: SummaryEmailLinks,
) {
  const keyPoints = getSummaryEmailKeyPoints(summary);
  const title = getSummaryEmailTitle(record, summary);
  const summaryText = truncateText(
    summary.shortSummary ?? summary.markdown ?? "摘要已生成。",
    500,
  );

  return [
    '<div style="margin:0;background:#f8fafc;padding:24px 0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#0f172a">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse"><tr><td align="center">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;border-collapse:collapse;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">',
    '<tr><td style="padding:24px 28px;border-bottom:1px solid #e2e8f0">',
    '<p style="margin:0 0 8px;font-size:13px;color:#2563eb;font-weight:600">视频摘要</p>',
    '<h1 style="margin:0;font-size:22px;line-height:1.35;color:#0f172a">你的视频摘要已生成</h1>',
    "</td></tr>",
    '<tr><td style="padding:24px 28px">',
    '<p style="margin:0 0 6px;font-size:13px;color:#64748b">视频标题</p>',
    `<p style="margin:0 0 18px;font-size:16px;line-height:1.6;font-weight:600;color:#0f172a">${escapeHtml(title)}</p>`,
    `<p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#334155">${escapeHtml(summaryText)}</p>`,
    keyPoints.length > 0
      ? [
          '<p style="margin:0 0 10px;font-size:14px;font-weight:600;color:#0f172a">关键要点</p>',
          '<ul style="margin:0 0 22px;padding-left:20px;color:#334155;font-size:14px;line-height:1.7">',
          ...keyPoints.map(
            (point) => `<li style="margin:0 0 6px">${escapeHtml(point)}</li>`,
          ),
          "</ul>",
        ].join("")
      : null,
    '<table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse"><tr>',
    links.recordUrl
      ? `<td style="padding-right:10px"><a href="${escapeHtml(links.recordUrl)}" style="display:inline-block;border-radius:6px;background:#0f172a;color:#ffffff;text-decoration:none;padding:10px 14px;font-size:14px;font-weight:600">查看完整摘要</a></td>`
      : null,
    `<td><a href="${escapeHtml(record.sourceUrl)}" style="display:inline-block;border-radius:6px;border:1px solid #cbd5e1;color:#0f172a;text-decoration:none;padding:9px 13px;font-size:14px;font-weight:600">打开源视频</a></td>`,
    "</tr></table>",
    '<p style="margin:22px 0 0;font-size:12px;line-height:1.6;color:#64748b">这封邮件是你在视频摘要工具中请求生成并投递的结果。</p>',
    "</td></tr>",
    "</table>",
    "</td></tr></table>",
    "</div>",
  ]
    .filter((line): line is string => Boolean(line))
    .join("");
}

export type SummaryEmailLinks = {
  recordUrl: string | null;
};

export function createSummaryEmailLinks(
  record: VideoRecordRow,
  webAppUrl: string | undefined,
): SummaryEmailLinks {
  return {
    recordUrl: createRecordUrl(record.id, webAppUrl),
  };
}

function createRecordUrl(recordId: string, webAppUrl: string | undefined) {
  if (!webAppUrl) {
    return null;
  }

  try {
    return new URL(`/records/${recordId}`, webAppUrl).toString();
  } catch {
    return null;
  }
}

function getSummaryEmailTitle(record: VideoRecordRow, summary: SummaryRow) {
  return summary.title ?? record.title ?? "未命名视频";
}

function getSummaryEmailKeyPoints(summary: SummaryRow) {
  return summary.keyPoints
    .filter((value): value is string => typeof value === "string")
    .map((value) => truncateText(value, 140))
    .slice(0, 5);
}

function truncateText(value: string, maxLength: number) {
  const normalizedValue = value.replace(/\s+/gu, " ").trim();

  return normalizedValue.length > maxLength
    ? `${normalizedValue.slice(0, maxLength - 1)}...`
    : normalizedValue;
}

function formatEmailDate(value: Date) {
  return value.toLocaleString("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Shanghai",
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
