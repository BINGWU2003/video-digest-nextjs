"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

import { TrashIcon } from "../../_components/icons";

export function RevokeTokenButton({ tokenName }: { tokenName: string }) {
  const { pending } = useFormStatus();

  return (
    <Button
      variant="outline"
      size="sm"
      type="submit"
      disabled={pending}
      aria-busy={pending}
      onClick={(event) => {
        if (
          !window.confirm(
            `确定撤销 MCP 令牌“${tokenName}”吗？撤销后，正在使用这个令牌的外部智能体会立即无法访问。`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <TrashIcon />
      {pending ? "撤销中" : "撤销"}
    </Button>
  );
}
