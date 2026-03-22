"use client";

import * as React from "react";
import { PawPrint } from "lucide-react";
import { AGENTS } from "@@/lib/agents";
import { cn } from "@/lib/utils";

export function AgentSidebar() {
  const [ports, setPorts] = React.useState<Record<string, number> | null>(null);
  const [online, setOnline] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);

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
    <aside className="h-screen w-72 shrink-0 flex flex-col bg-background border-r border-border/30">
      {/* Logo header */}
      <div className="px-6 py-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
            <PawPrint className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xs uppercase tracking-[0.2em] font-bold text-muted-foreground">
              DOVEPAW AGENTS
            </h2>
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest">
              AI Workforce
            </p>
          </div>
        </div>
      </div>

      {/* Agent nav */}
      <nav className="flex flex-col gap-1 flex-1 overflow-y-auto misty-scroll px-2">
        {AGENTS.map((agent, i) => {
          const Icon = agent.icon;
          const isActive = i === activeIndex;
          return (
            <button
              key={agent.manifestKey}
              onClick={() => setActiveIndex(i)}
              className={cn(
                "mx-2 my-0.5 rounded-lg px-4 py-3 flex items-center gap-3 text-left transition-all w-[calc(100%-1rem)]",
                isActive
                  ? "bg-blue-100/60 text-blue-900 border-l-4 border-blue-500"
                  : "text-muted-foreground hover:bg-muted hover:translate-x-0.5 duration-200",
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-blue-700" : "")} />
              <span className={cn("flex-1 text-sm font-medium", !isActive && "text-foreground/80")}>
                {agent.displayName}
              </span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom branding */}
      <div className="p-6 mt-auto">
        <div className="p-4 rounded-xl bg-muted border border-border/40">
          <p className="text-[11px] font-bold text-primary tracking-tight mb-1">DovePaw</p>
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full shrink-0",
                online ? "bg-green-500 animate-pulse" : "bg-muted-foreground/40",
              )}
            />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              {online
                ? `System Status: Optimal · ${ports ? Object.keys(ports).length : 0} active`
                : "Agents Offline"}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
