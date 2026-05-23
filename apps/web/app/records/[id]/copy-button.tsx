"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { CopyIcon } from "../../_components/icons";

export function CopyButton({
  disabled,
  label,
  text,
}: {
  disabled?: boolean;
  label: string;
  text: string | null | undefined;
}) {
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      disabled={disabled || !text || isPending}
      onClick={() => {
        if (!text) {
          return;
        }

        startTransition(async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1_600);
        });
      }}
      type="button"
      variant="outline"
    >
      <CopyIcon />
      {copied ? "已复制" : label}
    </Button>
  );
}
