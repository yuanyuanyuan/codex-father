/*
 * Minimal, dependency-free smoke check for repo health.
 * - Node >= 18
 * - Key files/dirs exist
 * - Can read package.json and parse name/version
 * - Dist CLI entry present
 *
 * Output: human summary + machine-readable JSON
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cwd = process.cwd();

function ok(msg) {
  console.log(`✅ ${msg}`);
}

function warn(msg) {
  console.log(`⚠️  ${msg}`);
}

function err(msg) {
  console.log(`❌ ${msg}`);
}

function exists(p) {
  try {
    fs.accessSync(p, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function readJSON(p) {
  const raw = fs.readFileSync(p, 'utf8');
  return JSON.parse(raw);
}

async function main() {
  const start = Date.now();
  const results = [];

  // Check 1: Node version
  try {
    const version = process.versions.node;
    const [maj] = version.split('.').map((n) => parseInt(n, 10));
    const pass = maj >= 18;
    results.push({ name: 'node>=18', pass, details: version });
    pass ? ok(`Node.js 版本满足要求: ${version}`) : err(`Node.js 版本过低: ${version}`);
  } catch (e) {
    results.push({ name: 'node>=18', pass: false, details: String(e) });
    err(`无法检测 Node.js 版本: ${e}`);
  }

  // Check 2: package.json
  try {
    const pkgPath = path.join(cwd, 'package.json');
    const pass = exists(pkgPath);
    results.push({ name: 'package.json 存在', pass, details: pkgPath });
    pass ? ok(`找到 package.json: ${pkgPath}`) : err('缺少 package.json');
  } catch (e) {
    results.push({ name: 'package.json 存在', pass: false, details: String(e) });
    err(`读取 package.json 失败: ${e}`);
  }

  // Check 3: parse package name/version
  try {
    const pkg = readJSON(path.join(cwd, 'package.json'));
    const pass = Boolean(pkg.name) && Boolean(pkg.version);
    results.push({ name: '解析包名与版本', pass, details: { name: pkg.name, version: pkg.version } });
    pass ? ok(`包信息: ${pkg.name} v${pkg.version}`) : err('package.json 缺少 name/version');
  } catch (e) {
    results.push({ name: '解析包名与版本', pass: false, details: String(e) });
    err(`解析 package.json 失败: ${e}`);
  }

  // Check 4: key files/dirs
  const paths = [
    'tsconfig.build.json',
    'vitest.config.ts',
    'start.sh',
    'job.sh',
    'core',
  ];
  for (const rel of paths) {
    const p = path.join(cwd, rel);
    const pass = exists(p);
    results.push({ name: `存在: ${rel}`, pass, details: p });
    pass ? ok(`存在: ${rel}`) : warn(`缺失: ${rel}`);
  }

  // Check 5: dist CLI entry (optional but useful)
  const distEntry = path.join(cwd, 'dist/core/cli/start.js');
  {
    const pass = exists(distEntry);
    results.push({ name: '构建产物: dist/core/cli/start.js', pass, details: distEntry });
    pass ? ok('已编译 CLI 入口存在') : warn('未找到已编译 CLI 入口 (可运行 npm run build)');
  }

  const elapsed = Date.now() - start;
  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;

  console.log('---');
  console.log(`总结: 通过 ${passed}/${results.length}，耗时 ${elapsed}ms`);
  const summary = { success: failed === 0, passed, failed, elapsedMs: elapsed, cwd };

  // Machine-readable line for tooling
  console.log(JSON.stringify({ summary, checks: results }, null, 2));

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  err(`执行失败: ${e?.stack || e}`);
  process.exit(1);
});

