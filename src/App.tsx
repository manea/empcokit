import { ArrowLeft, Database, HardDrive, Languages, Moon, Printer, Shield, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ClaimsAndLabelPanel } from './components/ClaimsAndLabelPanel.tsx';
import { DossierPreviewAndPrint } from './components/DossierPreviewAndPrint.tsx';
import { EmpcoNoticeAndRiskSvg } from './components/EmpcoNoticeAndRiskSvg.tsx';
import { GuaranteeAndControlsPanel } from './components/GuaranteeAndControlsPanel.tsx';
import { ProductCatalogCsvPanel } from './components/ProductCatalogCsvPanel.tsx';
import { EMPCO_PRESETS, assessEmpcoReadiness } from './core/index.ts';
import type { AssessmentInput, AssessmentResult } from './core/types.ts';
import {
  type ApiMode,
  type DossierBundle,
  type OrgProfile,
  type StoredDossier,
  createDossierFromInput,
  deleteDraftDossier,
  detectApiMode,
  downloadBriefMarkdown,
  downloadSafeBomCsv,
  duplicateDossier,
  finalizeDossier,
  listDossiers,
  listProfiles,
  loadPublicReport,
  saveOrgProfile,
  updateDossierInput,
} from './lib/api.ts';
import { stripBase, withBase } from './lib/basePath.ts';
import { STATUS_META, UI_LABELS, type UiLang, type UiTheme } from './lib/i18n.ts';

function extractPublicRouteSlug(): string | null {
  if (typeof window === 'undefined') return null;
  const rel = stripBase(window.location.pathname);
  const match = rel.match(/^\/r\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1] || '') : null;
}

