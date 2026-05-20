import {
  hasSupabaseAdminConfig,
  supabaseServiceRoleKey,
  supabaseUrl,
} from "./config";

async function callAuthEmailExists(email: string) {
  const baseUrl = supabaseUrl!.replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/rest/v1/rpc/auth_email_exists`, {
    method: "POST",
    headers: {
      apikey: supabaseServiceRoleKey!,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ _email: email }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Supabase auth_email_exists request failed: ${response.status}`,
    );
  }

  return (await response.json()) as boolean;
}

export async function authUserExistsByEmail(email: string) {
  if (!hasSupabaseAdminConfig()) {
    return null;
  }

  try {
    return await callAuthEmailExists(email);
  } catch (error) {
    console.error("Failed to check existing Supabase auth user.", error);
    return null;
  }
}
