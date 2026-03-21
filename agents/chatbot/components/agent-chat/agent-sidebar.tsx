"use client";

import * as React from "react";
import { AGENTS } from "@@/lib/agents";
import { cn } from "@/lib/utils";

export function AgentSidebar() {
  const [ports, setPorts] = React.useState<Record<string, number> | null>(null);
  const [online, setOnline] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/ports");
        if (!cancelled && res.ok) {
          setPorts((await res.json()) as Record<string, number>);
          setOnline(true);
        } else if (!cancelled) {
          setOnline(false);
        }
      } catch {
        if (!cancelled) setOnline(false);
      }
    };
    void poll();
    const id = setInterval(() => void poll(), 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-sidebar p-4 flex flex-col gap-3">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
        🐾 My Agents
      </h2>
      {AGENTS.map((agent) => {
        const Icon = agent.icon;
        return (
          <div
            key={agent.manifestKey}
            className="rounded-xl border border-border bg-background p-3"
          >
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium text-foreground truncate">
                {agent.displayName}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  online ? "bg-green-500 animate-pulse" : "bg-muted-foreground/40",
                )}
              />
              <span className="text-xs font-mono text-muted-foreground">
                {ports?.[agent.manifestKey] != null ? `:${ports[agent.manifestKey]}` : "—"}
              </span>
              <span className="text-xs text-muted-foreground truncate">
                · {agent.scheduleDisplay}
              </span>
            </div>
          </div>
        );
      })}
      {!online && (
        <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">
          Run <code className="text-xs">npm run chatbot:servers</code>
        </p>
      )}
      <p className="text-xs text-muted-foreground mt-auto pt-2">
        <code className="text-xs">net port=0</code> · dynamic allocation
      </p>
    </aside>
  );
}
