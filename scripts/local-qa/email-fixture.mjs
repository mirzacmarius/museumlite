#!/usr/bin/env node
/**
 * A loopback stand-in for the notification email provider, for local QA
 * only. It answers Resend-shaped requests and records them, with their plain
 * text, in .local-qa/email-fixture.jsonl; nothing is sent anywhere.
 *
 *   bun run qa:email-fixture                         listen on 127.0.0.1:3745
 *   EMAIL_FIXTURE_PORT=3755 bun run qa:email-fixture
 *   curl -X POST http://127.0.0.1:3745/mode -d refuse   accept | refuse | unavailable
 *
 * Point the local QA backend at it:
 *
 *   bun run convex:local -- env set NOTIFICATION_EMAIL_FIXTURE_URL=http://127.0.0.1:3745/emails
 */
import { appendFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { ensureStateDir, stateDir } from "./lib.mjs";

const port = Number(process.env.EMAIL_FIXTURE_PORT ?? 3745);
const logPath = join(stateDir, "email-fixture.jsonl");
const replies = {
  accept: (sequence) => [200, { id: `fixture-${sequence}` }],
  refuse: () => [
    422,
    { name: "validation_error", message: "The fixture refused the message" },
  ],
  unavailable: () => [
    503,
    { name: "service_unavailable", message: "The fixture is unavailable" },
  ],
};
let mode = "accept";
let sequence = 0;

function readBody(request) {
  return new Promise((resolve) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => resolve(body));
  });
}

function reply(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

ensureStateDir();
createServer(async (request, response) => {
  const body = await readBody(request);
  if (request.method === "POST" && request.url === "/mode") {
    const next = body.trim();
    if (!(next in replies)) {
      reply(response, 400, { error: `Unknown mode ${next}` });
      return;
    }
    mode = next;
    console.log(`mode: ${mode}`);
    reply(response, 200, { mode });
    return;
  }
  if (request.method !== "POST" || request.url !== "/emails") {
    reply(response, 404, { error: "Not found" });
    return;
  }
  sequence += 1;
  const [status, payload] = replies[mode](sequence);
  const email = JSON.parse(body);
  appendFileSync(
    logPath,
    `${JSON.stringify({
      receivedAt: new Date().toISOString(),
      idempotencyKey: request.headers["idempotency-key"],
      to: email.to,
      subject: email.subject,
      text: email.text,
      status,
    })}\n`,
  );
  console.log(`${status} ${email.subject} -> ${email.to}`);
  reply(response, status, payload);
}).listen(port, "127.0.0.1", () => {
  console.log(`✓ Email fixture listening on http://127.0.0.1:${port}/emails`);
});
