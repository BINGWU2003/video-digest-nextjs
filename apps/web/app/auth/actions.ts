"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

function encodedMessage(message: string) {
  return encodeURIComponent(message);
}

const nextPathSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : ""),
  z
    .string()
    .refine(
      (value) => !value || (value.startsWith("/") && !value.startsWith("//")),
      {
        message: "跳转地址无效。",
      },
    )
    .transform((value) => value || "/dashboard"),
);

const emailSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
  z.email("请输入有效邮箱。"),
);

const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "请输入密码。"),
  next: nextPathSchema,
});

const signUpSchema = z.object({
  email: emailSchema,
  password: z.string().min(6, "密码至少需要 6 位。"),
  next: nextPathSchema,
});

type AuthFormData = {
  email: string;
  password: string;
  next: string;
};

function parseFormData<T extends z.ZodType<AuthFormData>>(
  schema: T,
  formData: FormData,
) {
  const result = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next"),
  });

  if (!result.success) {
    return {
      data: null,
      message: result.error.issues[0]?.message ?? "表单内容无效。",
      next: nextPathSchema.safeParse(formData.get("next")).data ?? "/dashboard",
    };
  }

  return {
    data: result.data as z.infer<T>,
    message: null,
    next: result.data.next as string,
  };
}

export async function signInWithPassword(formData: FormData) {
  if (!hasSupabaseConfig()) {
    redirect(
      `/login?message=${encodedMessage("请先配置 Supabase 环境变量。")}`,
    );
  }

  const parsed = parseFormData(signInSchema, formData);
  const { next } = parsed;

  if (!parsed.data) {
    redirect(
      `/login?next=${encodeURIComponent(next)}&message=${encodedMessage(parsed.message)}`,
    );
  }

  const { email, password } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(
      `/login?next=${encodeURIComponent(next)}&message=${encodedMessage("登录失败，请检查邮箱或密码。")}`,
    );
  }

  redirect(next);
}

export async function signUpWithPassword(formData: FormData) {
  if (!hasSupabaseConfig()) {
    redirect(
      `/login?message=${encodedMessage("请先配置 Supabase 环境变量。")}`,
    );
  }

  const parsed = parseFormData(signUpSchema, formData);
  const { next } = parsed;

  if (!parsed.data) {
    redirect(
      `/login?next=${encodeURIComponent(next)}&message=${encodedMessage(parsed.message)}`,
    );
  }

  const { email, password } = parsed.data;
  const origin = (await headers()).get("origin");
  const emailRedirectTo = origin
    ? `${origin}/auth/callback?next=${encodeURIComponent(next)}`
    : undefined;

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
    },
  });

  if (error) {
    redirect(
      `/login?next=${encodeURIComponent(next)}&message=${encodedMessage("注册失败，请稍后重试。")}`,
    );
  }

  redirect(
    `/login?next=${encodeURIComponent(next)}&message=${encodedMessage("如果该邮箱可注册，会收到一封确认邮件。请检查收件箱或垃圾邮件。")}`,
  );
}

export async function signOut() {
  if (hasSupabaseConfig()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  redirect(`/login?message=${encodedMessage("已退出登录。")}`);
}
