"use client";

import * as React from "react";
import { StatsCards } from "./stats-cards";
import { RepoTable } from "./repo-table";
import { AddRepoDialog } from "./add-repo-dialog";
import { WS_PORT } from "@/a2a/heartbeat-types";
import type { AgentStatus, StatusMessage } from "@/a2a/heartbeat-types";
import type { GlobalSettings, Repository } from "@/lib/settings";

const WS_URL = `ws://127.0.0.1:${WS_PORT}`;
const RECONNECT_DELAY_MS = 3_000;

function useAgentStatuses() {
  const [statuses, setStatuses] = React.useState<Record<string, AgentStatus>>({});

  React.useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    function connect() {
      ws = new WebSocket(WS_URL);
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as StatusMessage;
          if (msg.type === "status") setStatuses(msg.agents);
        } catch {
          // ignore malformed messages
        }
      };
      ws.onclose = () => {
        if (!cancelled) reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      };
      ws.onerror = () => ws?.close();
    }

    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);

  return statuses;
}

interface SettingsContentProps {
  initialSettings: GlobalSettings;
}

export function SettingsContent({ initialSettings }: SettingsContentProps) {
  const [repositories, setRepositories] = React.useState<Repository[]>(
    initialSettings.repositories,
  );
  const [saving, setSaving] = React.useState(false);
  const statuses = useAgentStatuses();

  async function saveRepositories(next: Repository[]) {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositories: next.map((r) => ({ githubRepo: r.githubRepo })) }),
      });
      if (res.ok) {
        const updated = (await res.json()) as GlobalSettings;
        setRepositories(updated.repositories);
      }
    } finally {
      setSaving(false);
    }
  }

  function handleAdd(githubRepo: string) {
    const name = githubRepo.split("/").at(-1) ?? githubRepo;
    const next = [...repositories, { id: crypto.randomUUID(), name, githubRepo }];
    setRepositories(next);
    void saveRepositories(next);
  }

  function handleRemove(id: string) {
    const next = repositories.filter((r) => r.id !== id);
    setRepositories(next);
    void saveRepositories(next);
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-on-surface tracking-tight">
            Global Repository Settings
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Manage the git repositories watched by all agents.
            {saving && <span className="ml-2 text-primary">Saving…</span>}
          </p>
        </div>
        <AddRepoDialog
          existingGithubRepos={repositories.map((r) => r.githubRepo)}
          onAdd={handleAdd}
        />
      </div>

      {/* Stats */}
      <StatsCards repoCount={repositories.length} statuses={statuses} />

      {/* Repo list */}
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-on-surface">
          Repositories
          <span className="ml-2 text-sm font-normal text-on-surface-variant">
            ({repositories.length})
          </span>
        </h2>
        <RepoTable repositories={repositories} onRemove={handleRemove} />
      </div>
    </div>
  );
}
