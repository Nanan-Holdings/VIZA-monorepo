type TravelArchiveHydrationInput = {
  localArchivePresent: boolean;
  localChangedDuringHydration: boolean;
  localUpdatedAt: number;
  remoteUpdatedAt: number;
};

/**
 * Prefer the durable archive when this device has no saved Travel history.
 * When both sides exist, preserve the newest archive without replacing user
 * input that arrived while the remote request was in flight.
 */
export function shouldHydrateRemoteTravelArchive({
  localArchivePresent,
  localChangedDuringHydration,
  localUpdatedAt,
  remoteUpdatedAt,
}: TravelArchiveHydrationInput): boolean {
  if (localChangedDuringHydration) return false;
  if (!localArchivePresent) return true;
  return remoteUpdatedAt > localUpdatedAt;
}
