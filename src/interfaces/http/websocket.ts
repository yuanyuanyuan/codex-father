import { WebSocket } from 'ws';

export interface WebSocketMessage {
  type:
    | 'task_started'
    | 'task_progress'
    | 'task_completed'
    | 'task_failed'
    | 'task_cancelled'
    | 'task_reply';
  data: any;
  timestamp: string;
}

export class WebSocketManager {
  private clients: Set<WebSocket> = new Set();
  private messageQueue: WebSocketMessage[] = [];

  handleConnection(ws: WebSocket, req: any): void {
    console.log(`WebSocket connection established from ${req.socket.remoteAddress}`);

    this.clients.add(ws);

    // Send any queued messages
    this.messageQueue.forEach((message) => {
      this.sendToClient(ws, message);
    });

    // Handle incoming messages
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(ws, message);
      } catch (error) {
        console.error('Invalid WebSocket message:', error);
        this.sendToClient(ws, {
          type: 'error',
          data: { message: 'Invalid message format' },
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Handle connection close
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      this.clients.delete(ws);
    });

    // Handle connection errors
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.clients.delete(ws);
    });

    // Send welcome message
    this.sendToClient(ws, {
      type: 'connection_established',
      data: {
        message: 'Connected to Codex Father WebSocket',
        clientId: this.generateClientId(),
      },
      timestamp: new Date().toISOString(),
    });
  }

  broadcastUpdate(message: WebSocketMessage): void {
    // Add to message queue for new clients
    this.messageQueue.push(message);

    // Keep only last 100 messages in queue
    if (this.messageQueue.length > 100) {
      this.messageQueue = this.messageQueue.slice(-100);
    }

    // Send to all connected clients
    const messageStr = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageStr);
        } catch (error) {
          console.error('Failed to send WebSocket message:', error);
          this.clients.delete(client);
        }
      }
    });
  }

  broadcastTaskProgress(taskId: string, progress: number, message?: string): void {
    this.broadcastUpdate({
      type: 'task_progress',
      data: {
        taskId,
        progress,
        message,
      },
      timestamp: new Date().toISOString(),
    });
  }

  broadcastTaskCompleted(taskId: string, result: any, duration: number): void {
    this.broadcastUpdate({
      type: 'task_completed',
      data: {
        taskId,
        result,
        duration,
      },
      timestamp: new Date().toISOString(),
    });
  }

  broadcastTaskFailed(taskId: string, error: string, duration: number): void {
    this.broadcastUpdate({
      type: 'task_failed',
      data: {
        taskId,
        error,
        duration,
      },
      timestamp: new Date().toISOString(),
    });
  }

  broadcastTaskStarted(taskId: string, prompt?: string): void {
    this.broadcastUpdate({
      type: 'task_started',
      data: {
        taskId,
        prompt,
      },
      timestamp: new Date().toISOString(),
    });
  }

  private handleMessage(ws: WebSocket, message: any): void {
    const { type, data } = message;

    switch (type) {
      case 'ping':
        this.sendToClient(ws, {
          type: 'pong',
          data: { timestamp: new Date().toISOString() },
          timestamp: new Date().toISOString(),
        });
        break;

      case 'subscribe':
        // Client wants to subscribe to specific task updates
        if (data?.taskId) {
          this.sendToClient(ws, {
            type: 'subscribed',
            data: { taskId: data.taskId },
            timestamp: new Date().toISOString(),
          });
        }
        break;

      default:
        console.log(`Unknown WebSocket message type: ${type}`);
    }
  }

  private sendToClient(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send message to client:', error);
      }
    }
  }

  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  getClientCount(): number {
    return this.clients.size;
  }

  getQueueLength(): number {
    return this.messageQueue.length;
  }

  clearQueue(): void {
    this.messageQueue = [];
  }

  disconnectAll(): void {
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.close();
      }
    });
    this.clients.clear();
  }
}
