"use client";

import { useState, useEffect, useRef } from "react";

interface CountdownTimerProps {
  startedAt: string;
  durationSeconds: number;
  onExpire: () => void;
  label?: string;
}

export function CountdownTimer({
  startedAt,
  durationSeconds,
  onExpire,
  label,
}: CountdownTimerProps) {
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;
  const expiredRef = useRef(false);

  const [remaining, setRemaining] = useState(() => {
    const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000;
    return Math.max(0, durationSeconds - elapsed);
  });

  useEffect(() => {
    expiredRef.current = false;
    const timer = setInterval(() => {
      const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000;
      const r = Math.max(0, durationSeconds - elapsed);
      setRemaining(r);
      if (r <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        clearInterval(timer);
        onExpireRef.current();
      }
    }, 250);
    return () => clearInterval(timer);
  }, [startedAt, durationSeconds]);

  const mins = Math.floor(remaining / 60);
  const secs = Math.floor(remaining % 60);
  const isUrgent = remaining <= 30 && remaining > 0;

  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs text-[#888]">{label}</span>}
      <span
        className={`font-mono text-lg tabular-nums font-semibold ${
          isUrgent
            ? "text-red-400 animate-pulse"
            : remaining <= 0
              ? "text-red-500"
              : "text-[#ededed]"
        }`}
      >
        {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </span>
    </div>
  );
}
