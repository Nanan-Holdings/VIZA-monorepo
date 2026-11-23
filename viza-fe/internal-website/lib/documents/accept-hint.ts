/**
 * Human-readable list of the file types an upload input actually accepts.
 * Built from the same `accept` string passed to the file input, so the hint
 * can never promise a format the upload then rejects.
 */
const TYPE_LABELS: ReadonlyArray<[RegExp, string]> = [
  [/^(?:\.pdf|application\/pdf)$/i, "PDF"],
  [/^(?:\.jpe?g|image\/jpe?g)$/i, "JPG"],
  [/^(?:\.png|image\/png)$/i, "PNG"],
  [/^(?:\.webp|image\/webp)$/i, "WebP"],
  [/^(?:\.heic|\.heif|image\/hei[cf])$/i, "HEIC"],
  [/^(?:\.doc|application\/msword)$/i, "DOC"],
  [/^(?:\.docx|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/i, "DOCX"],
  [/^(?:\.json|application\/json)$/i, "JSON"],
];

export function acceptedFileTypeLabels(accept: string): string[] {
  const labels: string[] = [];
  for (const token of accept.split(",").map((value) => value.trim()).filter(Boolean)) {
    const label = TYPE_LABELS.find(([pattern]) => pattern.test(token))?.[1]
      ?? (token.startsWith(".") ? token.slice(1).toUpperCase() : null);
    if (label && !labels.includes(label)) labels.push(label);
  }
  return labels;
}

export function describeAcceptedFileTypes(accept: string, isZh: boolean): string {
  const labels = acceptedFileTypeLabels(accept);
  if (labels.length === 0) return "";
  if (labels.length === 1) return isZh ? `仅支持 ${labels[0]}` : `${labels[0]} only`;
  const head = labels.slice(0, -1);
  const last = labels[labels.length - 1];
  return isZh ? `支持 ${head.join("、")} 和 ${last}` : `${head.join(", ")} or ${last}`;
}
