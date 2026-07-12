export function encodeReqId(orderId: string, nonce: string): string {
  const compactOrderId = orderId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 36);
  const compactNonce = nonce.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);

  return `viza_${compactOrderId}_${compactNonce}`.slice(0, 64);
}
