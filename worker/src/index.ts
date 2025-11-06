import { Router } from 'itty-router';
import { customAlphabet } from 'nanoid';
import { BlobWriter, ZipReader, ZipWriter, Uint8ArrayReader, Uint8ArrayWriter } from '@zip.js/zip.js';
import { z } from 'zod';

type D1Result<T> = T & Record<string, unknown>;

interface Env {
  FABRIC_DB: D1Database;
  FABRIC_ASSETS: R2Bucket;
  FABRIC_TOKEN?: string;
  FABRIC_MAX_UPLOAD_MB?: string;
}

interface AuthContext {
  token: string;
  tokenHash: string;
}

interface SessionRow {
  id: string;
  app_name: string;
  token_id: string;
  status: string;
  metadata: string | null;
  created_at: string;
  updated_at: string;
}

interface AssetRow {
  session_id: string;
  object_key: string;
  filename: string;
  content_type: string | null;
  size: number;
  checksum: string | null;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Requested-With',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const generateSessionId = customAlphabet('23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz', 20);

const createSessionSchema = z.object({
  appName: z.string().min(1).max(128),
  metadata: z.record(z.any()).optional(),
});

const logsSchema = z.object({
  entries: z
    .array(
      z.object({
        level: z.string().min(1).max(32).optional(),
        message: z.string().min(1),
        context: z.any().optional(),
      })
    )
    .min(1),
});

const router = Router();

router.options('*', () => new Response(null, { status: 204, headers: CORS_HEADERS }));

router.get(
  '/health',
  () =>
    jsonResponse({
      status: 'ok',
      timestamp: new Date().toISOString(),
    })
);

router.post('/sessions', withErrorHandling(withAuth(async (request, env, _ctx, auth) => {
  const body = await parseJson(request);
  const parsed = createSessionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, 'Invalid payload', parsed.error.flatten());
  }

  const { appName, metadata } = parsed.data;
  const metadataString = metadata ? JSON.stringify(metadata) : null;
  const sessionId = generateSessionId();

  await env.FABRIC_DB.prepare(
    `INSERT INTO sessions (id, app_name, token_id, metadata) VALUES (?1, ?2, ?3, ?4)`
  )
    .bind(sessionId, appName, auth.tokenHash, metadataString)
    .run();

  return jsonResponse({ sessionId }, 201);
})));

router.get('/sessions', withErrorHandling(withAuth(async (request, env, _ctx, auth) => {
  const url = new URL(request.url);
  const appNameParam = url.searchParams.get('appName');
  const filterAppName =
    appNameParam && appNameParam.trim().toLowerCase() !== 'all' ? appNameParam.trim() : null;

  const statement = filterAppName
    ? env.FABRIC_DB.prepare(
        `SELECT id, app_name, status, metadata, created_at, updated_at
         FROM sessions
         WHERE token_id = ?1 AND app_name = ?2
         ORDER BY updated_at DESC`
      ).bind(auth.tokenHash, filterAppName)
    : env.FABRIC_DB.prepare(
        `SELECT id, app_name, status, metadata, created_at, updated_at
         FROM sessions
         WHERE token_id = ?1
         ORDER BY updated_at DESC`
      ).bind(auth.tokenHash);

  const rows = await statement.all();

  return jsonResponse({
    sessions:
      rows.results?.map((row: any) => ({
        sessionId: row.id,
        appName: row.app_name,
        metadata: row.metadata ? tryParseJson(row.metadata) : null,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })) ?? [],
  });
})));

