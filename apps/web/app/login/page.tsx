import Image from "next/image";

import { LoginSubmitButtons } from "./submit-buttons";

type LoginPageProps = {
  searchParams: Promise<{
    message?: string;
    next?: string;
  }>;
};

function safeNext(next?: string) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }

  return next;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = safeNext(params.next);

  return (
    <main className="flex min-h-svh items-center justify-center bg-slate-50 px-4 py-10 text-slate-950">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="视频摘要"
              width={36}
              height={36}
              className="size-9 rounded-md object-cover"
              priority
            />
            <div>
              <p className="font-semibold text-slate-950">视频摘要</p>
              <p className="text-sm text-slate-500">登录后继续使用工作台</p>
            </div>
          </div>
        </div>

        <div className="grid gap-5 p-6">
          {params.message ? (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm leading-6 text-blue-800">
              {params.message}
            </div>
          ) : null}

          <form className="grid gap-4">
            <input type="hidden" name="next" value={next} />
            <div className="grid gap-2">
              <label
                htmlFor="email"
                className="text-sm font-medium text-slate-800"
              >
                邮箱
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                required
              />
            </div>
            <div className="grid gap-2">
              <label
                htmlFor="password"
                className="text-sm font-medium text-slate-800"
              >
                密码
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                minLength={6}
                placeholder="至少 6 位"
                className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                required
              />
            </div>

            <LoginSubmitButtons />
          </form>

          <p className="text-xs leading-5 text-slate-500">
            注册后如果 Supabase 项目启用了邮箱确认，需要先点击邮件中的确认链接。
          </p>
        </div>
      </section>
    </main>
  );
}
