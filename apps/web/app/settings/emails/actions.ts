"use server";

import {
  createSupabaseEmailAddressesRepository,
  isMissingDatabaseSchemaError,
} from "@video-digest-nextjs/database";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

import { hashVerificationSecret } from "./verification-token";

const setDefaultEmailAddressFormSchema = z.object({
  id: z.uuid(),
});

const requestEmailVerificationFormSchema = z.object({
  email: z.email().trim().toLowerCase(),
});

const verificationResendCooldownMs = 60 * 1000;

export async function useLoginEmailAsDefaultAction() {
  const user = await requireUser();

  if (!user.email) {
    redirect(
      `/settings/emails?message=${encodeURIComponent("当前账号没有可用邮箱。")}`,
    );
  }

  try {
    const emailAddressesRepository = createSupabaseEmailAddressesRepository(
      createAdminClient(),
    );

    await emailAddressesRepository.ensureVerifiedDefaultForUser({
      email: user.email,
      userId: user.id,
    });
  } catch (caught) {
    if (isMissingDatabaseSchemaError(caught)) {
      redirect(
        `/settings/emails?message=${encodeURIComponent("邮箱数据表尚未创建。")}`,
      );
    }

    throw caught;
  }

  revalidatePath("/settings/emails");
  redirect(
    `/settings/emails?message=${encodeURIComponent("已将当前登录邮箱设为默认收件邮箱。")}`,
  );
}

export async function requestEmailVerificationAction(formData: FormData) {
  const user = await requireUser();
  const parsedInput = requestEmailVerificationFormSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsedInput.success) {
    redirect(
      `/settings/emails?message=${encodeURIComponent("请输入有效邮箱地址。")}`,
    );
  }

  const resendConfig = getResendConfig();

  if (!resendConfig) {
    redirect(
      `/settings/emails?message=${encodeURIComponent("请先配置 RESEND_API_KEY 和 RESEND_FROM_EMAIL。")}`,
    );
  }

  const secret = createVerificationSecret();
  const verificationSentAt = new Date();

  try {
    const emailAddressesRepository = createSupabaseEmailAddressesRepository(
      createAdminClient(),
    );
    const existingEmailAddress = await findEmailAddressForUser(
      emailAddressesRepository,
      user.id,
      parsedInput.data.email,
    );

    if (isVerificationResendLimited(existingEmailAddress, verificationSentAt)) {
      redirect(
        `/settings/emails?message=${encodeURIComponent("验证邮件已发送，请 60 秒后再试。")}`,
      );
    }

    const emailAddress =
      await emailAddressesRepository.requestVerificationForUser({
        email: parsedInput.data.email,
        userId: user.id,
        verificationSentAt,
        verificationTokenHash: hashVerificationSecret(secret),
      });

    if (emailAddress.status === "verified") {
      redirect(
        `/settings/emails?message=${encodeURIComponent("这个邮箱已经验证过。")}`,
      );
    }

    await sendEmailVerification({
      config: resendConfig,
      to: emailAddress.email,
      verificationUrl: await createVerificationUrl(emailAddress.id, secret),
    });
  } catch (caught) {
    if (isMissingDatabaseSchemaError(caught)) {
      redirect(
        `/settings/emails?message=${encodeURIComponent("邮箱数据表尚未创建。")}`,
      );
    }

    throw caught;
  }

  revalidatePath("/settings/emails");
  redirect(
    `/settings/emails?message=${encodeURIComponent("验证邮件已发送，请查收并点击邮件里的链接。")}`,
  );
}

export async function setDefaultEmailAddressAction(formData: FormData) {
  const user = await requireUser();
  const parsedInput = setDefaultEmailAddressFormSchema.safeParse({
    id: formData.get("id"),
  });

  if (!parsedInput.success) {
    redirect(
      `/settings/emails?message=${encodeURIComponent("邮箱记录无效。")}`,
    );
  }

  try {
    const emailAddressesRepository = createSupabaseEmailAddressesRepository(
      createAdminClient(),
    );

    await emailAddressesRepository.setDefaultVerifiedForUser({
      id: parsedInput.data.id,
      userId: user.id,
    });
  } catch (caught) {
    if (isMissingDatabaseSchemaError(caught)) {
      redirect(
        `/settings/emails?message=${encodeURIComponent("邮箱数据表尚未创建。")}`,
      );
    }

    throw caught;
  }

  revalidatePath("/settings/emails");
  redirect(
    `/settings/emails?message=${encodeURIComponent("默认收件邮箱已更新。")}`,
  );
}

