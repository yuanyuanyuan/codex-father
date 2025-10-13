import type { CLIParser } from '../parser.js';
import { startHttpServer } from '../../http/server.js';

export function registerHttpCommand(parser: CLIParser): void {
  parser.registerCommand(
    'http:serve',
    '启动只读 HTTP/SSE 服务（/api/v1）',
    async (ctx) => {
      const host = (ctx.options.host as string) || '0.0.0.0';
      const port = Number(ctx.options.port ?? 7070);
      const sessions = (ctx.options.sessions as string) || '';
      const repoRoot = (ctx.options.repoRoot as string) || process.cwd();

      await startHttpServer({ host, port, sessionsRoot: sessions, repoRoot });

      return {
        success: true,
        message: `HTTP server started on http://${host}:${port}`,
        data: { host, port, sessionsRoot: sessions || undefined, repoRoot },
        executionTime: 0,
      };
    },
    {
      options: [
        {
          flags: '--host <host>',
          description: '监听地址（默认 0.0.0.0）',
          defaultValue: '0.0.0.0',
        },
        { flags: '--port <port>', description: '监听端口（默认 7070）', defaultValue: 7070 },
        { flags: '--sessions <path>', description: 'sessions 根目录（可选）' },
        { flags: '--repo-root <path>', description: '仓库根目录（默认 CWD）' },
      ],
    }
  );
}
