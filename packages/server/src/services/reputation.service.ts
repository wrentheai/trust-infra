import { ReputationRepository } from '../repositories/reputation.repository.js';
import type { Reputation } from '../db/schema/reputation.js';

export type OutcomeType = 'success' | 'partial_success' | 'failure' | 'user_corrected' | 'harmful';

const OUTCOME_IMPACT_SCORES: Record<OutcomeType, number> = {
  success: 0.5,
  partial_success: 0.2,
  failure: -0.3,
  user_corrected: -0.5,
  harmful: -2.0,
};

export class ReputationService {
  constructor(private reputationRepo: ReputationRepository) {}

  /**
   * Get reputation for an agent
   */
  async getReputation(agentId: string): Promise<Reputation> {
    const reputation = await this.reputationRepo.findByAgentId(agentId);
    if (!reputation) {
      throw new Error(`Reputation not found for agent: ${agentId}`);
    }
    return reputation;
  }

  /**
   * Update reputation based on outcome
   */
  async recordOutcome(
    agentId: string,
    outcomeType: OutcomeType,
    customImpactScore?: number
  ): Promise<Reputation> {
    const current = await this.getReputation(agentId);

    const impactScore = customImpactScore ?? OUTCOME_IMPACT_SCORES[outcomeType];

    // Calculate new overall score (clamped 0-100)
    const newOverallScore = Math.max(
      0,
      Math.min(100, Number(current.overallScore) + impactScore)
    );

    // Calculate new total actions
    const newTotalActions = Number(current.totalActions) + 1;

    // Determine if outcome is success or failure
    const isSuccess = ['success', 'partial_success'].includes(outcomeType);
    const isFailure = ['failure', 'user_corrected', 'harmful'].includes(outcomeType);
    const isHarmful = outcomeType === 'harmful';
    const isUserCorrected = outcomeType === 'user_corrected';

    // Calculate new rates
    const currentSuccesses = Number(current.successRate) * Number(current.totalActions);
    const currentFailures = Number(current.failureRate) * Number(current.totalActions);

    const newSuccesses = currentSuccesses + (isSuccess ? 1 : 0);
    const newFailures = currentFailures + (isFailure ? 1 : 0);

    const newSuccessRate = newSuccesses / newTotalActions;
    const newFailureRate = newFailures / newTotalActions;

    // Update counts
    const newHarmfulActions = Number(current.harmfulActions) + (isHarmful ? 1 : 0);
    const newUserCorrections = Number(current.userCorrections) + (isUserCorrected ? 1 : 0);

    return this.reputationRepo.update(agentId, {
      overallScore: newOverallScore,
      totalActions: newTotalActions,
      successRate: newSuccessRate,
      failureRate: newFailureRate,
      harmfulActions: newHarmfulActions,
      userCorrections: newUserCorrections,
    });
  }

  /**
   * Update domain-specific score in breakdown
   */
  async updateDomainScore(
    agentId: string,
    domain: string,
    score: number
  ): Promise<Reputation> {
    const current = await this.getReputation(agentId);
    const breakdown = { ...(current.breakdown as any), [domain]: score };

    return this.reputationRepo.update(agentId, { breakdown });
  }

  /**
   * Get all reputations sorted by score
   */
  async listReputations(): Promise<Reputation[]> {
    return this.reputationRepo.findAll();
  }

  /**
   * Check if agent should be downgraded based on reputation
   */
  async shouldDowngrade(agentId: string): Promise<{
    shouldDowngrade: boolean;
    reason?: string;
  }> {
    const reputation = await this.getReputation(agentId);

    // Critical thresholds
    const CRITICAL_SCORE = 20;
    const HIGH_FAILURE_RATE = 0.5;
    const HARMFUL_THRESHOLD = 5;

    if (Number(reputation.overallScore) < CRITICAL_SCORE) {
      return {
        shouldDowngrade: true,
        reason: `Overall score too low: ${reputation.overallScore}`,
      };
    }

    if (Number(reputation.failureRate) > HIGH_FAILURE_RATE) {
      return {
        shouldDowngrade: true,
        reason: `Failure rate too high: ${reputation.failureRate}`,
      };
    }

    if (Number(reputation.harmfulActions) >= HARMFUL_THRESHOLD) {
      return {
        shouldDowngrade: true,
        reason: `Too many harmful actions: ${reputation.harmfulActions}`,
      };
    }

    return { shouldDowngrade: false };
  }
}