router.post('/sessions/:sessionId/logs', withErrorHandling(withAuth(async (request, env, _ctx, auth) => {
  const params = (request as any).params as { sessionId?: string };
  const sessionId = params?.sessionId;
  if (!sessionId) {
    return jsonError(400, 'Missing session id');
  }

  const session = await loadSession(env, sessionId, auth.tokenHash);
  if (!session) {
    return jsonError(404, 'Session not found');
  }

  const body = await parseJson(request);
  const parsed = logsSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, 'Invalid payload', parsed.error.flatten());
  }

  const entries = parsed.data.entries;
  const nextSequenceRow = (await env.FABRIC_DB.prepare(
    `SELECT COALESCE(MAX(sequence), 0) AS max_sequence FROM logs WHERE session_id = ?1`
  )
    .bind(sessionId)
    .first<D1Result<{ max_sequence: number }>>()) ?? { max_sequence: 0 };

  let sequence = Number(nextSequenceRow.max_sequence ?? 0) + 1;
  const statements = entries.map((entry) => {
    const level = entry.level ?? 'info';
    const context = entry.context === undefined ? null : JSON.stringify(entry.context);
    const stmt = env.FABRIC_DB.prepare(
      `INSERT INTO logs (session_id, sequence, level, message, context) VALUES (?1, ?2, ?3, ?4, ?5)`
    ).bind(sessionId, sequence, level, entry.message, context);
    sequence += 1;
    return stmt;
  });

  if (statements.length > 0) {
    await env.FABRIC_DB.batch(statements);
    await touchSession(env, sessionId);
  }

  return jsonResponse({ inserted: statements.length });
})));

router.get('/sessions/:sessionId/logs', withErrorHandling(withAuth(async (request, env, _ctx, auth) => {
  const params = (request as any).params as { sessionId?: string };
  const sessionId = params?.sessionId;
  if (!sessionId) {
    return jsonError(400, 'Missing session id');
  }

  const session = await loadSession(env, sessionId, auth.tokenHash);
  if (!session) {
    return jsonError(404, 'Session not found');
  }

  const rows = await env.FABRIC_DB.prepare(
    `SELECT sequence, level, message, context, created_at FROM logs WHERE session_id = ?1 ORDER BY sequence ASC`
  )
    .bind(sessionId)
    .all();

  return jsonResponse({
    session: summarizeSession(session),
    entries: rows.results?.map((row: any) => ({
      sequence: row.sequence,
      level: row.level,
      message: row.message,
      context: row.context ? tryParseJson(row.context) : null,
      createdAt: row.created_at,
    })) ?? [],
  });
})));

