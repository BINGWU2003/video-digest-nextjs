import {
  createSupabaseDeliveryRecordsRepository,
  createSupabaseJobEventsRepository,
  type DeliveryStatus,
} from "@video-digest-nextjs/database";
import { NextResponse, type NextRequest } from "next/server";
import { Webhook } from "svix";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const resendWebhookEventSchema = z.object({
  created_at: z.string().optional(),
  data: z.object({
    email_id: z.string().min(1),
    subject: z.string().optional(),
    to: z.array(z.string()).optional(),
    reason: z.string().optional(),
  }),
  type: z.string().min(1),
});

const resendDeliveryStatusByEventType: Partial<Record<string, DeliveryStatus>> = {
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delivery_delayed",
  "email.failed": "failed",
  "email.sent": "sent",
} satisfies Record<string, DeliveryStatus>;

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return jsonError("缺少 RESEND_WEBHOOK_SECRET。", 500);
  }

  const payload = await request.text();
  const verifiedPayload = verifyResendWebhook(payload, request, webhookSecret);

  if (!verifiedPayload.ok) {
    return jsonError("Webhook 签名无效。", 400);
  }

  const parsedEvent = resendWebhookEventSchema.safeParse(verifiedPayload.value);

  if (!parsedEvent.success) {
    return jsonError("Webhook 事件结构无效。", 400);
  }

  const status = resendDeliveryStatusByEventType[parsedEvent.data.type];

  if (!status) {
    return NextResponse.json({
      ignored: true,
      reason: "unsupported_event_type",
      type: parsedEvent.data.type,
    });
  }

  const providerEventAt = parseWebhookEventDate(parsedEvent.data.created_at);
  const supabase = createAdminClient();
  const deliveryRecordsRepository =
    createSupabaseDeliveryRecordsRepository(supabase);
  const updatedDelivery =
    await deliveryRecordsRepository.updateStatusByProviderMessageId({
      errorMessage: getWebhookErrorMessage(parsedEvent.data),
      providerEventAt,
      providerEventType: parsedEvent.data.type,
      providerMessageId: parsedEvent.data.data.email_id,
      sentAt:
        status === "sent" || status === "delivered" ? providerEventAt : undefined,
      status,
    });

  if (!updatedDelivery) {
    return NextResponse.json({
      ignored: true,
      providerMessageId: parsedEvent.data.data.email_id,
      reason: "delivery_record_not_found",
    });
  }

  await createSupabaseJobEventsRepository(supabase).create({
    recordId: updatedDelivery.recordId,
    userId: updatedDelivery.userId,
    status: "completed",
    message: getWebhookEventMessage(status),
    metadata: {
      deliveryId: updatedDelivery.id,
      providerEventAt: providerEventAt.toISOString(),
      providerEventType: parsedEvent.data.type,
      providerMessageId: parsedEvent.data.data.email_id,
      subject: parsedEvent.data.data.subject,
    },
  });

  return NextResponse.json({
    deliveryId: updatedDelivery.id,
    ok: true,
    status: updatedDelivery.status,
  });
}

function verifyResendWebhook(
  payload: string,
  request: NextRequest,
  webhookSecret: string,
) {
  try {
    const webhook = new Webhook(webhookSecret);

    return {
      ok: true as const,
      value: webhook.verify(payload, {
        "svix-id": request.headers.get("svix-id") ?? "",
        "svix-signature": request.headers.get("svix-signature") ?? "",
        "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
      }),
    };
  } catch {
    return {
      ok: false as const,
    };
  }
}

function parseWebhookEventDate(value: string | undefined) {
  if (!value) {
    return new Date();
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function getWebhookErrorMessage(event: z.infer<typeof resendWebhookEventSchema>) {
  if (event.type === "email.delivery_delayed") {
    return event.data.reason ?? "目标邮箱服务器暂未确认收件，服务商会继续重试。";
  }

  const status = resendDeliveryStatusByEventType[event.type];

  if (status === "bounced" || status === "complained" || status === "failed") {
    return event.data.reason ?? getWebhookEventMessage(status);
  }

  return null;
}

function getWebhookEventMessage(status: DeliveryStatus) {
  const labels: Record<DeliveryStatus, string> = {
    bounced: "摘要邮件被收件方退回。",
    cancelled: "摘要邮件投递已取消。",
    complained: "摘要邮件被收件方标记为投诉。",
    delivered: "摘要邮件已送达收件方服务器。",
    delivery_delayed: "摘要邮件投递延迟，服务商会继续重试。",
    failed: "摘要邮件投递失败。",
    queued: "摘要邮件等待投递。",
    sent: "摘要邮件已提交服务商。",
  };

  return labels[status];
}

function jsonError(message: string, status: number) {
  return NextResponse.json(
    {
      error: {
        message,
      },
    },
    { status },
  );
}
