import assert from "node:assert/strict";
import test from "node:test";
import { extractJpVjwVerificationMessage } from "../verification";

test("extracts the official six-digit VJW verification code without requiring a link", () => {
  assert.deepEqual(extractJpVjwVerificationMessage({
    subject: "Visit Japan Web 确认码",
    text: "您的验证码为 123456。有效期内请输入。",
  }), { code: "123456" });
});

test("prefers the labelled code and retains an official verification link when present", () => {
  assert.deepEqual(extractJpVjwVerificationMessage({
    subject: "Confirmation code 654321",
    html: '<a href="https://www.vjw.digital.go.jp/main/">Visit Japan Web</a><p>202608</p>',
  }), {
    url: "https://www.vjw.digital.go.jp/main/",
    code: "654321",
  });
});
