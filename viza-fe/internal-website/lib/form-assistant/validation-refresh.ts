export interface FormAssistantValidationRequestToken {
  requestId: number;
  answerRevision: number;
}

export function mergeFormAssistantIssueDraft(
  currentStepDraft: Record<string, string> | undefined,
  issuePatch: Record<string, string>,
): Record<string, string> {
  return { ...(currentStepDraft ?? {}), ...issuePatch };
}

/**
 * Tracks answer edits separately from validation requests so a slower response
 * can never restore issues for an older answer snapshot.
 */
export class FormAssistantValidationRefreshGuard {
  private answerRevision = 0;
  private requestId = 0;

  reset(): void {
    this.answerRevision = 0;
    this.requestId += 1;
  }

  markAnswersChanged(): number {
    this.answerRevision += 1;
    return this.answerRevision;
  }

  startRequest(): FormAssistantValidationRequestToken {
    this.requestId += 1;
    return {
      requestId: this.requestId,
      answerRevision: this.answerRevision,
    };
  }

  isCurrent(token: FormAssistantValidationRequestToken): boolean {
    return this.isLatestRequest(token) && token.answerRevision === this.answerRevision;
  }

  isLatestRequest(token: FormAssistantValidationRequestToken): boolean {
    return token.requestId === this.requestId;
  }
}
