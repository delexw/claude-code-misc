import * as React from "react";
import Link from "next/link";
import { Trash2, FolderGit2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AGENTS } from "@@/lib/agents";
import type { Repository } from "@/lib/settings";

interface RepoTableProps {
  repositories: Repository[];
  agentRepos: Record<string, string[]>;
  onEdit: (repo: Repository) => void;
  onRemove: (id: string) => void;
}

export function RepoTable({ repositories, agentRepos, onEdit, onRemove }: RepoTableProps) {
  if (repositories.length === 0) {
    return (
      <div className="rounded-xl border border-outline-variant/30 bg-surface-container">
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-on-surface-variant">
          <FolderGit2 className="w-10 h-10 opacity-30" />
          <p className="text-sm font-medium">No repositories configured</p>
          <p className="text-xs opacity-60">Add a repository to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-outline-variant/30 bg-surface-container overflow-hidden">
      {/* Table header */}
      <div className="grid grid-cols-[1fr_2fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-outline-variant/20 bg-surface-container-high">
        <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
          Name
        </span>
        <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
          GitHub
        </span>
        <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
          Agents
        </span>
        <span className="sr-only">Edit</span>
        <span className="sr-only">Delete</span>
      </div>

      {/* Rows */}
      {repositories.map((repo, i) => {
        const enabledAgents = AGENTS.filter(
          (a) => agentRepos[a.name]?.includes(repo.id) ?? false,
        );

        return (
          <div
            key={repo.id}
            className={`grid grid-cols-[1fr_2fr_auto_auto_auto] gap-4 items-center px-5 py-4 ${
              i < repositories.length - 1 ? "border-b border-outline-variant/10" : ""
            } hover:bg-surface-container-high/50 transition-colors group`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <FolderGit2 className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm font-semibold text-on-surface truncate">{repo.name}</span>
            </div>
            <span className="text-xs font-mono text-on-surface-variant truncate">
              {repo.githubRepo}
            </span>

            {/* Agent icons */}
            <div className="flex items-center gap-1">
              {enabledAgents.length === 0 ? (
                <span className="text-xs text-on-surface-variant/40">—</span>
              ) : (
                enabledAgents.map((agent) => {
                  const Icon = agent.icon;
                  return (
                    <Tooltip key={agent.name}>
                      <TooltipTrigger asChild>
                        <Link
                          href={`/settings/agents/${agent.name}/repos`}
                          className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 hover:bg-primary/20 transition-colors"
                        >
                          <Icon className="w-3 h-3" />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>{agent.displayName}</TooltipContent>
                    </Tooltip>
                  );
                })
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(repo)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high h-8 w-8 p-0"
              title={`Edit ${repo.name}`}
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(repo.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-on-surface-variant hover:text-error hover:bg-error-container/30 h-8 w-8 p-0"
              title={`Remove ${repo.name}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
