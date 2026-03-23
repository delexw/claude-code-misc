import { notFound } from "next/navigation";
import { AgentSidebar } from "@/components/agent-chat/agent-sidebar";
import { AgentRepoSettings } from "@/components/settings/agent-repo-settings";
import { readSettings } from "@/lib/settings";
import { AGENTS } from "@@/lib/agents";

interface Props {
  params: Promise<{ agentName: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { agentName } = await params;
  const agent = AGENTS.find((a) => a.name === agentName);
  if (!agent) return { title: "Not Found — DovePaw" };
  return { title: `${agent.displayName}: Repos — DovePaw` };
}

export default async function AgentRepoSettingsPage({ params }: Props) {
  const { agentName } = await params;
  const agent = AGENTS.find((a) => a.name === agentName);
  if (!agent) notFound();

  const settings = readSettings();
  const enabledRepoIds = settings.agentRepos[agentName] ?? null;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <AgentSidebar />

      <main className="flex-1 flex flex-col bg-background relative min-w-0 overflow-y-auto">
        {/* Glass header */}
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/20 flex items-center w-full px-8 py-4 shrink-0">
          <h1 className="text-xl font-bold text-foreground tracking-tight">Agent Settings</h1>
        </header>

        <div className="flex-1 px-8 py-8 max-w-5xl mx-auto w-full">
          <AgentRepoSettings
            agentName={agentName}
            repositories={settings.repositories}
            initialEnabledRepoIds={enabledRepoIds}
          />
        </div>
      </main>
    </div>
  );
}
