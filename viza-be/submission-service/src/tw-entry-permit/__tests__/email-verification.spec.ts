import assert from "node:assert/strict";
import test from "node:test";
import { extractTaiwanNiaVerificationCode, isTaiwanNiaVerificationEmail } from "../email-verification";

test("recognizes an NIA verification message and extracts its code", () => {
  const message = { from_addr: "notice@immigration.gov.tw", subject: "電子郵件驗證碼", text: "您的驗證碼為 827461", html: null };
  assert.equal(isTaiwanNiaVerificationEmail(message as never), true);
  assert.equal(extractTaiwanNiaVerificationCode(message), "827461");
});

test("does not accept an unrelated sender or unlabelled number", () => {
  const message = { from_addr: "notice@example.test", subject: "驗證碼", text: "驗證碼為 123456", html: null };
  assert.equal(isTaiwanNiaVerificationEmail(message as never), false);
  assert.equal(extractTaiwanNiaVerificationCode({ subject: "Status", text: "123456", html: null }), null);
});

test("decodes quoted-printable mail and a display-name sender", () => {
  const message = {
    from_addr: "NIA Service <notice@immigration.gov.tw>",
    subject: "=E9=9B=BB=E5=AD=90=E9=83=B5=E4=BB=B6=E9=A9=97=E8=AD=89=E7=A2=BC",
    text: "=E6=82=A8=E7=9A=84=E9=A9=97=E8=AD=89=E7=A2=BC=E7=82=BA 827461",
    html: null,
  };
  assert.equal(isTaiwanNiaVerificationEmail(message as never), true);
  assert.equal(extractTaiwanNiaVerificationCode(message), "827461");
});

test("extracts a code from a raw base64 MIME text part", () => {
  const raw = [
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from("<p>驗證碼：<strong>16VqKVSjOmSkGg</strong></p>", "utf8").toString("base64"),
  ].join("\r\n");
  const message = { from_addr: "notice@immigration.gov.tw", subject: "驗證碼", text: raw, html: null };
  assert.equal(isTaiwanNiaVerificationEmail(message as never), true);
  assert.equal(extractTaiwanNiaVerificationCode(message), "16VqKVSjOmSkGg");
});
