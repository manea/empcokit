import { scanMarketingClaims } from './claimsScanner.ts';
import {
  EMPCO_EFFECTIVE_DATE,
  STATUTORY_LEGAL_GUARANTEE_YEARS,
} from './empcoCatalog.ts';
import type {
  ProductCsvAuditSummary,
  ProductCsvRowAudit,
  ReadinessStatus,
  SustainabilityLabelKind,
} from './types.ts';

function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function detectDelimiter(headerLine: string): string {
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semiCount = (headerLine.match(/;/g) || []).length;
  const tabCount = (headerLine.match(/\t/g) || []).length;
  if (tabCount > commaCount && tabCount >= semiCount) return '\t';
  if (semiCount > commaCount) return ';';
  return ',';
}

function parseBool(raw: string | undefined): boolean {
  const val = (raw ?? '').trim().toLowerCase();
  return val === 'true' || val === '1' || val === 'yes' || val === 'y';
}

function normalizeLabelKind(raw: string | undefined): SustainabilityLabelKind {
  const val = (raw ?? '').trim().toLowerCase();
  if (val === 'eu_ecolabel_public') return 'eu_ecolabel_public';
  if (val === 'third_party_certified') return 'third_party_certified';
  if (val === 'self_certified_private') return 'self_certified_private';
  return 'none';
}

/**
 * Neutralizes CWE-1236 formula injection prefixes (`=`, `+`, `-`, `@`, `\t`, `\r`)
 * and applies RFC 4180 CSV quoting.
 */
