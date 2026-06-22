export interface VietnamApplyEntryCandidate {
  buttons: Array<{ index: number; text: string; visible: boolean }>;
  links: Array<{ href: string }>;
}

export type VietnamApplyEntryChoice =
  | { kind: "button"; index: number }
  | { kind: "link"; href: string }
  | null;

export function chooseVietnamApplyEntry(
  candidates: VietnamApplyEntryCandidate,
): VietnamApplyEntryChoice {
  const button = candidates.buttons.find(
    (candidate) =>
      candidate.visible &&
      /for foreigners outside viet ?nam applying personally|apply now|e-visa for foreigners/i.test(
        candidate.text,
      ),
  );
  if (button) return { kind: "button", index: button.index };

  const link = candidates.links.find((candidate) =>
    /\/e-visa\/foreigners/i.test(candidate.href),
  );
  return link ? { kind: "link", href: link.href } : null;
}
