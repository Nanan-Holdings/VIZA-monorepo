export type Ds160ProofLocalPaths = {
  confirmationPdfPath?: string;
  applicationPdfPath?: string;
  emailConfirmationPdfPath?: string;
};

export type Ds160ProofStoragePaths = {
  confirmationPdfStoragePath?: string;
  applicationPdfStoragePath?: string;
  emailConfirmationPdfStoragePath?: string;
};

export type Ds160ProofArtifactStatus =
  | { status: "available"; storedKinds: string[] }
  | { status: "unavailable"; failureStage: "confirmation_preparation" | "confirmation_capture" | "storage" };

export type Ds160SubmittedArtifactResult = {
  storagePaths: Ds160ProofStoragePaths;
  status: Ds160ProofArtifactStatus;
};

/**
 * Capture and store optional post-confirmation artifacts without allowing an
 * artifact failure to escape into the already-confirmed submission path.
 */
export async function persistDs160SubmittedArtifacts(input: {
  capture: () => Promise<Ds160ProofLocalPaths>;
  upload: (paths: Ds160ProofLocalPaths) => Promise<Ds160ProofStoragePaths>;
}): Promise<Ds160SubmittedArtifactResult> {
  let localPaths: Ds160ProofLocalPaths;
  try {
    localPaths = await input.capture();
  } catch {
    return {
      storagePaths: {},
      status: { status: "unavailable", failureStage: "confirmation_capture" },
    };
  }

  if (Object.keys(localPaths).length === 0) {
    return {
      storagePaths: {},
      status: { status: "unavailable", failureStage: "confirmation_capture" },
    };
  }

  try {
    const storagePaths = await input.upload(localPaths);
    const storedKinds = Object.keys(storagePaths);
    return storedKinds.length > 0
      ? { storagePaths, status: { status: "available", storedKinds } }
      : { storagePaths: {}, status: { status: "unavailable", failureStage: "storage" } };
  } catch {
    return {
      storagePaths: {},
      status: { status: "unavailable", failureStage: "storage" },
    };
  }
}
