import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function makeError(message, code, statusCode) {
  const err = new Error(message);
  err.code = code;
  err.statusCode = statusCode;
  return err;
}

export function slugify(input, fallback = 'empco-entity') {
  const cleaned = String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}

function parseJsonSafe(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function openEmpcoDatabase(dataDir) {
  const resolvedDataDir = path.resolve(dataDir);
  fs.mkdirSync(resolvedDataDir, { recursive: true });

  const dbPath = path.join(resolvedDataDir, 'empcokit.sqlite');
  const db = new DatabaseSync(dbPath);

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS dossiers (
      id TEXT PRIMARY KEY,
      public_slug TEXT NOT NULL UNIQUE,
      dossier_code TEXT UNIQUE,
      status TEXT NOT NULL,
      readiness_status TEXT NOT NULL,
      dossier_json TEXT NOT NULL,
      view_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_dossiers_status ON dossiers(status);
    CREATE INDEX IF NOT EXISTS idx_dossiers_updated ON dossiers(updated_at DESC);

    CREATE TABLE IF NOT EXISTS organization_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      profile_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_profiles_updated ON organization_profiles(updated_at DESC);

    CREATE TABLE IF NOT EXISTS dossier_counters (
      year INTEGER PRIMARY KEY,
      last_seq INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS dossier_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dossier_id TEXT NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      actor TEXT NOT NULL,
      meta_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_dossier_events ON dossier_events(dossier_id, id DESC);
  `);

  function ensureUniqueSlug(desiredSlug, excludeId = null) {
    const base = slugify(desiredSlug, 'empco-entity');
    let candidate = base;
    let suffix = 2;
    const checkStmt = db.prepare('SELECT id FROM dossiers WHERE public_slug = ?');
    while (true) {
      const existing = checkStmt.get(candidate);
      if (!existing || (excludeId && existing.id === excludeId)) {
        return candidate;
      }
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
  }

  function insertEvent(dossierId, eventType, actor, meta = {}, createdAt = new Date().toISOString()) {
    db.prepare(
      'INSERT INTO dossier_events (dossier_id, event_type, actor, meta_json, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run(dossierId, eventType, actor, JSON.stringify(meta), createdAt);
  }

  function findDossierRowByKey(key) {
    return db
      .prepare('SELECT * FROM dossiers WHERE id = ? OR public_slug = ? OR dossier_code = ?')
      .get(key, key, key);
  }

  function hydrateBundle(row) {
    if (!row) return null;
    const dossier = parseJsonSafe(row.dossier_json, null);
    if (!dossier) return null;

    const events = db
      .prepare(
        'SELECT id, dossier_id, event_type, actor, meta_json, created_at FROM dossier_events WHERE dossier_id = ? ORDER BY id DESC LIMIT 30',
      )
      .all(dossier.id)
      .map((ev) => ({
        id: ev.id,
        dossierId: ev.dossier_id,
        eventType: ev.event_type,
        actor: ev.actor,
        meta: parseJsonSafe(ev.meta_json, {}),
        createdAt: ev.created_at,
      }));

    return {
      dossier: {
        ...dossier,
        viewCount: Number(row.view_count || 0),
      },
      status: row.status,
      slug: row.public_slug,
      viewCount: Number(row.view_count || 0),
      dossierEvents: events,
    };
  }

  function checkReady() {
    const row = db.prepare('SELECT 1 AS ok').get();
    return Number(row?.ok || 0) === 1;
  }

  function getStats() {
    const totalRow = db.prepare('SELECT COUNT(*) AS cnt FROM dossiers').get();
    const byStatusRows = db.prepare('SELECT status, COUNT(*) AS cnt FROM dossiers GROUP BY status').all();
    const profRow = db.prepare('SELECT COUNT(*) AS cnt FROM organization_profiles').get();
    let draftDossiers = 0;
    let lockedDossiers = 0;
    for (const row of byStatusRows) {
      if (row.status === 'draft') draftDossiers = Number(row.cnt || 0);
      if (row.status === 'locked') lockedDossiers = Number(row.cnt || 0);
    }
    return {
      totalDossiers: Number(totalRow?.cnt || 0),
      draftDossiers,
      lockedDossiers,
      profilesCount: Number(profRow?.cnt || 0),
    };
  }

  function listDossiers() {
    const rows = db
      .prepare(
        'SELECT id, public_slug, dossier_code, status, readiness_status, dossier_json, view_count, created_at, updated_at FROM dossiers ORDER BY updated_at DESC',
      )
      .all();

    return rows
      .map((row) => {
        const dossier = parseJsonSafe(row.dossier_json, null);
        if (!dossier) return null;
        return {
          id: row.id,
          slug: row.public_slug,
          dossierCode: row.dossier_code ?? (dossier.dossierCode || ''),
          status: row.status,
          readinessStatus: row.readiness_status,
          viewCount: Number(row.view_count || 0),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          dossier: {
            ...dossier,
            viewCount: Number(row.view_count || 0),
          },
        };
      })
      .filter((entry) => entry !== null);
  }

  function getDossierById(id) {
    const row = db.prepare('SELECT * FROM dossiers WHERE id = ?').get(id);
    return hydrateBundle(row);
  }

  function getDossierBySlugOrCode(slugOrCode, { incrementView = false } = {}) {
    const row = findDossierRowByKey(slugOrCode);
    if (!row) return null;
    if (incrementView) {
      db.prepare('UPDATE dossiers SET view_count = view_count + 1 WHERE id = ?').run(row.id);
      return getDossierById(row.id);
    }
    return hydrateBundle(row);
  }

  function createDossier(dossierInput, actor = 'empco-coordinator') {
    const now = dossierInput.createdAt || new Date().toISOString();
    const id =
      dossierInput.id || `emp-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
    const uniqueSlug = ensureUniqueSlug(
      dossierInput.slug || dossierInput.input?.organizationName || id,
      id,
    );
    const readinessStatus = dossierInput.result?.status || 'blocked';
    const dossier = {
      id,
      presetKey: dossierInput.presetKey || '',
      slug: uniqueSlug,
      dossierCode: '',
      status: 'draft',
      localeDefault: dossierInput.localeDefault === 'ar' ? 'ar' : 'en',
      createdAt: now,
      updatedAt: dossierInput.updatedAt || now,
      lockedAt: null,
      sha256Digest: null,
      viewCount: 0,
      input: dossierInput.input,
      result: dossierInput.result,
    };

    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(
        `INSERT INTO dossiers
         (id, public_slug, dossier_code, status, readiness_status, dossier_json, view_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      ).run(
        dossier.id,
        dossier.slug,
        null,
        'draft',
        readinessStatus,
        JSON.stringify(dossier),
        now,
        dossier.updatedAt,
      );

      insertEvent(
        dossier.id,
        'DOSSIER_CREATED',
        actor,
        {
          slug: dossier.slug,
          readinessStatus,
          readinessScore: dossier.result?.readinessScore ?? 0,
          maxTurnoverFineExposureEur: dossier.result?.maxTurnoverFineExposureEur ?? 0,
          genericClaimsBlocked: dossier.result?.claimsScan?.genericClaimsBlocked ?? 0,
          carbonOffsetClaimsBlocked: dossier.result?.claimsScan?.carbonOffsetClaimsBlocked ?? 0,
        },
        now,
      );
      db.exec('COMMIT');
      return getDossierById(dossier.id);
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // ignore rollback failure
      }
      throw err;
    }
  }

  function updateDossier(id, mutatorFn, actor = 'empco-coordinator', eventType = 'DOSSIER_UPDATED') {
    db.exec('BEGIN IMMEDIATE');
    try {
      const row = findDossierRowByKey(id);
      if (!row) {
        db.exec('ROLLBACK');
        return null;
      }
      const current = parseJsonSafe(row.dossier_json, null);
      if (!current) {
        db.exec('ROLLBACK');
        return null;
      }
      if (row.status === 'locked' || current.status === 'locked' || current.lockedAt) {
        throw makeError(
          'Sealed EmpCoKit dossier is immutable against modification.',
          'DOSSIER_LOCKED',
          409,
        );
      }

      const next = mutatorFn(current);
      if (!next) {
        db.exec('ROLLBACK');
        return null;
      }

      const uniqueSlug = ensureUniqueSlug(next.slug || current.slug, current.id);
      const now = new Date().toISOString();
      const readinessStatus = next.result?.status || row.readiness_status || 'blocked';
      const updated = {
        ...next,
        id: current.id,
        slug: uniqueSlug,
        dossierCode: '',
        status: 'draft',
        lockedAt: null,
        sha256Digest: null,
        createdAt: current.createdAt || row.created_at,
        updatedAt: now,
      };

      db.prepare(
        'UPDATE dossiers SET public_slug = ?, readiness_status = ?, dossier_json = ?, updated_at = ? WHERE id = ?',
      ).run(
        updated.slug,
        readinessStatus,
        JSON.stringify(updated),
        updated.updatedAt,
        current.id,
      );

      insertEvent(
        current.id,
        eventType,
        actor,
        {
          readinessStatus,
          readinessScore: updated.result?.readinessScore ?? 0,
          maxTurnoverFineExposureEur: updated.result?.maxTurnoverFineExposureEur ?? 0,
        },
        now,
      );
      db.exec('COMMIT');
      return getDossierById(current.id);
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // ignore rollback failure
      }
      throw err;
    }
  }

  function deleteDossier(id) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const row = findDossierRowByKey(id);
      if (!row) {
        db.exec('ROLLBACK');
        return { deleted: false };
      }
      if (row.status === 'locked') {
        throw makeError(
          'Locked EmpCoKit dossier cannot be deleted; duplicate it into a new editable draft instead.',
          'DOSSIER_LOCKED',
          409,
        );
      }
      db.prepare('DELETE FROM dossiers WHERE id = ?').run(row.id);
      db.exec('COMMIT');
      return { deleted: true, id: row.id };
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // ignore rollback failure
      }
      throw err;
    }
  }

  function duplicateDossier(id, actor = 'empco-coordinator') {
    const sourceBundle = getDossierById(id) || getDossierBySlugOrCode(id);
    if (!sourceBundle) return null;
    const src = sourceBundle.dossier;
    const now = new Date().toISOString();
    const suffix = crypto.randomBytes(2).toString('hex');
    const newId = `emp-${Date.now().toString(36)}-${suffix}`;
    const cloned = {
      ...src,
      id: newId,
      slug: `${slugify(src.slug || src.input?.organizationName, 'empco-entity')}-copy-${suffix}`,
      dossierCode: '',
      status: 'draft',
      lockedAt: null,
      sha256Digest: null,
      input: {
        ...src.input,
        organizationName: `${src.input.organizationName} (Copy)`,
      },
      createdAt: now,
      updatedAt: now,
    };
    return createDossier(cloned, actor);
  }

  function finalizeDossier(id, computeDigestSyncFn, actor = 'empco-coordinator') {
    db.exec('BEGIN IMMEDIATE');
    try {
      const row = findDossierRowByKey(id);
      if (!row) {
        db.exec('ROLLBACK');
        return null;
      }
      const current = parseJsonSafe(row.dossier_json, null);
      if (!current) {
        db.exec('ROLLBACK');
        return null;
      }
      if (row.status === 'locked' || current.status === 'locked' || current.lockedAt) {
        throw makeError('EmpCoKit readiness dossier is already finalized.', 'ALREADY_LOCKED', 409);
      }

      const now = new Date().toISOString();
      const year = new Date().getUTCFullYear();
      db.prepare(
        'INSERT INTO dossier_counters (year, last_seq) VALUES (?, 1) ON CONFLICT(year) DO UPDATE SET last_seq = last_seq + 1',
      ).run(year);
      const seqRow = db.prepare('SELECT last_seq FROM dossier_counters WHERE year = ?').get(year);
      const seq = Number(seqRow?.last_seq || 1);
      const dossierCode = `EMP-${year}-${String(seq).padStart(4, '0')}`;

      const canonicalText = current.result?.canonicalDossierText || '';
      const sha256Digest = computeDigestSyncFn(canonicalText);

      const lockedDossier = {
        ...current,
        dossierCode,
        status: 'locked',
        sha256Digest,
        lockedAt: now,
        updatedAt: now,
      };

      db.prepare(
        'UPDATE dossiers SET dossier_code = ?, status = ?, dossier_json = ?, updated_at = ? WHERE id = ?',
      ).run(dossierCode, 'locked', JSON.stringify(lockedDossier), now, current.id);

      insertEvent(current.id, 'DOSSIER_FINALIZED', actor, { dossierCode, sha256Digest }, now);

      db.exec('COMMIT');
      return getDossierById(current.id);
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // ignore rollback failure
      }
      throw err;
    }
  }

  function listProfiles() {
    return db
      .prepare(
        'SELECT id, name, profile_json, created_at, updated_at FROM organization_profiles ORDER BY updated_at DESC',
      )
      .all()
      .map((row) => ({
        id: row.id,
        name: row.name,
        profile: parseJsonSafe(row.profile_json, {}),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
  }

  function saveProfile(profileInput) {
    const now = new Date().toISOString();
    const id =
      profileInput.id || `prof-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;
    const organizationName =
      String(profileInput.organizationName || profileInput.name || 'EU B2C Trader')
        .trim()
        .slice(0, 160) || 'EU B2C Trader';
    const validScopes = new Set(['eu_b2c_online', 'eu_b2c_physical', 'eu_b2b_exempt']);
    const channelScope = validScopes.has(profileInput.channelScope)
      ? profileInput.channelScope
      : 'eu_b2c_online';
    const rawTurnover = Number(profileInput.annualEuTurnoverEur);
    const annualEuTurnoverEur =
      Number.isFinite(rawTurnover) && rawTurnover >= 0 ? Math.min(rawTurnover, 1_000_000_000_000) : 0;

    const profile = {
      organizationName,
      productOrStoreName: String(profileInput.productOrStoreName || 'EU Storefront')
        .trim()
        .slice(0, 200),
      channelScope,
      annualEuTurnoverEur,
      notes: String(profileInput.notes ?? '').trim().slice(0, 2000),
    };

    db.prepare(
      `INSERT INTO organization_profiles (id, name, profile_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, profile_json = excluded.profile_json, updated_at = excluded.updated_at`,
    ).run(id, organizationName, JSON.stringify(profile), now, now);

    const row = db
      .prepare('SELECT id, name, profile_json, created_at, updated_at FROM organization_profiles WHERE id = ?')
      .get(id);
    return {
      id: row.id,
      name: row.name,
      profile: parseJsonSafe(row.profile_json, profile),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function deleteProfile(id) {
    const info = db.prepare('DELETE FROM organization_profiles WHERE id = ?').run(id);
    return { deleted: info.changes > 0 };
  }

  return {
    dbPath,
    checkReady,
    getStats,
    listDossiers,
    getDossierById,
    getDossierBySlugOrCode,
    createDossier,
    updateDossier,
    deleteDossier,
    duplicateDossier,
    finalizeDossier,
    listProfiles,
    saveProfile,
    deleteProfile,
    close: () => db.close(),
  };
}
