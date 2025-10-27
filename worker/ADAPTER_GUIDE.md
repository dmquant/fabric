# Fabric Adapter How-To

This guide explains how client apps can integrate with the Fabric Worker by implementing a small "adapter" layer. The adapter is responsible for authenticating with the Worker, creating a session, streaming logs, and uploading result artifacts.

## Prerequisites
- Environment variables available to your app:
  - `FABRIC_BASE_URL` — the HTTPS endpoint of the deployed Worker.
  - `FABRIC_TOKEN` — the shared bearer token configured in the Worker secret. Keep this value out of source control.
- Ability to create ZIP archives in memory (or on disk) for result assets.
- HTTP client capable of sending JSON and binary payloads with custom headers.

## Integration Steps

### 1. Create a Session
Send a `POST /sessions` request with your app name and any metadata required to reproduce the run.

```http
POST /sessions HTTP/1.1
Authorization: Bearer <FABRIC_TOKEN>
Content-Type: application/json

{
  "appName": "gemini-analyst",
  "metadata": {
    "runId": "<uuid>",
    "inputSummary": "Summarize Q3 earnings transcripts for Fortune 100"
  }
}
```

Successful responses return HTTP 201 with `{ "sessionId": "..." }`. Persist the `sessionId`; all log and asset uploads reference it.

### 2. Stream Logs While Running
Use `POST /sessions/:sessionId/logs` to append messages. The Worker assigns `sequence` numbers; you only provide the content.

```json
{
  "entries": [
    {
      "level": "info",
      "message": "Started ingestion",
      "context": { "batch": 1 }
    },
    {
      "level": "warn",
      "message": "Two transcripts missing Q&A sections",
      "context": { "files": ["ACME_Q3", "GLOBAL_TECH_Q3"] }
    }
  ]
}
```

Tips:
- Send logs in small batches to avoid large payloads.
- Wrap calls in retries with backoff; the endpoint is idempotent as long as you avoid replaying the same entries on failure.

### 3. Upload Result Assets
Aggregate any artifacts (reports, CSVs, screenshots, etc.) into a ZIP archive. POST the binary payload to `/sessions/:sessionId/assets` with `Content-Type: application/zip`.

