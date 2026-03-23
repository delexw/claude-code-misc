import * as React from "react";
import { Trash2, KeyRound, Lock, Eye, EyeOff, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EnvVar } from "@/lib/settings";

interface EnvVarTableProps {
  envVars: EnvVar[];
  onEdit: (envVar: EnvVar) => void;
  onRemove: (id: string) => void;
}

function MaskedValue({
  value,
  isSecret,
  keychainService,
  keychainAccount,
}: {
  value: string;
  isSecret: boolean;
  keychainService?: string;
  keychainAccount?: string;
}) {
  const [visible, setVisible] = React.useState(false);

  // Non-secret values are shown as plain text — no masking needed
  if (!isSecret) {
    return (
      <span className="text-xs font-mono text-on-surface-variant truncate">{value}</span>
    );
  }

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="text-xs font-mono text-on-surface-variant truncate">
        {visible ? value : "•".repeat(Math.min(value.length || 8, 24))}
      </span>
      <span className="shrink-0 text-[10px] font-medium text-primary/70 bg-primary/10 rounded px-1 py-0.5 leading-none">
        {keychainService ? `${keychainService} / ${keychainAccount ?? ""}` : "keychain"}
      </span>
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="shrink-0 text-on-surface-variant/50 hover:text-on-surface-variant transition-colors"
        title={visible ? "Hide value" : "Show value"}
      >
        {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

export function EnvVarTable({ envVars, onEdit, onRemove }: EnvVarTableProps) {
  if (envVars.length === 0) {
    return (
      <div className="rounded-xl border border-outline-variant/30 bg-surface-container">
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-on-surface-variant">
          <KeyRound className="w-10 h-10 opacity-30" />
          <p className="text-sm font-medium">No environment variables configured</p>
          <p className="text-xs opacity-60">Add a variable to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-outline-variant/30 bg-surface-container overflow-hidden">
      {/* Table header */}
      <div className="grid grid-cols-[1fr_2fr_auto_auto] gap-4 px-5 py-3 border-b border-outline-variant/20 bg-surface-container-high">
        <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
          Key
        </span>
        <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
          Value
        </span>
        <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider sr-only">
          Actions
        </span>
        <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider sr-only">
          Delete
        </span>
      </div>

      {/* Rows */}
      {envVars.map((envVar, i) => (
        <div
          key={envVar.id}
          className={`grid grid-cols-[1fr_2fr_auto_auto] gap-4 items-center px-5 py-4 ${
            i < envVars.length - 1 ? "border-b border-outline-variant/10" : ""
          } hover:bg-surface-container-high/50 transition-colors group`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {envVar.isSecret ? (
              <Lock className="w-4 h-4 text-primary shrink-0" />
            ) : (
              <KeyRound className="w-4 h-4 text-primary shrink-0" />
            )}
            <span className="text-sm font-mono font-semibold text-on-surface truncate">
              {envVar.key}
            </span>
          </div>
          <MaskedValue
            value={envVar.value}
            isSecret={envVar.isSecret}
            keychainService={envVar.keychainService}
            keychainAccount={envVar.keychainAccount}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(envVar)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high h-8 w-8 p-0"
            title={`Edit ${envVar.key}`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(envVar.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-on-surface-variant hover:text-error hover:bg-error-container/30 h-8 w-8 p-0"
            title={`Remove ${envVar.key}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}