router.post('/sessions/:sessionId/assets', withErrorHandling(withAuth(async (request, env, _ctx, auth) => {
  const params = (request as any).params as { sessionId?: string };
  const sessionId = params?.sessionId;
  if (!sessionId) {
    return jsonError(400, 'Missing session id');
  }

  if (!env.FABRIC_ASSETS) {
    console.error('FABRIC_ASSETS binding missing');
    return jsonError(500, 'Asset storage unavailable');
  }

  if (!env.FABRIC_DB) {
    console.error('FABRIC_DB binding missing');
    return jsonError(500, 'Database unavailable');
  }

  const session = await loadSession(env, sessionId, auth.tokenHash);
  if (!session) {
    return jsonError(404, 'Session not found');
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/zip')) {
    return jsonError(415, 'Expected application/zip payload');
  }

  const uploadLimitBytes = getUploadLimitBytes(env);
  const payload = await request.arrayBuffer();
  if (payload.byteLength > uploadLimitBytes) {
    return jsonError(413, `Payload too large (>${(uploadLimitBytes / (1024 * 1024)).toFixed(0)} MiB)`);
  }

  const reader = new ZipReader(new Uint8ArrayReader(new Uint8Array(payload)));
  const storedAssets: AssetRow[] = [];

  try {
    const entries = await reader.getEntries();
    if (!entries || entries.length === 0) {
      return jsonError(400, 'Zip archive contained no files');
    }

    for (const entry of entries) {
      if (entry.directory) {
        continue;
      }

      const sanitisedName = sanitisePath(entry.filename);
      if (!sanitisedName) {
        return jsonError(400, `Unsupported entry path: ${entry.filename}`);
      }

      const writer = new Uint8ArrayWriter();
      const bytes = await entry.getData(writer);
      const objectKey = `sessions/${sessionId}/${sanitisedName}`;
      const content = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      const contentType = guessContentType(sanitisedName) ?? 'application/octet-stream';
      const checksum = await sha256Hex(bytes);

      try {
        await env.FABRIC_ASSETS.put(objectKey, content, {
          httpMetadata: { contentType },
          customMetadata: {
            sessionId,
            filename: sanitisedName,
            checksum,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('R2 upload failed', { sessionId, sanitisedName, message });
        return jsonError(500, 'Failed to store asset', { filename: sanitisedName });
      }

      storedAssets.push({
        session_id: sessionId,
        object_key: objectKey,
        filename: sanitisedName,
        content_type: contentType,
        size: bytes.byteLength,
        checksum,
      });
    }
  } finally {
    await reader.close();
  }

  if (storedAssets.length === 0) {
    return jsonError(400, 'Zip archive contained no files');
  }

  const statements = storedAssets.map((asset) =>
    env.FABRIC_DB.prepare(
      `INSERT INTO assets (session_id, object_key, filename, content_type, size, checksum)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT(session_id, filename) DO UPDATE SET object_key = excluded.object_key, content_type = excluded.content_type, size = excluded.size, checksum = excluded.checksum`
    ).bind(
      asset.session_id,
      asset.object_key,
      asset.filename,
      asset.content_type,
      asset.size,
      asset.checksum
    )
  );

  try {
    await env.FABRIC_DB.batch(statements);
    await touchSession(env, sessionId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('D1 asset metadata write failed', { sessionId, message });
    return jsonError(500, 'Failed to persist asset metadata');
  }

  return jsonResponse({ stored: storedAssets.length });
})));

router.get('/sessions/:sessionId/assets', withErrorHandling(withAuth(async (request, env, _ctx, auth) => {
  const params = (request as any).params as { sessionId?: string };
  const sessionId = params?.sessionId;
  if (!sessionId) {
    return jsonError(400, 'Missing session id');
  }

  const session = await loadSession(env, sessionId, auth.tokenHash);
  if (!session) {
    return jsonError(404, 'Session not found');
  }

  const rows = await env.FABRIC_DB.prepare(
    `SELECT filename, object_key, content_type, size, checksum, created_at FROM assets WHERE session_id = ?1 ORDER BY filename`
  )
    .bind(sessionId)
    .all();

  return jsonResponse({
    session: summarizeSession(session),
    assets: rows.results?.map((row: any) => ({
      filename: row.filename,
      objectKey: row.object_key,
      contentType: row.content_type,
      size: row.size,
      checksum: row.checksum,
      createdAt: row.created_at,
      downloadUrl: `/sessions/${sessionId}/assets/${encodeURIComponent(row.filename)}`,
    })) ?? [],
  });
})));

router.get('/sessions/:sessionId/assets/archive', withErrorHandling(withAuth(async (request, env, _ctx, auth) => {
  const params = (request as any).params as { sessionId?: string };
  const sessionId = params?.sessionId;
  if (!sessionId) {
    return jsonError(400, 'Missing session id');
  }

  if (!env.FABRIC_ASSETS) {
    console.error('FABRIC_ASSETS binding missing');
    return jsonError(500, 'Asset storage unavailable');
  }

  const session = await loadSession(env, sessionId, auth.tokenHash);
  if (!session) {
    return jsonError(404, 'Session not found');
  }

  const rows = await env.FABRIC_DB.prepare(
    `SELECT filename, object_key FROM assets WHERE session_id = ?1 ORDER BY filename`
  )
    .bind(sessionId)
    .all();

  const assetRows = rows.results ?? [];
  if (assetRows.length === 0) {
    return jsonError(404, 'No assets found for session');
  }

  const blobWriter = new BlobWriter('application/zip');
  const zipWriter = new ZipWriter(blobWriter);

  try {
    for (const row of assetRows) {
      const object = await env.FABRIC_ASSETS.get(row.object_key);
      if (!object) {
        console.error('Asset missing in R2', { sessionId, objectKey: row.object_key });
        return jsonError(500, 'Asset storage inconsistent');
      }

      const arrayBuffer = await object.arrayBuffer();
      await zipWriter.add(row.filename, new Uint8ArrayReader(new Uint8Array(arrayBuffer)));
    }
  } finally {
    await zipWriter.close();
  }

  const archive = await blobWriter.getData();
  const headers = new Headers({
    ...CORS_HEADERS,
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="${encodeURIComponent(sessionId)}.zip"`,
  });

  return new Response(archive, { status: 200, headers });
})));

router.get('/sessions/:sessionId/assets/:assetName+', withErrorHandling(withAuth(async (request, env, _ctx, auth) => {
  const params = (request as any).params as { sessionId?: string; assetName?: string };
  const sessionId = params?.sessionId;
  const assetName = params?.assetName;
  if (!sessionId || !assetName) {
    return jsonError(400, 'Missing session id or asset name');
  }

  const session = await loadSession(env, sessionId, auth.tokenHash);
  if (!session) {
    return jsonError(404, 'Session not found');
  }

  const sanitisedName = sanitisePath(assetName);
  if (!sanitisedName) {
    return jsonError(400, 'Invalid asset name');
  }

  const objectKey = `sessions/${sessionId}/${sanitisedName}`;
  const asset = await env.FABRIC_ASSETS.get(objectKey);
  if (!asset) {
    return jsonError(404, 'Asset not found');
  }

  const headers = new Headers({ ...CORS_HEADERS });
  if (asset.httpMetadata?.contentType) {
    headers.set('Content-Type', asset.httpMetadata.contentType);
  }
  if (asset.httpMetadata?.contentDisposition) {
    headers.set('Content-Disposition', asset.httpMetadata.contentDisposition);
  } else {
    headers.set('Content-Disposition', `inline; filename="${encodeURIComponent(sanitisedName)}"`);
  }
  if (asset.range) {
    headers.set('Content-Range', asset.range);
  }
  if (asset.size !== undefined) {
    headers.set('Content-Length', asset.size.toString());
  }
  if (asset.etag) {
    headers.set('ETag', asset.etag);
  }

  return new Response(asset.body, { status: 200, headers });
})));

router.get('/sessions/:sessionId', withErrorHandling(withAuth(async (request, env, _ctx, auth) => {
  const params = (request as any).params as { sessionId?: string };
  const sessionId = params?.sessionId;
  if (!sessionId) {
    return jsonError(400, 'Missing session id');
  }

  const session = await loadSession(env, sessionId, auth.tokenHash);
  if (!session) {
    return jsonError(404, 'Session not found');
  }

  const counts = await env.FABRIC_DB.prepare(
    `SELECT
        (SELECT COUNT(1) FROM logs WHERE session_id = ?1) AS log_count,
        (SELECT COUNT(1) FROM assets WHERE session_id = ?1) AS asset_count
     `
  )
    .bind(sessionId)
    .first<D1Result<{ log_count: number; asset_count: number }>>();

  return jsonResponse({
    session: summarizeSession(session),
    metrics: {
      logCount: Number(counts?.log_count ?? 0),
      assetCount: Number(counts?.asset_count ?? 0),
    },
  });
})));

router.all('*', () => jsonError(404, 'Not found'));

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => router.handle(request, env, ctx),
};

async function authenticate(request: Request, env: Env): Promise<AuthContext | Response> {
  const token = extractToken(request);
  if (!token) {
    return jsonError(401, 'Missing Authorization token');
  }

  const configuredToken = env.FABRIC_TOKEN?.trim();
  if (!configuredToken) {
    console.error('FABRIC_TOKEN secret is not configured');
    return jsonError(500, 'Token configuration invalid');
  }

  if (token !== configuredToken) {
    return jsonError(403, 'Invalid token');
  }

  const tokenHash = await sha256Hex(token);
  return { token, tokenHash };
}

function withAuth<
  Handler extends (
    request: Request,
    env: Env,
    ctx: ExecutionContext,
    auth: AuthContext
  ) => Promise<Response>
>(handler: Handler) {
  return async (request: Request, env: Env, ctx: ExecutionContext): Promise<Response> => {
    const auth = await authenticate(request, env);
    if (auth instanceof Response) {
      return auth;
    }
    return handler(request, env, ctx, auth);
  };
}

function withErrorHandling<
  Handler extends (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response>
>(handler: Handler) {
  return async (request: Request, env: Env, ctx: ExecutionContext): Promise<Response> => {
    try {
      const response = await handler(request, env, ctx);
      return applyCors(response);
    } catch (error) {
      console.error('Unhandled error', error);
      return jsonError(500, 'Internal Server Error');
    }
  };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

function applyCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    if (!headers.has(key)) {
      headers.set(key, value);
    }
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function jsonError(status: number, message: string, details?: unknown): Response {
  return jsonResponse({ error: message, details }, status);
}

async function loadSession(env: Env, sessionId: string, expectedTokenHash: string): Promise<SessionRow | null> {
  const session = await env.FABRIC_DB.prepare(
    `SELECT id, app_name, token_id, status, metadata, created_at, updated_at FROM sessions WHERE id = ?1`
  )
    .bind(sessionId)
    .first<SessionRow>();

  if (!session) {
    return null;
  }

  if (session.token_id !== expectedTokenHash) {
    return null;
  }

  return session;
}

async function touchSession(env: Env, sessionId: string) {
  await env.FABRIC_DB.prepare(
    `UPDATE sessions SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?1`
  )
    .bind(sessionId)
    .run();
}

function summarizeSession(session: SessionRow) {
  return {
    id: session.id,
    appName: session.app_name,
    status: session.status,
    metadata: session.metadata ? tryParseJson(session.metadata) : null,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
  };
}

function tryParseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch (_error) {
    return value;
  }
}

async function parseJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch (_error) {
    return null;
  }
}

function extractToken(request: Request): string | null {
  const header = request.headers.get('Authorization');
  if (header && header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim();
  }
  const token = request.headers.get('x-fabric-token');
  return token ? token.trim() : null;
}

function getUploadLimitBytes(env: Env): number {
  const raw = env.FABRIC_MAX_UPLOAD_MB;
  const fallback = 100;
  if (!raw) {
    return fallback * 1024 * 1024;
  }
  const numeric = Number(raw);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallback * 1024 * 1024;
  }
  return numeric * 1024 * 1024;
}

function sanitisePath(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const normalised = trimmed.replace(/\\/g, '/');
  if (normalised.includes('..') || normalised.startsWith('/')) {
    return null;
  }
  const collapsed = normalised.replace(/^\.\/+/, '').replace(/\/+/g, '/');
  return collapsed.endsWith('/') ? collapsed.slice(0, -1) : collapsed;
}

function guessContentType(filename: string): string | null {
  const extension = filename.toLowerCase().split('.').pop();
  if (!extension) {
    return null;
  }

  switch (extension) {
    case 'txt':
      return 'text/plain';
    case 'json':
      return 'application/json';
    case 'csv':
      return 'text/csv';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'html':
      return 'text/html';
    case 'htm':
      return 'text/html';
    case 'pdf':
      return 'application/pdf';
    case 'zip':
      return 'application/zip';
    case 'gz':
      return 'application/gzip';
    case 'md':
      return 'text/markdown';
    case 'mp4':
      return 'video/mp4';
    case 'mov':
      return 'video/quicktime';
    case 'mp3':
      return 'audio/mpeg';
    default:
      return 'application/octet-stream';
  }
}

async function sha256Hex(input: string | ArrayBuffer | Uint8Array): Promise<string> {
  let buffer: ArrayBuffer;
  if (typeof input === 'string') {
    buffer = new TextEncoder().encode(input).buffer;
  } else if (input instanceof Uint8Array) {
    buffer = input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
  } else {
    buffer = input;
  }

  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
