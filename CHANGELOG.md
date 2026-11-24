# Changelog — EmpCoKit

All notable changes to this project will be documented in this file.

## [0.5.0] - 2026-11-24 — Public MIT Open-Source Release (`v0.5.0`)
### Added
- MIT [`LICENSE`](LICENSE), [`.github/workflows/ci.yml`](.github/workflows/ci.yml), six verified Chrome UI captures under [`docs/screenshots/`](docs/screenshots/), and embedded Visual Showcase in [`README.md`](README.md).
- Sanitized public MIT release published on GitHub (`manea/empcokit` `v0.5.0`).

## [0.4.0] - 2026-11-24
### Added
- Full real-browser verification via Playwright Chrome E2E (`playwright.config.ts`, `tests/e2e/empcokit.spec.ts`) across desktop (`1280x800`) and mobile (`390x844`) viewports in both `EN LTR / Nordic Linen` and `AR RTL / Charcoal Ledger`.
- End-to-end verification of `Directive (EU) 2024/825` claim remediation, `Regulation (EU) 2025/1960` 2-year notice & `GARAN` durability verification, atomic `EMP-YYYY-0001` sealing, `UTF-8 BOM` CSV download (`EF BB BF` byte verification), and shareable `/r/:code` routing.
- `$0` production deployment packaging (`wrangler.jsonc`, `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `deploy/*` with `backup-sqlite.sh` `VACUUM INTO` & hardened `Caddyfile`, `README.md`, and `launch/DEPLOY-AND-SHARE.md`).

### Fixed
- Preserved exact `EF BB BF` UTF-8 BOM prefix on `/api/dossiers/:id/export.csv` downloads in `src/lib/api.ts` using binary `arrayBuffer()`.
- Shortened SVG preview subtitle copy in `EmpcoNoticeAndRiskSvg.tsx`, improved narrow-viewport wrapping on the Readiness KPI card (`flex-wrap`), and set `dir="auto"` on marketing copy inputs so English text renders LTR inside RTL Arabic viewports.

## [0.3.0] - 2026-11-24
### Added
- Bilingual (`EN LTR / AR RTL`) dual-theme (`Nordic Linen` light / `Charcoal Ledger` dark) React 19 + Vite + Tailwind v4 web application (`src/App.tsx`, `src/lib/*`, `src/components/*`).
- Dual operating mode supporting live `SQLite WAL` API persistence (`/api/health` detection) or zero-cost static browser `localStorage` offline mode.
- Interactive live SVG preview (`EmpcoNoticeAndRiskSvg.tsx`) for Regulation `(EU) 2025/1960` 2-year legal guarantee notice & conditional `GARAN` durability label (`>2 years`), marketing copy scanner (`ClaimsAndLabelPanel.tsx`), 6 operational controls (`GuaranteeAndControlsPanel.tsx`), SKU catalog CSV auditor & `UTF-8 BOM` exporter (`ProductCatalogCsvPanel.tsx`), `/r/:slugOrCode` shareable report viewer, and print-ready `A4 PDF` executive summary (`DossierPreviewAndPrint.tsx`).

## [0.2.0] - 2026-11-24
### Added
- Zero-dependency Node 22 HTTP/API server (`server/db.mjs`, `server/app.mjs`, `server/app.d.mts`, `server/index.mjs`) with `node:sqlite WAL` persistence (`empcokit.sqlite`) and `BASE_PATH=/empcokit` injection (`window.__EMPCOKIT_BASE__`).
- Stateless analysis endpoints (`POST /api/scan-claims`, `POST /api/audit-csv`, `POST /api/assess`) and full CRUD + lifecycle routes (`/api/profiles`, `/api/assessments`, `/api/dossiers`, `/duplicate`, `/finalize|lock` atomic `EMP-YYYY-0001` counter via `BEGIN IMMEDIATE` + `409` immutability guards).
- Bilingual Markdown readiness dossier generator (`src/core/briefBuilder.ts`), CWE-1236 formula-safe `UTF-8 BOM` CSV exports, executive summaries, public share views (`/api/public/reports/:slugOrCode`), `413` body limits, and `429` write throttling.
- Added `tests/unit/empcoServer.test.ts` validating health/readyz, `BASE_PATH`, CSV formula safety, WAL locking, exports, and abuse limits.

## [0.1.0] - 2026-11-24
### Added
- Zero-dependency EU EmpCo (`Directive (EU) 2024/825`) & Harmonised Consumer Guarantee (`Regulation (EU) 2025/1960`) deterministic core engine (`src/core/*`):
  - Greenwashing claims scanner enforcing UCPD Annex I points 4a (generic eco claims ban without recognized excellence proof), 4c (absolute ban on carbon-offset product neutrality claims), 2a (self-certified sustainability label ban), and Art. 6(2)(d) verified future commitments.
  - Consumer guarantee evaluator enforcing the mandatory 2-year statutory legal guarantee notice and conditional whole-product `GARAN` commercial durability label (`> 2 years`) effective `2026-09-27`.
  - SKU catalog CSV auditor with CWE-1236 spreadsheet formula escaping and `UTF-8 BOM` export.
  - Canonical `SHA-256` dossier digest (`Web Crypto`) and three presets with explicit non-regulator / non-legal disclaimer.
