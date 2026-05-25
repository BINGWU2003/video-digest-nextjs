"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import { CopyIcon } from "../../_components/icons";

type CopyTextButtonProps = {
  copiedLabel?: string;
  label: string;
  text: string;
};

export function CopyTextButton({
  copiedLabel = "已复制",
  label,
  text,
}: CopyTextButtonProps) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
    >
      <CopyIcon />
      {copied ? copiedLabel : label}
    </Button>
  );
}
