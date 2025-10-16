import { Session, Message } from '../../core/types.js';

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired sessions every hour
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupExpiredSessions();
      },
      60 * 60 * 1000
    );
  }

  createSession(taskId: string, initialMessage?: string): Session {
    const session: Session = {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      taskId,
      status: 'running',
      startTime: new Date(),
      messages: [],
    };

    if (initialMessage) {
      session.messages.push({
        role: 'user',
        content: initialMessage,
        timestamp: new Date(),
      });
    }

    this.sessions.set(session.id, session);
    return session;
  }

  updateSession(sessionId: string, message: Message): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.messages.push(message);

      // Update status based on message content
      if (message.content.includes('completed') || message.content.includes('finished')) {
        session.status = 'completed';
        session.endTime = new Date();
      } else if (message.content.includes('failed') || message.content.includes('error')) {
        session.status = 'failed';
        session.endTime = new Date();
      }
    }
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  getSessionByTaskId(taskId: string): Session | undefined {
    return Array.from(this.sessions.values()).find((session) => session.taskId === taskId);
  }

  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  cleanupExpiredSessions(): void {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [sessionId, session] of this.sessions.entries()) {
      const sessionAge = now.getTime() - session.startTime.getTime();

      if (sessionAge > maxAge) {
        this.sessions.delete(sessionId);
      }
    }
  }

  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.sessions.clear();
  }
}
