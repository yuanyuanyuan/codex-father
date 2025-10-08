export interface UnderstandingCheckOptions {
  evaluateConsistency: (input: {
    requirement: string;
    restatement: string;
  }) => Promise<{ consistent: boolean; issues: string[] }>;
}

export class UnderstandingCheck {
  private readonly evaluate: UnderstandingCheckOptions['evaluateConsistency'];

  public constructor(options: UnderstandingCheckOptions) {
    this.evaluate = options.evaluateConsistency;
  }

  public async validate(input: {
    requirement: string;
    restatement: string;
  }): Promise<{ consistent: boolean; issues: string[] }> {
    const result = await this.evaluate({
      requirement: input.requirement,
      restatement: input.restatement,
    });
    if (!result.consistent) {
      const message =
        result.issues && result.issues.length > 0
          ? result.issues.join(', ')
          : 'inconsistent restatement';
      throw new Error(message);
    }
    return result;
  }
}
