"use client";

import { useRef, useEffect, useState } from "react";
import type { Message, Sender } from "@/lib/game";

interface ChatPanelProps {
  messages: Message[];
  streamingContent?: string;
  onSend: (content: string) => void;
  disabled?: boolean;
  label: string;
  currentSender: Sender;
}

export function ChatPanel({
  messages,
  streamingContent,
  onSend,
  disabled = false,
  label,
  currentSender,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const hasStreaming = !!streamingContent;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamingContent]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || disabled) return;
    onSend(text);
    setInput("");
  }

  return (
    <div className="flex flex-col h-full bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden">
      {label && (
        <div className="px-4 py-3 border-b border-[#2a2a2a] text-sm font-medium text-[#888]">
          {label}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.length === 0 && !hasStreaming && (
          <p className="text-center text-[#555] text-sm pt-8">
            No messages yet
          </p>
        )}
        {messages.map((msg) => {
          const isMe = msg.sender === currentSender;
          return (
            <div
              key={msg.id}
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                  isMe
                    ? "bg-emerald-600 text-white rounded-br-md"
                    : "bg-[#2a2a2a] text-[#ededed] rounded-bl-md"
                }`}
              >
                {msg.content}
              </div>
            </div>
          );
        })}

        {hasStreaming && (
          <div className="flex justify-start">
            <div className="max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed bg-[#2a2a2a] text-[#ededed] rounded-bl-md">
              {streamingContent}
              <span className="inline-block w-1.5 h-4 bg-emerald-400 ml-0.5 animate-pulse align-text-bottom" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-3 border-t border-[#2a2a2a] flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={disabled}
          placeholder={disabled ? "Chat disabled" : "Type a message..."}
          className="flex-1 bg-[#1e1e1e] border border-[#333] rounded-lg px-3 py-2 text-sm text-[#ededed] placeholder-[#666] focus:outline-none focus:border-emerald-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-[#333] disabled:text-[#666] text-white text-sm font-medium rounded-lg transition-colors cursor-pointer disabled:cursor-default"
        >
          Send
        </button>
      </form>
    </div>
  );
}
