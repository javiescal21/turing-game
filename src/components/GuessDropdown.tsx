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
    <div className="relative mt-2">
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value as Guess)}
        disabled={disabled}
        className="w-full bg-[#1e1e1e] border border-[#333] rounded-lg px-3 py-3 pr-9 text-sm text-[#ededed] focus:outline-none focus:border-emerald-500 disabled:opacity-40 cursor-pointer disabled:cursor-default appearance-none min-h-[44px]"
      >
        <option value="" disabled>
          This witness is&hellip;
        </option>
        <option value="human">🧑 Human</option>
        <option value="ai">🤖 AI</option>
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}
