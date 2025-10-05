function toTomlValue(v: unknown): string {
  if (typeof v === 'boolean' || typeof v === 'number') {
    return String(v);
  }
  if (v === null || v === undefined) {
    return '""';
  }
  const s = String(v).replace(/\\/g, '\\\\').replace(/\"/g, '\\"');
  return `"${s}"`;
}

export function applyConvenienceOptions(args: string[], p: Record<string, unknown>) {
  const hasSandbox = args.includes('--sandbox');
  const hasBypassArg = args.includes('--dangerously-bypass-approvals-and-sandbox');
  if (p?.sandbox && typeof p.sandbox === 'string') {
    args.push('--sandbox', p.sandbox);
  } else if (!hasSandbox && !hasBypassArg) {
    args.push('--sandbox', 'workspace-write');
  }
  if (p?.dangerouslyBypass) {
    args.push('--dangerously-bypass-approvals-and-sandbox');
  }
  if ((p?.dangerouslyBypass || hasBypassArg) && !args.includes('--sandbox')) {
    args.push('--sandbox', 'danger-full-access');
  }
  const bypassActive = Boolean(p?.dangerouslyBypass) || hasBypassArg;
  if (p?.approvalPolicy && typeof p.approvalPolicy === 'string') {
    if (!bypassActive) {
      args.push('--ask-for-approval', p.approvalPolicy);
    }
  }
  if (p?.fullAuto && !bypassActive) {
    args.push('--full-auto');
  }
  if (p?.profile && typeof p.profile === 'string') {
    args.push('--profile', p.profile);
  }
  if (p?.network) {
    args.push('--codex-config', 'sandbox_workspace_write.network_access=true');
  }
  if (p?.codexConfig && typeof p.codexConfig === 'object') {
    for (const [k, v] of Object.entries(p.codexConfig)) {
      args.push('--codex-config', `${k}=${toTomlValue(v)}`);
    }
  }
  if (p?.preset) {
    args.push('--preset', String(p.preset));
  }
  if (p?.carryContext === false) {
    args.push('--no-carry-context');
  }
  if (p?.compressContext === false) {
    args.push('--no-compress-context');
  }
  if (Number.isFinite((p as any)?.contextHead)) {
    args.push('--context-head', String((p as any).contextHead));
  }
  if (p?.patchMode) {
    args.push('--patch-mode');
  }
  if (Array.isArray((p as any)?.requireChangeIn)) {
    for (const g of (p as any).requireChangeIn) {
      args.push('--require-change-in', String(g));
    }
  }
  if (p?.requireGitCommit) {
    args.push('--require-git-commit');
  }
  if (p?.autoCommitOnDone) {
    args.push('--auto-commit-on-done');
  }
  if (p?.autoCommitMessage) {
    args.push('--auto-commit-message', String(p.autoCommitMessage));
  }
}
