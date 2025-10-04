import type { PatchApplyResult, PatchProposal } from './types.js';

/**
 * PatchApplier 管理补丁应用与结果反馈喵。
 */
export class PatchApplier {
  /**
   * 应用补丁提案的占位实现。
   *
   * @param proposal 待应用的补丁提案。
   * @returns 补丁应用结果。
   */
  public async apply(proposal: PatchProposal): Promise<PatchApplyResult> {
    if (proposal.targetFiles.length === 0) {
      return {
        success: false,
        errorMessage: '缺少目标文件，补丁无法应用',
      };
    }

    return {
      success: true,
    };
  }
}
