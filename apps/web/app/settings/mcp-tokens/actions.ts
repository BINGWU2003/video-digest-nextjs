"use server";

import {
  createSupabaseMcpTokensRepository,
  isMissingDatabaseSchemaError,
} from "@video-digest-nextjs/database";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import {
  createMcpToken,
  createMcpTokenDisplayPrefix,
  createMcpTokenHash,
} from "@/lib/mcp/token-secret";
import { createAdminClient } from "@/lib/supabase/admin";

const allowedScopes = ["digest:create", "digest:read"] as const;

const createMcpTokenFormSchema = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: z
    .array(z.enum(allowedScopes))
    .min(1)
    .transform((scopes) => [...new Set(scopes)]),
});

const revokeMcpTokenFormSchema = z.object({
  id: z.uuid(),
});

export async function createMcpTokenAction(formData: FormData) {
  const user = await requireUser();
  const parsedInput = createMcpTokenFormSchema.safeParse({
    name: formData.get("name"),
    scopes: formData.getAll("scopes"),
  });

  if (!parsedInput.success) {
    redirect(
      `/settings/mcp-tokens?message=${encodeURIComponent("请填写令牌名称，并至少选择一个权限。")}`,
    );
  }

  const token = createMcpToken();

  try {
    const mcpTokensRepository = createSupabaseMcpTokensRepository(
      createAdminClient(),
    );

    await mcpTokensRepository.createForUser({
      name: parsedInput.data.name,
      scopes: parsedInput.data.scopes,
      tokenHash: createMcpTokenHash(token),
      tokenPrefix: createMcpTokenDisplayPrefix(token),
      userId: user.id,
    });
  } catch (caught) {
    if (isMissingDatabaseSchemaError(caught)) {
      redirect(
        `/settings/mcp-tokens?message=${encodeURIComponent("MCP 令牌数据表尚未创建。")}`,
      );
    }

    throw caught;
  }

  revalidatePath("/settings/mcp-tokens");
  redirect(
    `/settings/mcp-tokens?message=${encodeURIComponent("MCP 令牌已创建。")}&createdToken=${encodeURIComponent(token)}`,
  );
}

export async function revokeMcpTokenAction(formData: FormData) {
  const user = await requireUser();
  const parsedInput = revokeMcpTokenFormSchema.safeParse({
    id: formData.get("id"),
  });

  if (!parsedInput.success) {
    redirect(
      `/settings/mcp-tokens?message=${encodeURIComponent("MCP 令牌记录无效。")}`,
    );
  }

  try {
    const mcpTokensRepository = createSupabaseMcpTokensRepository(
      createAdminClient(),
    );

    await mcpTokensRepository.revokeForUser({
      id: parsedInput.data.id,
      revokedAt: new Date(),
      userId: user.id,
    });
  } catch (caught) {
    if (isMissingDatabaseSchemaError(caught)) {
      redirect(
        `/settings/mcp-tokens?message=${encodeURIComponent("MCP 令牌数据表尚未创建。")}`,
      );
    }

    throw caught;
  }

  revalidatePath("/settings/mcp-tokens");
  redirect(
    `/settings/mcp-tokens?message=${encodeURIComponent("MCP 令牌已撤销。")}`,
  );
}
