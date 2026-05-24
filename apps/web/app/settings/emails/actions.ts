"use server";

import {
  createSupabaseEmailAddressesRepository,
  isMissingDatabaseSchemaError,
} from "@repo/database";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const setDefaultEmailAddressFormSchema = z.object({
  id: z.uuid(),
});

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
