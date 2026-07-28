/**
 * Correlate a PhotonPay cashier session back to our `order` row without a
 * schema change: encode the order id in the merchant `reqId`, then decode it in
 * the webhook. PhotonPay requires a unique reqId per checkout attempt, so a
 * caller-supplied nonce is appended while the leading UUID stays recoverable.
 *
 * The encoding MUST stay reversible. An earlier version stripped every
 * non-alphanumeric character out of the order id, which destroyed the UUID
 * hyphens — the webhook would then decode `null`, ack with `{"roger": true}`,
 * and leave a genuinely paid order sitting at `pending`. Silent revenue loss
 * with no error anywhere. Changing this format is safe only while no live
 * PhotonPay session exists.
 */

const SEP = "~";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** PhotonPay caps `reqId` at 64 characters. */
const MAX_REQ_ID = 64;

export function encodeReqId(orderId: string, nonce: string): string {
  const reqId = `${orderId}${SEP}${nonce}`;
  if (reqId.length > MAX_REQ_ID) {
    // Truncating would corrupt the nonce and risk a duplicate reqId, so a caller
    // passing something oversized should fail here rather than at PhotonPay.
    throw new Error(`PhotonPay reqId exceeds ${MAX_REQ_ID} chars (got ${reqId.length})`);
  }
  return reqId;
}

export function orderIdFromReqId(reqId: string): string | null {
  const id = (reqId ?? "").split(SEP)[0];
  return UUID_RE.test(id) ? id : null;
}
