"use client";

import * as React from "react";
import { createScope, animate } from "animejs";
import type { AgentDef } from "@@/lib/agents";
import { cn } from "@/lib/utils";
import type { AgentStatus, LaunchdStatus } from "@/a2a/heartbeat-types";

function LaunchdBadge({ launchd }: { launchd: LaunchdStatus | null }) {
  if (!launchd) return <span className="text-[9px] text-muted-foreground/30 uppercase tracking-wide">—</span>;
  if (!launchd.loaded) return <span className="text-[9px] text-muted-foreground/40 uppercase tracking-wide">unloaded</span>;
  if (launchd.running) return <span className="text-[9px] text-blue-500/80 uppercase tracking-wide animate-pulse">● processing</span>;
  return <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wide">● idle</span>;
}

export function AgentButton({
  agent,
  isActive,
  status,
  hasData,
  onClick,
}: {
  agent: AgentDef;
  isActive: boolean;
  status: AgentStatus | undefined;
  hasData: boolean;
  onClick: () => void;
}) {
  const root = React.useRef<HTMLButtonElement>(null);
  const scope = React.useRef<ReturnType<typeof createScope> | null>(null);
  const Icon = agent.icon;
  const isOnline = status?.online ?? false;
  const isRunning = status?.launchd?.running ?? false;

  React.useEffect(() => {
    if (!isRunning) {
      scope.current?.revert();
      scope.current = null;
      return;
    }
    scope.current = createScope({ root: root.current! }).add(() => {
      animate(".shimmer-sweep", {
        translateX: ["-100%", "100%"],
        duration: 2000,
        ease: "linear",
        loop: true,
      });
    });
    return () => {
      scope.current?.revert();
      scope.current = null;
    };
  }, [isRunning]);

  return (
    <button
      ref={root}
      onClick={onClick}
      className={cn(
        "mx-2 my-0.5 rounded-lg px-4 py-2.5 flex items-center gap-3 text-left transition-all w-[calc(100%-1rem)] relative overflow-hidden",
        isActive
          ? "bg-blue-100/60 text-blue-900 border-l-4 border-blue-500"
          : "text-muted-foreground hover:bg-muted hover:translate-x-0.5 duration-200",
      )}
    >
      {/* Shimmer sweep — visible only when launchd is running */}
      {isRunning && (
        <div
          className="shimmer-sweep absolute top-0 left-0 h-full z-0 pointer-events-none bg-gradient-to-r from-transparent via-blue-500/20 to-transparent"
          style={{ width: "200%" }}
        />
      )}

      <Icon className={cn("w-4 h-4 shrink-0 relative z-10", isActive ? "text-blue-700" : "")} />
      <div className="flex-1 min-w-0 flex flex-col gap-0.5 relative z-10">
        <span className={cn("text-sm font-medium", !isActive && "text-foreground/80")}>
          {agent.displayName}
        </span>
        <LaunchdBadge launchd={status?.launchd ?? null} />
      </div>
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-500 relative z-10",
          isActive
            ? "bg-blue-500"
            : isOnline
              ? "bg-green-500 animate-pulse"
              : !hasData
                ? "bg-muted-foreground/20"
                : "bg-red-400/60",
        )}
      />
    </button>
  );
}
