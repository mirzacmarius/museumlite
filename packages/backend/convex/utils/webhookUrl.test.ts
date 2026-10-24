import { describe, expect, test } from "vitest";
import {
  isPrivateWebhookHost,
  isPublicHttpsWebhookUrl,
} from "./webhookDelivery";

describe("isPublicHttpsWebhookUrl", () => {
  test("accepts HTTPS endpoints on public hosts", () => {
    for (const url of [
      "https://example.com/hook",
      "https://hooks.example.org:8443/a?b=c",
      "https://8.8.8.8/hook",
      "https://11.0.0.1/hook",
      "https://172.32.0.1/hook",
      "https://[2606:4700:4700::1111]/hook",
    ]) {
      expect(isPublicHttpsWebhookUrl(url), url).toBe(true);
    }
  });

  test("refuses other schemes, credentials, and private or internal hosts", () => {
    for (const url of [
      "http://example.com/hook",
      "https://user:secret@example.com/hook",
      "not a url",
      "https://",
      "https://localhost/hook",
      "https://LOCALHOST:8443/hook",
      "https://app.localhost/hook",
      "https://printer.local/hook",
      "https://vault.internal/hook",
      "https://intranet/hook",
      "https://127.0.0.1/hook",
      "https://127.1/hook",
      "https://2130706433/hook",
      "https://0.0.0.0/hook",
      "https://10.1.2.3/hook",
      "https://100.64.0.1/hook",
      "https://169.254.169.254/latest/meta-data",
      "https://172.16.0.9/hook",
      "https://172.31.255.254/hook",
      "https://192.168.1.10:8443/hook",
      "https://224.0.0.1/hook",
      "https://[::1]/hook",
      "https://[::]/hook",
      "https://[fd12:3456::1]/hook",
      "https://[fc00::1]/hook",
      "https://[fe80::1]/hook",
      "https://[::ffff:10.0.0.1]/hook",
      "https://[::ffff:c0a8:101]/hook",
    ]) {
      expect(isPublicHttpsWebhookUrl(url), url).toBe(false);
    }
  });

  test("isPrivateWebhookHost reads the host alone", () => {
    expect(isPrivateWebhookHost("example.com")).toBe(false);
    expect(isPrivateWebhookHost("ip6-localhost")).toBe(true);
    expect(isPrivateWebhookHost("db.home.arpa")).toBe(true);
    expect(isPrivateWebhookHost("[::ffff:808:808]")).toBe(false);
  });
});