Example using Node.js:
```ts
import JSZip from 'jszip';
import { request } from 'undici';

async function uploadAssets(sessionId: string) {
  const zip = new JSZip();
  zip.file('summary.json', JSON.stringify({ sessionId, score: 0.92 }, null, 2));
  zip.file('charts/top_companies.png', await readFile('tmp/top_companies.png'));

  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

  await request(`${process.env.FABRIC_BASE_URL}/sessions/${sessionId}/assets`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.FABRIC_TOKEN}`,
      'Content-Type': 'application/zip',
      'Content-Length': buffer.length.toString(),
    },
    body: buffer,
  });
}
```

The Worker extracts each file into R2 using a sanitized path under `sessions/<sessionId>/...` and records metadata in D1. Re-uploading the same filename overwrites the previous object for that session.

### 4. (Optional) Query Session State
You can read back stored data to confirm ingest or power dashboards:
- `GET /sessions/:sessionId` — metadata plus counts.
- `GET /sessions/:sessionId/logs` — complete log history.
- `GET /sessions/:sessionId/assets` — asset list with signed Worker URLs.

### 5. Handle Errors Gracefully
- HTTP `401/403`: token missing or incorrect. Ensure the adapter injects `Authorization: Bearer <token>`.
- HTTP `413`: payload too large; the Worker enforces `FABRIC_MAX_UPLOAD_MB` (default 100 MiB).
- HTTP `500` with details: inspect the JSON body; the Worker returns specific messages such as `"Asset storage unavailable"` or `"Failed to persist asset metadata"` to help diagnose infrastructure issues.

## Suggested Adapter Responsibilities
- **Configuration**: Load `FABRIC_BASE_URL` and `FABRIC_TOKEN` from environment variables or secret store.
- **Lifecycle**: Provide helper functions (`createSession`, `appendLogs`, `uploadAssets`, `getSessionSummary`).
- **Retry & Telemetry**: Implement retry policies with exponential backoff and log failures to your app's observability pipeline.
- **Security**: Avoid logging the bearer token; rotate it periodically via `wrangler secret put FABRIC_TOKEN`.

By encapsulating these steps in a reusable module, each new Fabric app can onboard quickly while adhering to the shared Worker contract.


[Prompt]
let's add download module:
can download all assets including execution logs, markdown files, code files, images and voices generated;
there are two modes for downloading:local mode and cloudflare mode;
for local mode, user can download all assets in a zip file once click the download button;
for cloudflare mode, user can setting worker url and token by input box, and all apis and workflows refer to following readme:
Fabric Adapter How-To
This guide explains how client apps can integrate with the Fabric Worker by implementing a small "adapter" layer. The adapter is responsible for authenticating with the Worker, creating a session, streaming logs, and uploading result artifacts.
Prerequisites
Environment variables available to your app:
FABRIC_BASE_URL — the HTTPS endpoint of the deployed Worker.
FABRIC_TOKEN — the shared bearer token configured in the Worker secret. Keep this value out of source control.
Ability to create ZIP archives in memory (or on disk) for result assets.
HTTP client capable of sending JSON and binary payloads with custom headers.
Integration Steps
1. Create a Session
Send a POST /sessions request with your app name and any metadata required to reproduce the run.
code
Http
POST /sessions HTTP/1.1
Authorization: Bearer <FABRIC_TOKEN>
Content-Type: application/json

{
  "appName": "<APP_NAME>",
  "metadata": {
    "runId": "<uuid>",
    "inputSummary": "Summarize Q3 earnings transcripts for Fortune 100"
  }
}
Successful responses return HTTP 201 with { "sessionId": "..." }. Persist the sessionId; all log and asset uploads reference it.
2. Stream Logs While Running
Use POST /sessions/:sessionId/logs to append messages. The Worker assigns sequence numbers; you only provide the content.
code
JSON
{
  "entries": [
    {
      "level": "info",
      "message": "Started ingestion",
      "context": { "batch": 1 }
    },
    {
      "level": "warn",
      "message": "Two transcripts missing Q&A sections",
      "context": { "files": ["ACME_Q3", "GLOBAL_TECH_Q3"] }
    }
  ]
}
Tips:
Send logs in small batches to avoid large payloads.
Wrap calls in retries with backoff; the endpoint is idempotent as long as you avoid replaying the same entries on failure.
3. Upload Result Assets
Aggregate any artifacts (reports, CSVs, screenshots, etc.) into a ZIP archive. POST the binary payload to /sessions/:sessionId/assets with Content-Type: application/zip.
Example using Node.js:
code
Ts
import JSZip from 'jszip';
import { request } from 'undici';

async function uploadAssets(sessionId: string) {
  const zip = new JSZip();
  zip.file('summary.json', JSON.stringify({ sessionId, score: 0.92 }, null, 2));
  zip.file('charts/top_companies.png', await readFile('tmp/top_companies.png'));

  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

  await request(`${process.env.FABRIC_BASE_URL}/sessions/${sessionId}/assets`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.FABRIC_TOKEN}`,
      'Content-Type': 'application/zip',
      'Content-Length': buffer.length.toString(),
    },
    body: buffer,
  });
}
The Worker extracts each file into R2 using a sanitized path under sessions/<sessionId>/... and records metadata in D1. Re-uploading the same filename overwrites the previous object for that session.
4. (Optional) Query Session State
You can read back stored data to confirm ingest or power dashboards:
GET /sessions/:sessionId — metadata plus counts.
GET /sessions/:sessionId/logs — complete log history.
GET /sessions/:sessionId/assets — asset list with signed Worker URLs.
5. Handle Errors Gracefully
HTTP 401/403: token missing or incorrect. Ensure the adapter injects Authorization: Bearer <token>.
HTTP 413: payload too large; the Worker enforces FABRIC_MAX_UPLOAD_MB (default 100 MiB).
HTTP 500 with details: inspect the JSON body; the Worker returns specific messages such as "Asset storage unavailable" or "Failed to persist asset metadata" to help diagnose infrastructure issues.
Suggested Adapter Responsibilities
Configuration: Load FABRIC_BASE_URL and FABRIC_TOKEN from environment variables or secret store.
Lifecycle: Provide helper functions (createSession, appendLogs, uploadAssets, getSessionSummary).
Retry & Telemetry: Implement retry policies with exponential backoff and log failures to your app's observability pipeline.