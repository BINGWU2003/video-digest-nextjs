export type EmailDeliveryProvider = {
  /** 发送一封摘要邮件。 */
  sendEmail(input: SendEmailInput): Promise<SendEmailResult>;
};

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type SendEmailResult = {
  providerMessageId: string | null;
};

export class EmailDeliveryError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(`邮件投递失败：${message}`);
    this.name = "EmailDeliveryError";
  }
}

export class EmailRecipientNotFoundError extends Error {
  constructor() {
    super("未找到默认已验证收件邮箱。");
    this.name = "EmailRecipientNotFoundError";
  }
}

export function createResendEmailDeliveryProvider(options: {
  apiKey?: string;
  fromEmail?: string;
}): EmailDeliveryProvider {
  return {
    async sendEmail(input) {
      if (!options.apiKey) {
        throw new EmailDeliveryError("缺少 RESEND_API_KEY。");
      }

      if (!options.fromEmail) {
        throw new EmailDeliveryError("缺少 RESEND_FROM_EMAIL。");
      }

      let response: Response;

      try {
        response = await fetch("https://api.resend.com/emails", {
          body: JSON.stringify({
            from: options.fromEmail,
            html: input.html,
            subject: input.subject,
            text: input.text,
            to: [input.to],
          }),
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            "Content-Type": "application/json",
            "User-Agent": "video-digest-worker/0.1",
          },
          method: "POST",
        });
      } catch (caught) {
        throw new EmailDeliveryError("Resend 网络请求失败。", caught);
      }

      if (!response.ok) {
        throw new EmailDeliveryError(await readResendError(response));
      }

      const responseBody: unknown = await response.json().catch(() => null);

      return {
        providerMessageId: getResendMessageId(responseBody),
      };
    },
  };
}

async function readResendError(response: Response) {
  const responseText = await response.text().catch(() => "");

  if (!responseText) {
    return `Resend 返回 HTTP ${response.status}。`;
  }

  return `Resend 返回 HTTP ${response.status}：${responseText}`;
}

function getResendMessageId(responseBody: unknown) {
  if (!responseBody || typeof responseBody !== "object") {
    return null;
  }

  const id = (responseBody as { id?: unknown }).id;

  return typeof id === "string" && id.length > 0 ? id : null;
}
