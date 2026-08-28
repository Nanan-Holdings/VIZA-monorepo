export type ClientSocketTransport = "polling" | "websocket";

export function resolveSocketTransports(
  multiReplicaFlag = process.env.NEXT_PUBLIC_SOCKET_IO_MULTI_REPLICA_ENABLED,
): ClientSocketTransport[] {
  return multiReplicaFlag === "true"
    ? ["websocket"]
    : ["polling", "websocket"];
}
