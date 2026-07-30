export interface DeploymentReadinessInput {
  workerBusy: boolean;
  oneTimeCardSessionsPresent: boolean;
  protectedBrowserSessionsPresent: boolean;
}

export function evaluateDeploymentReadiness(input: DeploymentReadinessInput) {
  return {
    ...input,
    safeToDeploy:
      !input.workerBusy &&
      !input.oneTimeCardSessionsPresent &&
      !input.protectedBrowserSessionsPresent,
  };
}
