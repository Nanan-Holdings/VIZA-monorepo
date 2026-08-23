import type {
  ApplicationListItem,
  ApplicationListRecord,
} from "@/app/client/status/applications-list";

export type RecentApplicationTarget = {
  labelMode: "continue" | "view" | "start";
  href: string;
  applicationId: string | null;
};

function recordTimestamp(record: ApplicationListRecord): number {
  const value = record.updatedAt ?? record.submittedAt ?? record.createdAt;
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function sortLatestFirst(
  left: ApplicationListRecord,
  right: ApplicationListRecord
) {
  const timestampDelta = recordTimestamp(right) - recordTimestamp(left);
  if (timestampDelta !== 0) return timestampDelta;
  return right.selectionKey.localeCompare(left.selectionKey);
}

export function getRecentApplicationTarget(
  items: ApplicationListItem[]
): RecentApplicationTarget {
  const records = items.flatMap((item) => item.records).sort(sortLatestFirst);
  const latestOngoing = records.find((record) => record.ongoing);

  if (latestOngoing) {
    return {
      labelMode: "continue",
      href: latestOngoing.continueHref || latestOngoing.detailHref,
      applicationId: latestOngoing.applicationId,
    };
  }

  const latestTerminal = records[0] ?? null;
  if (latestTerminal) {
    return {
      labelMode: "view",
      href: latestTerminal.detailHref || latestTerminal.continueHref,
      applicationId: latestTerminal.applicationId,
    };
  }

  return {
    labelMode: "start",
    href: "#start-new-application",
    applicationId: null,
  };
}
