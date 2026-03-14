// ─── Types ───────────────────────────────────────────────────────────────────

export type ForgeStatus = "success" | "failed";

export interface ForgeResult {
  ticketKey: string;
  status: ForgeStatus;
  worktreePath: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const AUTONOMY_PREFIX =
  "Autonomy mode: never use AskUserQuestion tool — explore answers yourself.";

// ─── JSON extraction ─────────────────────────────────────────────────────────

export function extractWorktreePath(stdout: string): string {
  try {
    const match = stdout.match(/\{[^{}]*"worktree_path"[^{}]*\}/);
    if (match) return JSON.parse(match[0]).worktree_path || "";
  } catch {
    // ignore parse errors
  }
  return "";
}

// ─── Prompt builders ─────────────────────────────────────────────────────────

export function buildForgePrompt(
  ticketKey: string,
  ticketUrl: string,
  repos: string[],
  devServerInfo: string,
): string {
  const repoList = repos.join("\n");
  const devUrlContext = devServerInfo
    ? ` Dev servers are already running: ${devServerInfo}`
    : "";
  return `[GSD: forge ${ticketKey}] ${AUTONOMY_PREFIX}
Invoke Skill("/forge ${ticketUrl} 'Find the correct repo from: ${repoList}. Multiple repos are possible.${devUrlContext}'")
Return the JSON output from forge ONLY without code fence.`;
}

export function buildGroupPrompt(
  primaryTicket: string,
  forges: ForgeResult[],
  repos: string[],
  hasFrontend: boolean,
): string {
  const worktreePaths = forges
    .map((r) => `${r.ticketKey}:${r.worktreePath}`)
    .join("\n");
  const repoList = repos.join("\n");

  const devEnvSteps = hasFrontend
    ? `4. Bootstrap all dev services in a single subagent (model: sonnet):
   - Launch one Agent(model: sonnet) with a prompt to run ALL 5 bootstrap skills sequentially (one by one, wait for each to finish before starting the next):
     - Determine the merge branch name from step 1
     - For each service, use worktree paths if available, otherwise use original repo paths from: ${repoList}
     - Skill("/elements-backend-bootstrap <backend_path> bootstrap on <merge_branch> branch")
     - Skill("/elements-storefront-bootstrap <storefront_path> bootstrap on <merge_branch> branch")
     - Skill("/elements-payment-bootstrap bootstrap on main branch")
     - Skill("/elements-search-bootstrap bootstrap on main branch")
     - Skill("/sso-server-bootstrap bootstrap on main branch")
     - Return all dev server URLs once ready
5. Run verification in a subagent: Agent(prompt: "Skill('/verification <dev_server_url>')") — pass the primary dev server URL from step 4
6. Kill all dev servers`
    : `4. Run verification in a subagent: Agent(prompt: "Skill('/verification')")`;

  const prStepBase = hasFrontend ? 7 : 5;
  const prSteps = forges
    .map(
      (r, i) =>
        `${prStepBase + i}. In worktree ${r.worktreePath}: Skill("/git-commit") then Skill("/create-pr 'create a Draft PR and keep description concise'")`,
    )
    .join("\n");

  return `[GSD: merge+verify ${primaryTicket}] ${AUTONOMY_PREFIX}
Track progress with a TODO list.

Forge results (ticket:worktree_path):
${worktreePaths}

Steps:
1. Create a merge branch from main named "${primaryTicket}-merge" (include a slug from the primary ticket title)
2. For each worktree, merge its changes into the merge branch:
   - git merge or cherry-pick from each worktree branch
   - Resolve any conflicts
3. Verify the merged code compiles and has no obvious issues
${devEnvSteps}
${prSteps}`;
}

export function buildBootstrapPrompt(): string {
  return `[GSD: bootstrap dev services on main] ${AUTONOMY_PREFIX}
Bootstrap all dev services in a single subagent (model: sonnet):
- Launch one Agent(model: sonnet) with a prompt to run ALL 5 bootstrap skills sequentially (one by one, wait for each to finish before starting the next):
  - Skill("/elements-backend-bootstrap fetch main to up-to-date and bootstrap on main branch")
  - Skill("/elements-storefront-bootstrap fetch main to up-to-date and bootstrap on main branch")
  - Skill("/elements-payment-bootstrap fetch main to up-to-date and bootstrap on main branch")
  - Skill("/elements-search-bootstrap fetch main to up-to-date and bootstrap on main branch")
  - Skill("/sso-server-bootstrap fetch main to up-to-date and bootstrap on main branch")
  - Return all dev server URLs once ready

Return ONLY a JSON object (no code fence) with the dev server URLs:
{"urls": ["<url1>", "<url2>", ...]}`;
}