export async function deleteEmailAddressAction(formData: FormData) {
  const user = await requireUser();
  const parsedInput = setDefaultEmailAddressFormSchema.safeParse({
    id: formData.get("id"),
  });

  if (!parsedInput.success) {
    redirect(
      `/settings/emails?message=${encodeURIComponent("邮箱记录无效。")}`,
    );
  }

  let resultMessage = "邮箱已删除。";

  try {
    const emailAddressesRepository = createSupabaseEmailAddressesRepository(
      createAdminClient(),
    );
    const emailAddresses = await emailAddressesRepository.listForUser({
      userId: user.id,
    });
    const deletingEmailAddress = emailAddresses.find(
      (emailAddress) => emailAddress.id === parsedInput.data.id,
    );
    const nextDefaultEmailAddress = deletingEmailAddress?.isDefault
      ? emailAddresses.find(
          (emailAddress) =>
            emailAddress.id !== deletingEmailAddress.id &&
            emailAddress.status === "verified",
        )
      : null;

    if (deletingEmailAddress?.isDefault) {
      resultMessage = nextDefaultEmailAddress
        ? `邮箱已删除，已自动将 ${nextDefaultEmailAddress.email} 设为默认收件邮箱。`
        : "默认邮箱已删除，邮件投递前请重新设置默认收件邮箱。";
    }

    await emailAddressesRepository.deleteForUser({
      id: parsedInput.data.id,
      userId: user.id,
    });

    if (nextDefaultEmailAddress) {
      await emailAddressesRepository.setDefaultVerifiedForUser({
        id: nextDefaultEmailAddress.id,
        userId: user.id,
      });
    }
  } catch (caught) {
    if (isMissingDatabaseSchemaError(caught)) {
      redirect(
        `/settings/emails?message=${encodeURIComponent("邮箱数据表尚未创建。")}`,
      );
    }

    throw caught;
  }

  revalidatePath("/settings/emails");

  redirect(
    `/settings/emails?message=${encodeURIComponent(resultMessage)}`,
  );
}

async function findEmailAddressForUser(
  emailAddressesRepository: ReturnType<typeof createSupabaseEmailAddressesRepository>,
  userId: string,
  email: string,
) {
  const emailAddresses = await emailAddressesRepository.listForUser({ userId });

  return (
    emailAddresses.find(
      (emailAddress) => emailAddress.email.toLowerCase() === email,
    ) ?? null
  );
}

function isVerificationResendLimited(
  emailAddress: Awaited<ReturnType<typeof findEmailAddressForUser>>,
  now: Date,
) {
  if (
    !emailAddress ||
    emailAddress.status !== "pending" ||
    !emailAddress.verificationSentAt
  ) {
    return false;
  }

  return (
    now.getTime() - emailAddress.verificationSentAt.getTime() <
    verificationResendCooldownMs
  );
}

function createVerificationSecret() {
  return randomBytes(32).toString("base64url");
}

async function createVerificationUrl(emailAddressId: string, secret: string) {
  const baseUrl =
    process.env.WEB_APP_URL ?? (await headers()).get("origin") ?? "http://localhost:3000";
  const url = new URL("/settings/emails/verify", baseUrl);

  url.searchParams.set("token", `${emailAddressId}.${secret}`);

  return url.toString();
}

type ResendConfig = {
  apiKey: string;
  fromEmail: string;
};

function getResendConfig(): ResendConfig | null {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  return apiKey && fromEmail ? { apiKey, fromEmail } : null;
}

async function sendEmailVerification(input: {
  config: ResendConfig;
  to: string;
  verificationUrl: string;
}) {
  const response = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify({
      from: input.config.fromEmail,
      html: createVerificationEmailHtml(input.verificationUrl),
      subject: "验证你的收件邮箱",
      text: createVerificationEmailText(input.verificationUrl),
      to: [input.to],
    }),
    headers: {
      Authorization: `Bearer ${input.config.apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "video-digest-web/0.1",
    },
    method: "POST",
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    throw new Error(
      responseText
        ? `验证邮件发送失败：${responseText}`
        : `验证邮件发送失败：HTTP ${response.status}`,
    );
  }
}

function createVerificationEmailText(verificationUrl: string) {
  return [
    "验证你的收件邮箱",
    "",
    "点击下面的链接完成验证，之后这个邮箱就可以接收视频摘要。",
    verificationUrl,
    "",
    "如果这不是你发起的请求，可以忽略这封邮件。",
  ].join("\n");
}

function createVerificationEmailHtml(verificationUrl: string) {
  return [
    '<div style="margin:0;background:#f8fafc;padding:24px 0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#0f172a">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse"><tr><td align="center">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border-collapse:collapse;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">',
    '<tr><td style="padding:24px 28px">',
    '<p style="margin:0 0 8px;font-size:13px;color:#2563eb;font-weight:600">视频摘要</p>',
    '<h1 style="margin:0 0 12px;font-size:22px;line-height:1.35;color:#0f172a">验证你的收件邮箱</h1>',
    '<p style="margin:0 0 22px;font-size:14px;line-height:1.7;color:#334155">点击按钮完成验证，之后这个邮箱就可以接收你请求的视频摘要。</p>',
    `<a href="${escapeHtml(verificationUrl)}" style="display:inline-block;border-radius:6px;background:#0f172a;color:#ffffff;text-decoration:none;padding:10px 14px;font-size:14px;font-weight:600">验证邮箱</a>`,
    '<p style="margin:22px 0 0;font-size:12px;line-height:1.6;color:#64748b">如果这不是你发起的请求，可以忽略这封邮件。</p>',
    "</td></tr>",
    "</table>",
    "</td></tr></table>",
    "</div>",
  ].join("");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
