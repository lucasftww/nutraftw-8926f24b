import { useEffect, useState } from "react";

/**
 * Overlay de depuração de performance — somente em mobile/desenvolvimento.
 *
 * Ativação:
 *  - URL: adicione `?debug=1` (persiste em localStorage)
 *  - Console: `localStorage.debugPerf = "1"` e recarregue
 *  - Desativar: `?debug=0` ou `localStorage.removeItem("debugPerf")`
 *
 * Métricas coletadas via PerformanceObserver nativo (sem dependências):
 *  - FCP  (First Contentful Paint)
 *  - LCP  (Largest Contentful Paint) — destaca a imagem/elemento responsável
 *  - CLS  (Cumulative Layout Shift)
 *  - INP/FID aproximado via long-tasks
 *  - Imagens: top 5 mais lentas/maiores (transferSize, duração, src)
 */

type Metric = { value: number; rating: "good" | "needs" | "poor"; detail?: string };

const fmt = (n: number, d = 0) => n.toFixed(d);
const fmtKB = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(2)}MB` : `${Math.round(b / 1024)}KB`);

function rate(metric: "lcp" | "cls" | "fcp" | "inp", v: number): Metric["rating"] {
  // Thresholds Web Vitals
  if (metric === "lcp") return v <= 2500 ? "good" : v <= 4000 ? "needs" : "poor";
  if (metric === "fcp") return v <= 1800 ? "good" : v <= 3000 ? "needs" : "poor";
  if (metric === "cls") return v <= 0.1 ? "good" : v <= 0.25 ? "needs" : "poor";
  if (metric === "inp") return v <= 200 ? "good" : v <= 500 ? "needs" : "poor";
  return "needs";
}

const ratingColor: Record<Metric["rating"], string> = {
  good: "#16a34a",
  needs: "#eab308",
  poor: "#ef4444",
};

interface ImgEntry {
  name: string;
  duration: number;
  size: number;
}

export function PerfOverlay() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(true);
  const [lcp, setLcp] = useState<Metric | null>(null);
  const [fcp, setFcp] = useState<Metric | null>(null);
  const [cls, setCls] = useState<Metric>({ value: 0, rating: "good" });
  const [inp, setInp] = useState<Metric | null>(null);
  const [images, setImages] = useState<ImgEntry[]>([]);
  const [longTasks, setLongTasks] = useState(0);

  // Resolve ativação
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      const q = url.searchParams.get("debug");
      if (q === "1") localStorage.setItem("debugPerf", "1");
      if (q === "0") localStorage.removeItem("debugPerf");
      setEnabled(localStorage.getItem("debugPerf") === "1");
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !("PerformanceObserver" in window)) return;
    const observers: PerformanceObserver[] = [];

    // FCP
    try {
      const o = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (e.name === "first-contentful-paint") {
            setFcp({ value: e.startTime, rating: rate("fcp", e.startTime) });
          }
        }
      });
      o.observe({ type: "paint", buffered: true });
      observers.push(o);
    } catch {/* noop */}

    // LCP
    try {
      const o = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1] as any;
        if (last) {
          const v = last.startTime as number;
          let detail: string | undefined;
          if (last.element) {
            const tag = (last.element as Element).tagName.toLowerCase();
            const src = (last.element as HTMLImageElement).currentSrc || (last.element as HTMLImageElement).src;
            detail = src ? `${tag} ${src.split("/").pop()?.slice(0, 28)}` : tag;
          } else if (last.url) {
            detail = String(last.url).split("/").pop();
          }
          setLcp({ value: v, rating: rate("lcp", v), detail });
        }
      });
      o.observe({ type: "largest-contentful-paint", buffered: true });
      observers.push(o);
    } catch {/* noop */}

    // CLS
    try {
      let clsValue = 0;
      const o = new PerformanceObserver((list) => {
        for (const e of list.getEntries() as any[]) {
          if (!e.hadRecentInput) clsValue += e.value;
        }
        setCls({ value: clsValue, rating: rate("cls", clsValue) });
      });
      o.observe({ type: "layout-shift", buffered: true });
      observers.push(o);
    } catch {/* noop */}

    // INP aproximado via event-timing (Chrome-only); fallback: nada
    try {
      let worst = 0;
      const o = new PerformanceObserver((list) => {
        for (const e of list.getEntries() as any[]) {
          if (e.duration > worst) {
            worst = e.duration;
            setInp({ value: worst, rating: rate("inp", worst) });
          }
        }
      });
      // @ts-ignore — event timing
      o.observe({ type: "event", buffered: true, durationThreshold: 40 });
      observers.push(o);
    } catch {/* noop */}

    // Long tasks (≥50ms) — sinalizam gargalos de JS
    try {
      const o = new PerformanceObserver((list) => {
        setLongTasks((c) => c + list.getEntries().length);
      });
      o.observe({ type: "longtask", buffered: true });
      observers.push(o);
    } catch {/* noop */}

    // Imagens — usa Resource Timing
    try {
      const collect = () => {
        const all = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
        const imgs = all
          .filter((r) => r.initiatorType === "img" || /\.(png|jpe?g|webp|avif|svg|gif)(\?|$)/i.test(r.name))
          .map((r) => ({
            name: r.name.split("/").pop()?.split("?")[0] || r.name,
            duration: r.duration,
            size: (r as any).transferSize || (r as any).encodedBodySize || 0,
          }));
        // Top 5 por (duração + bytes)
        imgs.sort((a, b) => b.duration + b.size / 1024 - (a.duration + a.size / 1024));
        setImages(imgs.slice(0, 5));
      };
      const o = new PerformanceObserver(() => collect());
      o.observe({ type: "resource", buffered: true });
      observers.push(o);
      collect();
    } catch {/* noop */}

    return () => observers.forEach((o) => { try { o.disconnect(); } catch {/* noop */} });
  }, [enabled]);

  if (!enabled) return null;

  const Row = ({ label, m, unit = "ms" }: { label: string; m: Metric | null; unit?: string }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <span style={{ opacity: 0.7 }}>{label}</span>
      {m ? (
        <span style={{ color: ratingColor[m.rating], fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          {label === "CLS" ? fmt(m.value, 3) : fmt(m.value, 0)}{label !== "CLS" ? unit : ""}
        </span>
      ) : (
        <span style={{ opacity: 0.4 }}>—</span>
      )}
    </div>
  );

  return (
    <div
      style={{
        position: "fixed",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)",
        left: 8,
        zIndex: 2147483647,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 11,
        lineHeight: 1.35,
        color: "#fff",
        background: "rgba(15, 23, 42, 0.92)",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 10,
        boxShadow: "0 8px 24px -8px rgba(0,0,0,0.5)",
        maxWidth: open ? 280 : 92,
        padding: open ? 10 : 6,
        transition: "max-width 0.18s ease",
        userSelect: "none",
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "transparent", color: "#fff", border: 0, padding: 0, cursor: "pointer",
          fontFamily: "inherit", fontSize: 11, fontWeight: 700, letterSpacing: 0.4,
        }}
        aria-label={open ? "Recolher debug" : "Expandir debug"}
      >
        <span>⚡ PERF</span>
        <span style={{ opacity: 0.6 }}>{open ? "—" : "+"}</span>
      </button>
      {open && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          <Row label="LCP" m={lcp} />
          <Row label="FCP" m={fcp} />
          <Row label="CLS" m={cls} />
          <Row label="INP" m={inp} />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ opacity: 0.7 }}>Long tasks</span>
            <span style={{ color: longTasks > 3 ? ratingColor.poor : longTasks > 0 ? ratingColor.needs : ratingColor.good, fontWeight: 700 }}>{longTasks}</span>
          </div>
          {lcp?.detail && (
            <div style={{ marginTop: 4, padding: "4px 6px", background: "rgba(255,255,255,0.06)", borderRadius: 6, fontSize: 10, wordBreak: "break-all", opacity: 0.85 }}>
              LCP→ {lcp.detail}
            </div>
          )}
          {images.length > 0 && (
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ fontWeight: 700, opacity: 0.7, marginBottom: 4, fontSize: 10, letterSpacing: 0.4 }}>
                IMAGENS (top {images.length})
              </div>
              {images.map((i, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 10, padding: "2px 0", opacity: 0.95 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150 }}>
                    {i.name}
                  </span>
                  <span style={{ fontVariantNumeric: "tabular-nums", opacity: 0.85 }}>
                    {fmt(i.duration)}ms · {fmtKB(i.size)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => {
              localStorage.removeItem("debugPerf");
              setEnabled(false);
            }}
            style={{
              marginTop: 8, padding: "4px 8px", background: "rgba(239,68,68,0.18)", color: "#fca5a5",
              border: "1px solid rgba(239,68,68,0.35)", borderRadius: 6, cursor: "pointer",
              fontFamily: "inherit", fontSize: 10, fontWeight: 700,
            }}
          >
            DESATIVAR
          </button>
        </div>
      )}
    </div>
  );
}