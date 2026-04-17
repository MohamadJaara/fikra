"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { useState, useRef, useCallback, type KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";

type UserOption = {
  _id: Id<"users">;
  name?: string;
  firstName?: string;
  lastName?: string;
  image?: string;
  handle?: string;
};

export function MentionTextarea({
  value,
  onChange,
  onSubmit,
  placeholder,
  rows = 2,
  autoFocus,
  className,
}: {
  value: string;
  onChange: (val: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
  className?: string;
}) {
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevUsersLength = useRef(0);

  const users = useQuery(
    api.users.search,
    mentionQuery !== null ? { query: mentionQuery } : "skip",
  );

  const handlechange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      const cursorPos = e.target.selectionStart;
      onChange(val);

      const textBeforeCursor = val.slice(0, cursorPos);
      const atMatch = textBeforeCursor.match(/@(\w*)$/);

      if (atMatch) {
        setMentionQuery(atMatch[1]);
        setMentionStart(cursorPos - atMatch[0].length);
        setSelectedIndex(0);
      } else {
        setMentionQuery(null);
        setMentionStart(-1);
      }
    },
    [onChange],
  );

  const selectUser = useCallback(
    (user: UserOption) => {
      const handle = user.handle;
      if (!handle) return;

      const before = value.slice(0, mentionStart);
      const after = value.slice(
        textareaRef.current?.selectionStart ?? value.length,
      );
      const newValue = `${before}@${handle} ${after}`;
      onChange(newValue);
      setMentionQuery(null);
      setMentionStart(-1);

      requestAnimationFrame(() => {
        if (textareaRef.current) {
          const newPos = before.length + handle.length + 2;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newPos, newPos);
        }
      });
    },
    [value, mentionStart, onChange],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (mentionQuery === null || !users || users.length === 0) {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && onSubmit) {
          e.preventDefault();
          onSubmit();
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, users.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectUser(users[selectedIndex] as UserOption);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setMentionQuery(null);
        setMentionStart(-1);
      }
    },
    [mentionQuery, users, selectedIndex, selectUser, onSubmit],
  );

  const currentLen = users?.length ?? 0;
  if (currentLen !== prevUsersLength.current) {
    prevUsersLength.current = currentLen;
    if (selectedIndex !== 0) setSelectedIndex(0);
  }

  const showDropdown =
    mentionQuery !== null && users !== undefined && users.length > 0;

  return (
    <div className={cn("relative w-full min-w-0", className)}>
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handlechange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        autoFocus={autoFocus}
        className="w-full"
      />
      {showDropdown && (
        <div className="absolute z-50 bottom-full mb-1 left-0 w-64 rounded-md border bg-popover p-1 shadow-md">
          {users.map((user, i) => (
            <button
              key={user._id}
              type="button"
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm ${
                i === selectedIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50"
              }`}
              onMouseEnter={() => setSelectedIndex(i)}
              onClick={() => selectUser(user as UserOption)}
            >
              <Avatar className="h-6 w-6 shrink-0">
                <AvatarImage src={user.image} />
                <AvatarFallback className="text-[10px]">
                  {(user.name || user.firstName || "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start min-w-0">
                <span className="truncate text-sm">
                  {user.name ||
                    [user.firstName, user.lastName].filter(Boolean).join(" ")}
                </span>
                {user.handle && (
                  <span className="text-xs text-muted-foreground">
                    @{user.handle}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function renderMentionContent(
  content: string,
  mentionedUsers?: { _id: Id<"users">; name: string; handle?: string }[],
): React.ReactNode[] {
  if (!mentionedUsers || mentionedUsers.length === 0) {
    return [content];
  }

  const parts: React.ReactNode[] = [];
  let remaining = content;
  let key = 0;

  while (remaining.length > 0) {
    const atIndex = remaining.indexOf("@");
    if (atIndex === -1) {
      parts.push(remaining);
      break;
    }

    if (atIndex > 0) {
      parts.push(remaining.slice(0, atIndex));
    }

    const afterAt = remaining.slice(atIndex + 1);
    let matched = false;

    const sorted = [...mentionedUsers]
      .filter((u) => u.handle)
      .sort((a, b) => (b.handle?.length ?? 0) - (a.handle?.length ?? 0));

    for (const user of sorted) {
      const handle = user.handle!;
      if (afterAt.startsWith(handle)) {
        const charAfter = afterAt[handle.length];
        if (charAfter === undefined || !/[a-zA-Z0-9_]/.test(charAfter)) {
          parts.push(
            <Link
              key={key++}
              href={`/product/profile/${handle}`}
              className="inline-flex items-center rounded bg-primary/10 text-primary font-medium text-sm px-0.5 hover:bg-primary/20 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              @{handle}
            </Link>,
          );
          remaining = afterAt.slice(handle.length);
          matched = true;
          break;
        }
      }
    }

    if (!matched) {
      parts.push("@");
      remaining = afterAt;
    }
  }

  return parts;
}
