export function detectVersion(
  versionString: string
): { major: number; minor: number; patch: number } | null {
  const input = versionString;
  if (input == null) return null;

  const s = String(input).trim();
  if (!s) return null;

  let rest = s;
  if (rest[0] === "v" || rest[0] === "V") rest = rest.slice(1);

  const match = rest.match(/^(\d+)\.(\d+)(?:\.(\d+))?$/);
  if (!match) return null;

  const major = parseInt(match[1], 10);
  const minor = parseInt(match[2], 10);
  const patch = match[3] ? parseInt(match[3], 10) : 0;

  if (Number.isNaN(major) || Number.isNaN(minor) || Number.isNaN(patch)) return null;
  if (major < 0 || minor < 0 || patch < 0) return null;
  if (!Number.isSafeInteger(major) || !Number.isSafeInteger(minor) || !Number.isSafeInteger(patch)) return null;

  return { major, minor, patch };
}

