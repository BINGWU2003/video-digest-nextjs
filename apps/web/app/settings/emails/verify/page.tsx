import {
  createSupabaseEmailAddressesRepository,
  isMissingDatabaseSchemaError,
} from "@video-digest-nextjs/database";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  hashVerificationSecret,
  parseVerificationToken,
} from "../verification-token";

export const dynamic = "force-dynamic";

const verifyEmailSearchParamsSchema = z.object({
  token: z.string().optional(),
});

const verificationTokenIdSchema = z.uuid();
const verificationExpiresInMs = 24 * 60 * 60 * 1000;

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string }>;
}) {
  const user = await requireUser();
  const resolvedSearchParams = await searchParams;
  const parsedSearchParams =
    verifyEmailSearchParamsSchema.safeParse(resolvedSearchParams ?? {});

  if (!parsedSearchParams.success) {
    redirectWithMessage("验证链接无效。");
  }

  const token = parseVerificationToken(parsedSearchParams.data.token);

  if (!token || !verificationTokenIdSchema.safeParse(token.id).success) {
    redirectWithMessage("验证链接无效。");
  }

  try {
    const emailAddressesRepository = createSupabaseEmailAddressesRepository(
      createAdminClient(),
    );
    const now = new Date();
    const verifiedEmailAddress = await emailAddressesRepository.verifyForUser({
      id: token.id,
      userId: user.id,
      verificationSentAfter: new Date(now.getTime() - verificationExpiresInMs),
      verificationTokenHash: hashVerificationSecret(token.secret),
      verifiedAt: now,
    });

    if (!verifiedEmailAddress) {
      redirectWithMessage("验证链接无效或已过期，请重新发送验证邮件。");
    }

    const currentDefault =
      await emailAddressesRepository.findDefaultVerifiedForUser({
        userId: user.id,
      });

    if (!currentDefault) {
      await emailAddressesRepository.setDefaultVerifiedForUser({
        id: verifiedEmailAddress.id,
        userId: user.id,
      });
    }
  } catch (caught) {
    if (isMissingDatabaseSchemaError(caught)) {
      redirectWithMessage("邮箱数据表尚未创建。");
    }

    throw caught;
  }

  revalidatePath("/settings/emails");
  revalidatePath("/dashboard");
  redirectWithMessage("邮箱验证成功。");
}

function redirectWithMessage(message: string): never {
  redirect(`/settings/emails?message=${encodeURIComponent(message)}`);
}