export default function App() {
  const [lang, setLang] = useState<UiLang>(() =>
    typeof window !== 'undefined' && window.localStorage.getItem('empcokit.v1.lang') === 'ar'
      ? 'ar'
      : 'en',
  );
  const [theme, setTheme] = useState<UiTheme>(() =>
    typeof window !== 'undefined' &&
    window.localStorage.getItem('empcokit.v1.theme') === 'charcoal-ledger'
      ? 'charcoal-ledger'
      : 'nordic-linen',
  );
  const [mode, setMode] = useState<ApiMode>('local');

  const [presetKey, setPresetKey] = useState<string>(EMPCO_PRESETS[0]!.id);
  const [input, setInput] = useState<AssessmentInput>(EMPCO_PRESETS[0]!.input);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [evalError, setEvalError] = useState<string>('');

  const [savedDossiers, setSavedDossiers] = useState<StoredDossier[]>([]);
  const [profiles, setProfiles] = useState<OrgProfile[]>([]);
  const [activeDossier, setActiveDossier] = useState<StoredDossier | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [toast, setToast] = useState<string>('');

  const [publicSlug, setPublicSlug] = useState<string | null>(() => extractPublicRouteSlug());
  const [publicBundle, setPublicBundle] = useState<
    (DossierBundle & { markdownEn: string; markdownAr: string }) | null
  >(null);
  const [publicLoading, setPublicLoading] = useState<boolean>(false);

  const t = UI_LABELS[lang];
  const isAr = lang === 'ar';

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem('empcokit.v1.lang', lang);
      window.localStorage.setItem('empcokit.v1.theme', theme);
    } catch {
      // ignore storage errors
    }
  }, [lang, isAr, theme]);

  useEffect(() => {
    const onPopState = () => setPublicSlug(extractPublicRouteSlug());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const detected = await detectApiMode();
      if (!active) return;
      setMode(detected);
      try {
        const [dList, pList] = await Promise.all([listDossiers(detected), listProfiles(detected)]);
        if (!active) return;
        setSavedDossiers(dList);
        setProfiles(pList);
      } catch {
        // ignore initial storage load error
      }
      const slugNow = extractPublicRouteSlug();
      if (slugNow) {
        setPublicLoading(true);
        const loaded = await loadPublicReport(detected, slugNow);
        if (active) {
          setPublicBundle(loaded);
          setPublicLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    assessEmpcoReadiness(input)
      .then((res) => {
        if (!cancelled) {
          setResult(res);
          setEvalError('');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setEvalError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [input]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((cur) => (cur === msg ? '' : cur)), 3200);
  };

  const refreshSavedLists = async (m: ApiMode) => {
    const [dList, pList] = await Promise.all([listDossiers(m), listProfiles(m)]);
    setSavedDossiers(dList);
    setProfiles(pList);
  };

  const navigatePublic = async (slugOrCode: string | null) => {
    if (!slugOrCode) {
      window.history.pushState({}, '', withBase('/'));
      setPublicSlug(null);
      setPublicBundle(null);
      return;
    }
    window.history.pushState({}, '', withBase(`/r/${encodeURIComponent(slugOrCode)}`));
    setPublicSlug(slugOrCode);
    setPublicLoading(true);
    const loaded = await loadPublicReport(mode, slugOrCode);
    setPublicBundle(loaded);
    setPublicLoading(false);
  };

  const handleLoadPreset = (id: string) => {
    const found = EMPCO_PRESETS.find((p) => p.id === id) || EMPCO_PRESETS[0]!;
    setPresetKey(found.id);
    setInput(found.input);
    setActiveDossier(null);
  };

  const handleSaveDraft = async () => {
    setBusy(true);
    try {
      const bundle = await createDossierFromInput(mode, input, lang, presetKey);
      setActiveDossier(bundle.dossier);
      await refreshSavedLists(mode);
      showToast(t.toastSaved);
    } catch (err) {
      showToast(`${t.toastError}${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateDraft = async () => {
    if (!activeDossier) return;
    setBusy(true);
    try {
      const bundle = await updateDossierInput(mode, activeDossier.id, input, lang);
      setActiveDossier(bundle.dossier);
      await refreshSavedLists(mode);
      showToast(t.toastUpdated);
    } catch (err) {
      showToast(`${t.toastError}${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const handleFinalize = async () => {
    if (!activeDossier) return;
    setBusy(true);
    try {
      const bundle = await finalizeDossier(mode, activeDossier.id);
      setActiveDossier(bundle.dossier);
      await refreshSavedLists(mode);
      showToast(t.toastFinalized);
    } catch (err) {
      showToast(`${t.toastError}${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const handleDuplicate = async () => {
    if (!activeDossier) return;
    setBusy(true);
    try {
      const bundle = await duplicateDossier(mode, activeDossier.id);
      setActiveDossier(bundle.dossier);
      setInput(bundle.dossier.input);
      await refreshSavedLists(mode);
      showToast(t.toastDuplicated);
    } catch (err) {
      showToast(`${t.toastError}${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteDraft = async () => {
    if (!activeDossier) return;
    setBusy(true);
    try {
      await deleteDraftDossier(mode, activeDossier.id);
      setActiveDossier(null);
      await refreshSavedLists(mode);
      showToast(t.toastDeleted);
    } catch (err) {
      showToast(`${t.toastError}${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveProfile = async () => {
    setBusy(true);
    try {
      await saveOrgProfile(mode, input);
      await refreshSavedLists(mode);
      showToast(t.toastProfileSaved);
    } catch (err) {
      showToast(`${t.toastError}${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const handleCopyNotice = async (snippet: string) => {
    try {
      await navigator.clipboard.writeText(snippet);
      showToast(t.copiedNoticeToast);
    } catch {
      showToast(t.copiedNoticeToast);
    }
  };

  // Shareable /r/:slugOrCode route view
  if (publicSlug) {
    return (
      <div className="min-h-screen px-4 py-6 sm:px-6" style={{ backgroundColor: 'var(--bg-canvas)', color: 'var(--text-primary)' }}>
        <div className="mx-auto max-w-4xl space-y-4">
          <div className="no-print flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => navigatePublic(null)}
              className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold"
              style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-surface)' }}
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t.backToStudio}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={t.switchLangAria}
                title={t.switchLangAria}
                onClick={() => setLang(isAr ? 'en' : 'ar')}
                className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold"
                style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-surface)' }}
              >
                <Languages className="h-4 w-4" />
                <span>{t.switchLang}</span>
              </button>
              <button
                type="button"
                aria-label={t.printBtn}
                title={t.printBtn}
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold"
                style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-primary-fg)' }}
              >
                <Printer className="h-4 w-4" />
                <span>{t.printBtn}</span>
              </button>
            </div>
          </div>

          {publicLoading ? (
            <div className="emp-card rounded-2xl p-6 text-sm">Loading...</div>
          ) : !publicBundle ? (
            <div className="emp-card rounded-2xl p-6 text-sm" style={{ color: 'var(--accent-crimson)' }}>
              {t.publicNotFound}
            </div>
          ) : (
            <article className="emp-card print-only-sheet rounded-2xl p-5 sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b pb-3" style={{ borderColor: 'var(--border-subtle)' }}>
                <div>
                  <h1 className="text-lg font-extrabold">{t.publicReportTitle}</h1>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {publicBundle.dossier.input.organizationName} ·{' '}
                    <span dir="ltr" className="emp-mono">
                      {publicBundle.dossier.dossierCode || publicBundle.slug}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span
                    className="rounded-full px-2.5 py-1"
                    style={{
                      backgroundColor: STATUS_META[publicBundle.dossier.result.status].badgeBg,
                      color: STATUS_META[publicBundle.dossier.result.status].badgeColor,
                    }}
                  >
                    {isAr
                      ? STATUS_META[publicBundle.dossier.result.status].ar
                      : STATUS_META[publicBundle.dossier.result.status].en}
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {t.viewsLabel}: <span dir="ltr">{publicBundle.viewCount}</span>
                  </span>
                </div>
              </div>

              <pre
                dir={isAr ? 'rtl' : 'ltr'}
                className="whitespace-pre-wrap rounded-xl border p-4 text-xs leading-relaxed"
                style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-elevated)' }}
              >
                {isAr ? publicBundle.markdownAr : publicBundle.markdownEn}
              </pre>
            </article>
          )}
        </div>
      </div>
    );
  }

  const sm = result ? STATUS_META[result.status] : STATUS_META.ready;
  const blockedClaimsCount = result
    ? result.claimsScan.genericClaimsBlocked + result.claimsScan.carbonOffsetClaimsBlocked
    : 0;
  const locked = activeDossier?.status === 'locked';

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-canvas)', color: 'var(--text-primary)' }}>
      {/* Non-sticky clean header */}
      <header className="no-print border-b px-4 py-3 sm:px-6" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-surface)' }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-primary-fg)' }}>
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-extrabold tracking-tight">{t.brandTitle}</h1>
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
                  style={{
                    backgroundColor:
                      mode === 'server' ? 'var(--accent-emerald-soft)' : 'var(--bg-soft)',
                    color: mode === 'server' ? 'var(--accent-emerald)' : 'var(--accent-primary)',
                  }}
                >
                  {mode === 'server' ? <Database className="h-3 w-3" /> : <HardDrive className="h-3 w-3" />}
                  <span>{mode === 'server' ? t.modeServer : t.modeLocal}</span>
                </span>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {t.brandSubtitle}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-label={t.switchLangAria}
              title={t.switchLangAria}
              onClick={() => setLang(isAr ? 'en' : 'ar')}
              className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold"
              style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-elevated)' }}
            >
              <Languages className="h-4 w-4" />
              <span>{t.switchLang}</span>
            </button>

            <button
              type="button"
              aria-label={t.switchThemeAria}
              title={t.switchThemeAria}
              onClick={() =>
                setTheme(theme === 'nordic-linen' ? 'charcoal-ledger' : 'nordic-linen')
              }
              className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold"
              style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-elevated)' }}
            >
              {theme === 'nordic-linen' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              <span>
                {theme === 'nordic-linen' ? t.switchThemeDark : t.switchThemeLight}
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-5 sm:px-6">
        {/* Non-EU-Regulator Disclaimer Banner */}
        <div className="rounded-xl border px-3.5 py-2.5 text-xs font-medium" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
          {t.disclaimerBanner}
        </div>

        {/* Presets Bar */}
        <section className="no-print emp-card rounded-2xl p-3.5 sm:p-4">
          <div className="mb-2 text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
            {t.presetLabel}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {EMPCO_PRESETS.map((p) => {
              const selected = presetKey === p.id && !activeDossier;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleLoadPreset(p.id)}
                  className="rounded-xl border p-3 text-start transition"
                  style={{
                    borderColor: selected ? 'var(--accent-primary)' : 'var(--border-subtle)',
                    backgroundColor: selected ? 'var(--bg-soft)' : 'var(--bg-elevated)',
                  }}
                >
                  <div className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                    {isAr ? p.labelAr : p.labelEn}
                  </div>
                  <div className="mt-1 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    {isAr ? p.descriptionAr : p.descriptionEn}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {evalError && (
          <div className="rounded-xl p-3 text-xs font-bold" style={{ backgroundColor: 'var(--accent-crimson-soft)', color: 'var(--accent-crimson)' }}>
            {evalError}
          </div>
        )}

        {toast && (
          <div
            role="status"
            className="no-print rounded-xl border px-3.5 py-2 text-xs font-bold"
            style={{ borderColor: 'var(--accent-primary)', backgroundColor: 'var(--bg-soft)', color: 'var(--accent-primary)' }}
          >
            {toast}
          </div>
        )}

        {result && (
          <>
            {/* 4 KPI Strip */}
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="emp-card rounded-2xl p-3.5">
                <div className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  {t.kpiScore}
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-1.5">
                  <span dir="ltr" className="emp-mono num-tabular text-xl font-extrabold sm:text-2xl" style={{ color: sm.badgeColor }}>
                    {result.readinessScore}/100
                  </span>
                  <span
                    className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold"
                    style={{ backgroundColor: sm.badgeBg, color: sm.badgeColor }}
                  >
                    {isAr ? sm.ar : sm.en}
                  </span>
                </div>
              </div>

              <div className="emp-card rounded-2xl p-3.5">
                <div className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  {t.kpiExposure}
                </div>
                <div
                  dir="ltr"
                  className="emp-mono num-tabular mt-1 text-xl font-extrabold sm:text-2xl"
                  style={{
                    color:
                      result.maxTurnoverFineExposureEur > 0
                        ? 'var(--accent-crimson)'
                        : 'var(--accent-emerald)',
                  }}
                >
                  EUR {result.maxTurnoverFineExposureEur.toLocaleString('en-US')}
                </div>
              </div>

              <div className="emp-card rounded-2xl p-3.5">
                <div className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  {t.kpiBlockedClaims}
                </div>
                <div
                  dir="ltr"
                  className="emp-mono num-tabular mt-1 text-2xl font-extrabold"
                  style={{
                    color:
                      blockedClaimsCount > 0 ? 'var(--accent-crimson)' : 'var(--accent-emerald)',
                  }}
                >
                  {blockedClaimsCount}
                </div>
              </div>

              <div className="emp-card rounded-2xl p-3.5">
                <div className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  {t.kpiGuarantee}
                </div>
                <div className="mt-1 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                  {result.guarantee.legalGuaranteeNoticeCompliant ? '2Y OK' : '2Y MISSING'} ·{' '}
                  <span dir="ltr" className="emp-mono">
                    {result.guarantee.garanLabelRequired
                      ? result.guarantee.garanLabelCompliant
                        ? 'GARAN OK'
                        : 'GARAN MISSING'
                      : 'GARAN N/A'}
                  </span>
                </div>
              </div>
            </section>

            {/* Live SVG Preview */}
            <EmpcoNoticeAndRiskSvg result={result} lang={lang} />

            {/* Claims + Guarantee Split */}
            <div className="grid gap-5 lg:grid-cols-2">
              <ClaimsAndLabelPanel
                input={input}
                claimsScan={result.claimsScan}
                lang={lang}
                locked={locked}
                onChange={setInput}
              />
              <GuaranteeAndControlsPanel
                input={input}
                guarantee={result.guarantee}
                controls={result.controls}
                lang={lang}
                locked={locked}
                onChange={setInput}
                onCopyNotice={handleCopyNotice}
              />
            </div>

            {/* Product Catalog CSV Auditor */}
            <ProductCatalogCsvPanel
              csvText={input.productCatalogCsv || ''}
              catalogAudit={result.catalogAudit}
              lang={lang}
              locked={locked}
              onCsvChange={(nextCsv) =>
                setInput({ ...input, productCatalogCsv: nextCsv || undefined })
              }
              onExportCsv={() => downloadSafeBomCsv(mode, result, activeDossier)}
            />

            {/* Findings, Persistence & Export */}
            <DossierPreviewAndPrint
              result={result}
              activeDossier={activeDossier}
              savedDossiers={savedDossiers}
              profiles={profiles}
              lang={lang}
              busy={busy}
              onSaveDraft={handleSaveDraft}
              onUpdateDraft={handleUpdateDraft}
              onFinalize={handleFinalize}
              onDuplicate={handleDuplicate}
              onDeleteDraft={handleDeleteDraft}
              onSaveProfile={handleSaveProfile}
              onSelectDossier={(d) => {
                setActiveDossier(d);
                setInput(d.input);
              }}
              onApplyProfile={(p) => {
                setActiveDossier(null);
                setInput({
                  ...input,
                  organizationName: p.profile.organizationName,
                  productOrStoreName: p.profile.productOrStoreName,
                  channelScope: p.profile.channelScope,
                  annualEuTurnoverEur: p.profile.annualEuTurnoverEur,
                  notes: p.profile.notes,
                });
              }}
              onDownloadBrief={() =>
                downloadBriefMarkdown(mode, input, result, activeDossier, lang)
              }
              onDownloadCsv={() => downloadSafeBomCsv(mode, result, activeDossier)}
              onOpenPublic={(slugOrCode) => navigatePublic(slugOrCode)}
              onPrint={() => window.print()}
            />
          </>
        )}
      </main>
    </div>
  );
}
