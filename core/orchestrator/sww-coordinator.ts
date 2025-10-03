import type { OrchestratorContext } from './types.js';

/**
 * SWWCoordinator 负责协调单写窗口（Single Writer Window）的生命周期喵。
 */
export class SWWCoordinator {
  /** 当前激活的窗口上下文。 */
  private activeContext: OrchestratorContext | undefined;

  /**
   * 开启新的写入窗口。
   *
   * @param context 即将执行的编排上下文。
   */
  public async openWindow(context: OrchestratorContext): Promise<void> {
    this.activeContext = context;
  }

  /**
   * 关闭当前写入窗口。
   */
  public async closeWindow(): Promise<void> {
    this.activeContext = undefined;
  }

  /**
   * 读取当前窗口上下文。
   *
   * @returns 当前上下文，没有窗口时返回 undefined。
   */
  public getActiveContext(): OrchestratorContext | undefined {
    return this.activeContext;
  }
}