export function sanitizeCsvCell(value: string | number | boolean): string {
  const raw = String(value);
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function auditProductCatalogCsv(
  csvText: string,
  assessmentDate: string,
): ProductCsvAuditSummary {
  const cleaned = csvText.replace(/^\uFEFF/, '').trim();
  const regulationActive = assessmentDate.trim() >= EMPCO_EFFECTIVE_DATE;

  if (!cleaned) {
    return {
      totalSkus: 0,
      readyCount: 0,
      conditionalCount: 0,
      blockedCount: 0,
      genericClaimHits: 0,
      offsetClaimHits: 0,
      selfLabelHits: 0,
      missingNoticeHits: 0,
      rows: [],
      parseErrors: ['Product catalog CSV payload is empty.'],
    };
  }

  const lines = cleaned
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return {
      totalSkus: 0,
      readyCount: 0,
      conditionalCount: 0,
      blockedCount: 0,
      genericClaimHits: 0,
      offsetClaimHits: 0,
      selfLabelHits: 0,
      missingNoticeHits: 0,
      rows: [],
      parseErrors: ['CSV must include a header row and at least one SKU row.'],
    };
  }

  const delimiter = detectDelimiter(lines[0]!);
  const headers = splitCsvLine(lines[0]!, delimiter).map((h) =>
    h.toLowerCase().trim(),
  );
  const idxOf = (candidates: string[]): number => {
    for (const c of candidates) {
      const idx = headers.indexOf(c);
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const idxSku = idxOf(['sku', 'id', 'product_id']);
  const idxName = idxOf(['product_name', 'name', 'title']);
  const idxCopy = idxOf(['marketing_copy', 'copy', 'description', 'claim_text']);
  const idxLabel = idxOf(['label_kind', 'sustainability_label', 'label']);
  const idxNotice = idxOf(['legal_notice_displayed', 'legal_notice', 'notice_2y']);
  const idxDurability = idxOf([
    'durability_years',
    'commercial_durability_years',
    'guarantee_years',
  ]);
  const idxGaran = idxOf(['garan_label_displayed', 'garan_label', 'garan']);

  const parseErrors: string[] = [];
  if (idxCopy === -1) {
    parseErrors.push('Missing required CSV column: marketing_copy.');
    return {
      totalSkus: lines.length - 1,
      readyCount: 0,
      conditionalCount: 0,
      blockedCount: 0,
      genericClaimHits: 0,
      offsetClaimHits: 0,
      selfLabelHits: 0,
      missingNoticeHits: 0,
      rows: [],
      parseErrors,
    };
  }

  const rows: ProductCsvRowAudit[] = [];
  let readyCount = 0;
  let conditionalCount = 0;
  let blockedCount = 0;
  let genericClaimHits = 0;
  let offsetClaimHits = 0;
  let selfLabelHits = 0;
  let missingNoticeHits = 0;

  for (let i = 1; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i]!, delimiter);
    const rowNumber = i + 1;
    const sku = (idxSku !== -1 ? cells[idxSku] : '') || `SKU-${rowNumber}`;
    const productName =
      (idxName !== -1 ? cells[idxName] : '') || `Catalog Item ${rowNumber}`;
    const marketingCopy = idxCopy !== -1 ? cells[idxCopy] ?? '' : '';
    const labelKind = normalizeLabelKind(
      idxLabel !== -1 ? cells[idxLabel] : 'none',
    );
    const legalNoticeDisplayed =
      idxNotice !== -1 ? parseBool(cells[idxNotice]) : false;
    const durabilityGuaranteeYears =
      idxDurability !== -1 ? Math.max(0, Number(cells[idxDurability]) || 0) : 0;
    const garanLabelDisplayed =
      idxGaran !== -1 ? parseBool(cells[idxGaran]) : false;

    const issues: string[] = [];
    let isBlocked = false;
    let hasWarning = false;

    const hasRecognizedProof = labelKind === 'eu_ecolabel_public';
    const scan = scanMarketingClaims({
      marketingCopy,
      hasRecognizedExcellenceProof: hasRecognizedProof,
      hasFutureCommitmentPlan: false,
      hasIndependentThirdPartyVerifier: false,
    });

    if (scan.genericClaimsBlocked > 0) {
      isBlocked = true;
      genericClaimHits += 1;
      issues.push(
        `Unproven generic eco claim (${scan.matches.filter((m) => m.category === 'generic_eco' && m.severity === 'blocker').map((m) => m.matchedTerm).join(', ')})`,
      );
    }

    if (scan.carbonOffsetClaimsBlocked > 0) {
      isBlocked = true;
      offsetClaimHits += 1;
      issues.push(
        `Banned carbon-offset neutrality claim (${scan.matches.filter((m) => m.category === 'carbon_offset').map((m) => m.matchedTerm).join(', ')})`,
      );
    }

    if (labelKind === 'self_certified_private') {
      isBlocked = true;
      selfLabelHits += 1;
      issues.push('Self-certified private sustainability label banned (UCPD Annex I 2a)');
    }

    if (!legalNoticeDisplayed) {
      missingNoticeHits += 1;
      if (regulationActive) {
        isBlocked = true;
      } else {
        hasWarning = true;
      }
      issues.push('Missing mandatory Reg. (EU) 2025/1960 2-year legal guarantee notice');
    }

    if (durabilityGuaranteeYears > STATUTORY_LEGAL_GUARANTEE_YEARS && !garanLabelDisplayed) {
      if (regulationActive) {
        isBlocked = true;
      } else {
        hasWarning = true;
      }
      issues.push(
        `${durabilityGuaranteeYears}-year commercial durability guarantee missing GARAN label`,
      );
    }

    let status: ReadinessStatus;
    if (isBlocked) {
      status = 'blocked';
      blockedCount += 1;
    } else if (hasWarning) {
      status = 'conditional';
      conditionalCount += 1;
    } else {
      status = 'ready';
      readyCount += 1;
    }

    rows.push({
      rowNumber,
      sku,
      productName,
      labelKind,
      legalNoticeDisplayed,
      durabilityGuaranteeYears,
      garanLabelDisplayed,
      status,
      issues,
    });
  }

  return {
    totalSkus: rows.length,
    readyCount,
    conditionalCount,
    blockedCount,
    genericClaimHits,
    offsetClaimHits,
    selfLabelHits,
    missingNoticeHits,
    rows,
    parseErrors,
  };
}

export function exportProductCatalogAuditCsv(
  summary: ProductCsvAuditSummary,
): string {
  const header = [
    'row_number',
    'sku',
    'product_name',
    'label_kind',
    'legal_notice_displayed',
    'durability_years',
    'garan_label_displayed',
    'status',
    'audit_issues',
  ].join(',');

  const lines = summary.rows.map((row) =>
    [
      sanitizeCsvCell(row.rowNumber),
      sanitizeCsvCell(row.sku),
      sanitizeCsvCell(row.productName),
      sanitizeCsvCell(row.labelKind),
      sanitizeCsvCell(row.legalNoticeDisplayed),
      sanitizeCsvCell(row.durabilityGuaranteeYears),
      sanitizeCsvCell(row.garanLabelDisplayed),
      sanitizeCsvCell(row.status),
      sanitizeCsvCell(row.issues.join(' | ')),
    ].join(','),
  );

  return `\uFEFF${[header, ...lines].join('\n')}\n`;
}
