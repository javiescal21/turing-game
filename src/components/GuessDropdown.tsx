"use client";

import type { Guess } from "@/lib/game";

interface GuessDropdownProps {
  value: Guess | null;
  onChange: (value: Guess) => void;
  disabled?: boolean;
}

export function GuessDropdown({
  value,
  onChange,
  disabled = false,
}: GuessDropdownProps) {
  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value as Guess)}
      disabled={disabled}
      className="w-full mt-2 bg-[#1e1e1e] border border-[#333] rounded-lg px-3 py-2 text-sm text-[#ededed] focus:outline-none focus:border-emerald-500 disabled:opacity-40 cursor-pointer disabled:cursor-default appearance-none"
    >
      <option value="" disabled>
        This witness is&hellip;
      </option>
      <option value="human">🧑 Human</option>
      <option value="ai">🤖 AI</option>
    </select>
  );
}
