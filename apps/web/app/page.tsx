import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-white px-6 py-16 text-neutral-950">
      <section className="flex w-full max-w-xl flex-col items-center gap-8 text-center">
        <div className="space-y-3">
          <p className="text-sm font-medium text-neutral-500">shadcn/ui</p>
          <h1 className="text-3xl font-semibold tracking-normal">
            Buttons are ready
          </h1>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
        </div>
      </section>
    </main>
  );
}
