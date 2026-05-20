"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { authUserExistsByEmail } from "@/lib/supabase/admin";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

function encodedMessage(message: string) {
  return encodeURIComponent(message);
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getNextPath(formData: FormData) {
  const next = getString(formData, "next");

  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }

  return next;
}

export async function signInWithPassword(formData: FormData) {
  if (!hasSupabaseConfig()) {
    redirect(
      `/login?message=${encodedMessage("请先配置 Supabase 环境变量。")}`,
    );
  }

  const email = getString(formData, "email");
  const password = getString(formData, "password");
  const next = getNextPath(formData);

  if (!email || !password) {
    redirect(
      `/login?next=${encodeURIComponent(next)}&message=${encodedMessage("请输入邮箱和密码。")}`,
    );
  }

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

  const email = getString(formData, "email");
  const password = getString(formData, "password");
  const next = getNextPath(formData);

  if (!email || password.length < 6) {
    redirect(
      `/login?next=${encodeURIComponent(next)}&message=${encodedMessage("请输入邮箱，并使用至少 6 位密码。")}`,
    );
  }

  const origin = (await headers()).get("origin");
  const emailRedirectTo = origin
    ? `${origin}/auth/callback?next=${encodeURIComponent(next)}`
    : undefined;

  const existingUser = await authUserExistsByEmail(email);

  if (existingUser) {
    redirect(
      `/login?next=${encodeURIComponent(next)}&message=${encodedMessage("该邮箱已注册，请直接登录。")}`,
    );
  }

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
    `/login?next=${encodeURIComponent(next)}&message=${encodedMessage("注册成功，请检查邮箱完成验证。")}`,
  );
}

export async function signOut() {
  if (hasSupabaseConfig()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  redirect(`/login?message=${encodedMessage("已退出登录。")}`);
}
