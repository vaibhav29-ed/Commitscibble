import { hashContent } from "@commitscibble/shared/node";

export interface FreshnessInput {
  baseReadmeHash: string;
  currentContent: string;
  proposedContent: string;
}

export interface FreshnessResult {
  decision: "APPLY" | "STALE" | "NO_CHANGE";
  reason: string;
}

export function evaluateProposalFreshness(input: FreshnessInput): FreshnessResult {
  const currentHash = hashContent(input.currentContent);
  if (currentHash !== input.baseReadmeHash) {
    return {
      decision: "STALE",
      reason:
        "The README changed after this proposal was generated. Regenerate the proposal so the review covers the current content.",
    };
  }
  if (currentHash === hashContent(input.proposedContent)) {
    return {
      decision: "NO_CHANGE",
      reason: "The proposed documentation already matches the README; no commit is required.",
    };
  }
  return { decision: "APPLY", reason: "Base content matches; the proposal can be applied." };
}
