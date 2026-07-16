export function isLocalTestSessionAllowed({
  host,
  nodeEnv,
  enabled,
}: {
  host: string | null;
  nodeEnv: string | undefined;
  enabled: string | undefined;
}): boolean {
  const hostname = host?.split(":")[0].toLowerCase();
  return (
    nodeEnv === "development" &&
    enabled === "true" &&
    (hostname === "127.0.0.1" || hostname === "localhost")
  );
}
