interface ExportMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

// ── Markdown export ───────────────────────────────────────────────────────────

export function exportConversationAsMarkdown(
  messages: ExportMessage[],
  title?: string
): void {
  const heading = title ? `# ${title}` : "# Conversation";
  const date = new Date().toISOString().split("T")[0];

  const body = messages
    .filter((m) => m.content.trim())
    .map((m) => {
      const label = m.role === "user" ? "**You**" : "**Assistant**";
      return `${label}\n\n${m.content.trim()}`;
    })
    .join("\n\n---\n\n");

  const markdown = `${heading}\n\n*Exported on ${date}*\n\n---\n\n${body}\n`;
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(title || "conversation").replace(/[^a-z0-9]/gi, "_").toLowerCase()}_${date}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Chart types ───────────────────────────────────────────────────────────────

interface SeriesConfig { key: string; name: string; color?: string }
interface ChartConfig {
  type: "line" | "bar" | "area" | "pie";
  title?: string;
  xKey?: string;
  nameKey?: string;
  dataKey?: string;
  series?: SeriesConfig[];
  data: Record<string, unknown>[];
}

const CHART_COLORS = [
  "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b",
  "#ef4444", "#ec4899", "#3b82f6", "#84cc16",
];

// ── SVG helpers ───────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const TF = `font-family="sans-serif"`;

function svgWrap(W: number, H: number, inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#0d0d1a"/>${inner}</svg>`;
}

function cartesianAxes(pL: number, pT: number, cW: number, cH: number): string {
  return (
    `<line x1="${pL}" y1="${pT}" x2="${pL}" y2="${pT + cH}" stroke="#2d3748" stroke-width="1"/>` +
    `<line x1="${pL}" y1="${pT + cH}" x2="${pL + cW}" y2="${pT + cH}" stroke="#2d3748" stroke-width="1"/>`
  );
}

function yGrid(pL: number, pT: number, cW: number, cH: number, max: number): string {
  let out = "";
  for (let t = 0; t <= 5; t++) {
    const v = (max * t) / 5;
    const gy = pT + cH - (v / max) * cH;
    const lbl = v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(v < 1 ? 1 : 0);
    out += `<line x1="${pL}" y1="${gy.toFixed(1)}" x2="${(pL + cW).toFixed(1)}" y2="${gy.toFixed(1)}" stroke="#1e293b" stroke-width="0.5"/>`;
    out += `<text x="${pL - 6}" y="${(gy + 4).toFixed(1)}" text-anchor="end" ${TF} font-size="11" fill="#64748b">${lbl}</text>`;
  }
  return out;
}

function seriesLegend(W: number, legY: number, sl: SeriesConfig[]): string {
  if (sl.length <= 1) return "";
  let out = "";
  const iW = Math.min(130, W / sl.length);
  const sx = (W - sl.length * iW) / 2;
  for (let si = 0; si < sl.length; si++) {
    const s = sl[si];
    const color = s.color ?? CHART_COLORS[si % CHART_COLORS.length];
    const lx = sx + si * iW;
    out += `<rect x="${lx.toFixed(1)}" y="${(legY - 8).toFixed(1)}" width="10" height="10" fill="${color}" rx="2"/>`;
    out += `<text x="${(lx + 14).toFixed(1)}" y="${legY.toFixed(1)}" ${TF} font-size="11" fill="#94a3b8">${esc(s.name)}</text>`;
  }
  return out;
}

// ── SVG chart generators ──────────────────────────────────────────────────────

function barChartSVG(cfg: ChartConfig, W: number, H: number): string {
  const { data, xKey = "period", series, dataKey = "value", title } = cfg;
  const sl = series ?? [{ key: dataKey, name: title ?? "Value", color: CHART_COLORS[0] }];
  const pL = 52, pR = 20, pT = title ? 44 : 24, pB = 58;
  const cW = W - pL - pR, cH = H - pT - pB;

  let max = 0;
  for (const d of data) for (const s of sl) { const v = Number(d[s.key] ?? 0); if (v > max) max = v; }
  max = (max * 1.1) || 10;

  const gW = cW / (data.length || 1);
  const bW = (gW * 0.7) / sl.length;

  let content = yGrid(pL, pT, cW, cH, max);

  for (let di = 0; di < data.length; di++) {
    const d = data[di];
    const gX = pL + di * gW;
    const lbl = String(d[xKey] ?? di);
    content += `<text x="${(gX + gW / 2).toFixed(1)}" y="${pT + cH + 20}" text-anchor="middle" ${TF} font-size="11" fill="#64748b">${esc(lbl.length > 12 ? lbl.slice(0, 11) + "…" : lbl)}</text>`;
    for (let si = 0; si < sl.length; si++) {
      const s = sl[si];
      const color = s.color ?? CHART_COLORS[si % CHART_COLORS.length];
      const val = Number(d[s.key] ?? 0);
      const bH = (val / max) * cH;
      const bx = gX + gW * 0.15 + si * bW;
      content += `<rect x="${bx.toFixed(1)}" y="${(pT + cH - bH).toFixed(1)}" width="${(bW - 2).toFixed(1)}" height="${Math.max(bH, 0).toFixed(1)}" fill="${color}" rx="3"/>`;
    }
  }

  content += seriesLegend(W, pT + cH + 44, sl);
  const titleEl = title ? `<text x="${W / 2}" y="26" text-anchor="middle" ${TF} font-size="14" font-weight="bold" fill="#e2e8f0">${esc(title)}</text>` : "";
  return svgWrap(W, H, titleEl + content + cartesianAxes(pL, pT, cW, cH));
}

function lineChartSVG(cfg: ChartConfig, W: number, H: number, filled = false): string {
  const { data, xKey = "period", series, dataKey = "value", title } = cfg;
  const sl = series ?? [{ key: dataKey, name: title ?? "Value", color: CHART_COLORS[0] }];
  const pL = 52, pR = 20, pT = title ? 44 : 24, pB = 58;
  const cW = W - pL - pR, cH = H - pT - pB;

  let max = 0;
  for (const d of data) for (const s of sl) { const v = Number(d[s.key] ?? 0); if (v > max) max = v; }
  max = (max * 1.1) || 10;

  const step = data.length > 1 ? cW / (data.length - 1) : cW;
  let content = yGrid(pL, pT, cW, cH, max);

  for (let di = 0; di < data.length; di++) {
    const x = pL + di * step;
    const lbl = String(data[di][xKey] ?? di);
    content += `<text x="${x.toFixed(1)}" y="${pT + cH + 20}" text-anchor="middle" ${TF} font-size="11" fill="#64748b">${esc(lbl.length > 12 ? lbl.slice(0, 11) + "…" : lbl)}</text>`;
  }

  for (let si = 0; si < sl.length; si++) {
    const s = sl[si];
    const color = s.color ?? CHART_COLORS[si % CHART_COLORS.length];
    const pts = data.map((d, di) => ({
      x: pL + di * step,
      y: pT + cH - (Number(d[s.key] ?? 0) / max) * cH,
    }));
    const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    if (filled) {
      const last = pts[pts.length - 1];
      content += `<path d="${path} L ${last.x.toFixed(1)} ${pT + cH} L ${pL} ${pT + cH} Z" fill="${color}33"/>`;
    }
    content += `<path d="${path}" stroke="${color}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    for (const p of pts) {
      content += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="${color}" stroke="#0d0d1a" stroke-width="1.5"/>`;
    }
  }

  content += seriesLegend(W, pT + cH + 44, sl);
  const titleEl = title ? `<text x="${W / 2}" y="26" text-anchor="middle" ${TF} font-size="14" font-weight="bold" fill="#e2e8f0">${esc(title)}</text>` : "";
  return svgWrap(W, H, titleEl + content + cartesianAxes(pL, pT, cW, cH));
}

function pieChartSVG(cfg: ChartConfig, W: number, H: number): string {
  const { data, nameKey = "name", dataKey = "value", title } = cfg;
  const pT = title ? 36 : 14;
  const cx = W * 0.58;
  const cy = pT + (H - pT) / 2;
  const outerR = Math.min(W * 0.33, (H - pT) * 0.42);
  const innerR = outerR * 0.42;

  const total = data.reduce((s, d) => s + Number(d[dataKey] ?? 0), 0) || 1;
  let startA = -Math.PI / 2;
  let content = "";
  const legendX = 14, legendStartY = pT + 20;

  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    const val = Number(d[dataKey] ?? 0);
    const angle = (val / total) * 2 * Math.PI;
    const endA = startA + angle;
    const color = CHART_COLORS[i % CHART_COLORS.length];

    if (angle > 0.01) {
      if (Math.abs(angle - Math.PI * 2) < 0.005) {
        // Full circle — SVG arc path degenerates when start === end; use circles instead
        content += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${outerR.toFixed(1)}" fill="${color}"/>`;
        content += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${innerR.toFixed(1)}" fill="#0d0d1a"/>`;
        content += `<text x="${cx.toFixed(1)}" y="${(cy + 5).toFixed(1)}" text-anchor="middle" ${TF} font-size="15" font-weight="bold" fill="white">100%</text>`;
      } else {
        const x1 = cx + outerR * Math.cos(startA), y1 = cy + outerR * Math.sin(startA);
        const x2 = cx + outerR * Math.cos(endA),   y2 = cy + outerR * Math.sin(endA);
        const ix1 = cx + innerR * Math.cos(endA),  iy1 = cy + innerR * Math.sin(endA);
        const ix2 = cx + innerR * Math.cos(startA),iy2 = cy + innerR * Math.sin(startA);
        const la = angle > Math.PI ? 1 : 0;
        content += `<path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${outerR.toFixed(1)} ${outerR.toFixed(1)} 0 ${la} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} L ${ix1.toFixed(1)} ${iy1.toFixed(1)} A ${innerR.toFixed(1)} ${innerR.toFixed(1)} 0 ${la} 0 ${ix2.toFixed(1)} ${iy2.toFixed(1)} Z" fill="${color}" stroke="#0d0d1a" stroke-width="2"/>`;
        if (angle > 0.25) {
          const midA = startA + angle / 2;
          const lr = (outerR + innerR) / 2;
          const pct = ((val / total) * 100).toFixed(0);
          content += `<text x="${(cx + lr * Math.cos(midA)).toFixed(1)}" y="${(cy + lr * Math.sin(midA) + 5).toFixed(1)}" text-anchor="middle" ${TF} font-size="12" font-weight="bold" fill="white">${pct}%</text>`;
        }
      }
    }

    const legY = legendStartY + i * 20;
    if (legY < H - 10) {
      const name = String(d[nameKey] ?? `Item ${i + 1}`);
      const short = name.length > 18 ? name.slice(0, 16) + "…" : name;
      const pct = ((val / total) * 100).toFixed(0);
      content += `<rect x="${legendX}" y="${(legY - 9).toFixed(1)}" width="12" height="12" fill="${color}" rx="3"/>`;
      content += `<text x="${legendX + 17}" y="${legY.toFixed(1)}" ${TF} font-size="11" fill="#e2e8f0">${esc(short)}</text>`;
      content += `<text x="${legendX + 17}" y="${(legY + 13).toFixed(1)}" ${TF} font-size="10" fill="#64748b">${pct}%</text>`;
    }
    startA = endA;
  }

  const titleEl = title ? `<text x="${W / 2}" y="24" text-anchor="middle" ${TF} font-size="14" font-weight="bold" fill="#e2e8f0">${esc(title)}</text>` : "";
  return svgWrap(W, H, titleEl + content);
}

function chartConfigToSVG(raw: string, W = 640, H = 300): string {
  try {
    const cfg = JSON.parse(raw) as ChartConfig;
    if (cfg.type === "bar")  return barChartSVG(cfg, W, H);
    if (cfg.type === "area") return lineChartSVG(cfg, W, H, true);
    if (cfg.type === "pie")  return pieChartSVG(cfg, W, H);
    return lineChartSVG(cfg, W, H, false);
  } catch { return ""; }
}

// 2× canvas scale for sharper charts in PDF
async function svgToDataURL(svg: string, W: number, H: number): Promise<string | null> {
  return new Promise((resolve) => {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url  = URL.createObjectURL(blob);
    const img  = new Image();
    img.onload = () => {
      try {
        const scale = 2;
        const canvas = document.createElement("canvas");
        canvas.width = W * scale; canvas.height = H * scale;
        const ctx = canvas.getContext("2d");
        if (!ctx) { URL.revokeObjectURL(url); resolve(null); return; }
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0, W, H);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/png", 0.95));
      } catch { URL.revokeObjectURL(url); resolve(null); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

// ── Message segmentation ──────────────────────────────────────────────────────

interface TextSegment  { kind: "text";  text: string }
interface ChartSegment { kind: "chart"; dataUrl: string; svgW: number; svgH: number }
type Segment = TextSegment | ChartSegment;

async function segmentMessage(content: string): Promise<Segment[]> {
  const chartRe = /```chart\n?([\s\S]*?)```/g;
  const segments: Segment[] = [];
  let last = 0, m: RegExpExecArray | null;

  while ((m = chartRe.exec(content)) !== null) {
    if (m.index > last) segments.push({ kind: "text", text: content.slice(last, m.index) });
    const svgW = 640, svgH = 300;
    const svg = chartConfigToSVG(m[1].trim(), svgW, svgH);
    if (svg) {
      const dataUrl = await svgToDataURL(svg, svgW, svgH);
      segments.push(dataUrl
        ? { kind: "chart", dataUrl, svgW, svgH }
        : { kind: "text", text: "[ Chart — render failed ]" });
    } else {
      segments.push({ kind: "text", text: "[ Chart — invalid data ]" });
    }
    last = m.index + m[0].length;
  }
  if (last < content.length) segments.push({ kind: "text", text: content.slice(last) });
  return segments;
}

// ── Markdown strip ────────────────────────────────────────────────────────────

function stripMarkdown(text: string): string {
  return text
    .replace(/```(\w*)\n?([\s\S]*?)```/g, (_m, lang, code) => `[${lang || "code"}]\n${code.trim()}`)
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*\*([^*]+)\*\*\*/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s+/gm, "  ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^---+$/gm, "────────────────────────")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/^\s*(\d+)\.\s+/gm, "$1. ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── PDF export ────────────────────────────────────────────────────────────────

export async function exportConversationAsPDF(
  messages: ExportMessage[],
  title?: string
): Promise<void> {
  const { default: jsPDF } = await import("jspdf");

  const doc   = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const mX    = 16;
  const cW    = pageW - mX * 2;
  const FOOTER_H    = 12;
  const SAFE_BOTTOM = pageH - FOOTER_H;

  const date      = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const convTitle = title || "Conversation";
  const filename  = convTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const filtered  = messages.filter((m) => m.content.trim());

  let y = 0;

  const newPage = () => { doc.addPage(); y = 20; };
  const ensureSpace = (needed: number) => { if (y + needed > SAFE_BOTTOM) newPage(); };

  const renderText = (
    str: string,
    opts: { size?: number; bold?: boolean; color?: [number,number,number]; indent?: number; lineH?: number } = {}
  ): number => {
    const { size = 9.5, bold = false, color = [40, 35, 60], indent = 0, lineH = 1.55 } = opts;
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(...color);
    const lines    = doc.splitTextToSize(str, cW - indent);
    const lineH_mm = size * lineH * 0.3528;
    let total = 0;
    for (const line of lines) {
      if (y + lineH_mm > SAFE_BOTTOM) newPage();
      doc.text(line, mX + indent, y);
      y += lineH_mm; total += lineH_mm;
    }
    return total;
  };

  const drawFooters = (total: number) => {
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      doc.setDrawColor(210, 205, 230); doc.setLineWidth(0.2);
      doc.line(mX, pageH - FOOTER_H + 1, pageW - mX, pageH - FOOTER_H + 1);
      doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(150, 140, 190);
      doc.text("Knowledge Base", mX, pageH - FOOTER_H + 5.5);
      doc.text(`Page ${p} of ${total}`, pageW - mX, pageH - FOOTER_H + 5.5, { align: "right" });
    }
  };

  // ── Header ────────────────────────────────────────────────────────────────

  const HDR_H = 32;
  doc.setFillColor(18, 14, 46); doc.rect(0, 0, pageW, HDR_H, "F");
  doc.setFillColor(124, 106, 247); doc.rect(0, 0, 5, HDR_H, "F");
  doc.setFillColor(80, 60, 180); doc.rect(0, HDR_H - 1.5, pageW, 1.5, "F");

  const shortTitle = convTitle.length > 58 ? convTitle.slice(0, 55) + "…" : convTitle;
  doc.setFontSize(13.5); doc.setFont("helvetica", "bold"); doc.setTextColor(235, 230, 255);
  doc.text(shortTitle, mX + 2, 14);

  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(160, 148, 220);
  doc.text(`Knowledge Base  ·  Exported ${date}`, mX + 2, 23);

  const msgCount = filtered.length;
  doc.setFontSize(7.5); doc.setTextColor(120, 100, 200);
  doc.text(`${msgCount} message${msgCount !== 1 ? "s" : ""}`, pageW - mX, 23, { align: "right" });

  y = HDR_H + 12;

  // ── Pre-render all chart images ────────────────────────────────────────────

  const segmented = await Promise.all(
    filtered.map(async (msg) => ({ ...msg, segments: await segmentMessage(msg.content) }))
  );

  // ── Messages ──────────────────────────────────────────────────────────────

  for (let i = 0; i < segmented.length; i++) {
    const msg    = segmented[i];
    const isUser = msg.role === "user";

    // Page break before every user query after the first message
    if (isUser && i > 0) {
      newPage();
    }

    const minContent = 9.5 * 1.55 * 0.3528 * 2;
    ensureSpace(14 + minContent);

    // ── Role pill ────────────────────────────────────────────────────────────
    const pillW = isUser ? 20 : 30;
    const pillH = 7;
    const pillTopY = y;

    doc.setFillColor(...(isUser
      ? [38, 28, 80] as [number,number,number]
      : [28, 25, 52] as [number,number,number]));
    doc.roundedRect(mX, pillTopY, pillW, pillH, 2, 2, "F");

    // Vertically centered text inside pill
    const pillMidY = pillTopY + pillH / 2;
    doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
    doc.setTextColor(...(isUser
      ? [190, 170, 255] as [number,number,number]
      : [140, 125, 200] as [number,number,number]));
    doc.text(isUser ? "You" : "Assistant", mX + 4, pillMidY, { baseline: "middle" });

    // Timestamp beside the pill, vertically aligned
    if (msg.timestamp) {
      const ts = new Date(msg.timestamp).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(130, 118, 175);
      doc.text(ts, mX + pillW + 4, pillMidY, { baseline: "middle" });
    }

    // Move below pill with breathing room
    y = pillTopY + pillH + 5;

    // ── Accent bar tracking ──────────────────────────────────────────────────
    const barColor  = isUser ? [100, 80, 220] as [number,number,number] : [60, 55, 100] as [number,number,number];
    const startY    = pillTopY - 1;
    const startPage = (doc.internal as { getCurrentPageInfo(): { pageNumber: number } }).getCurrentPageInfo().pageNumber;

    // ── Render segments ──────────────────────────────────────────────────────
    for (const seg of msg.segments) {
      if (seg.kind === "text") {
        const plain = stripMarkdown(seg.text);
        if (plain.trim()) {
          renderText(plain, {
            size: 9.5,
            color: isUser ? [45, 35, 75] : [38, 34, 62],
            lineH: 1.55,
            indent: 2,
          });
        }
      } else {
        // Chart image
        const imgW = cW - 4;
        const imgH = imgW * (seg.svgH / seg.svgW);
        ensureSpace(imgH + 6);
        doc.addImage(seg.dataUrl, "PNG", mX + 2, y, imgW, imgH);
        y += imgH + 6;
      }
    }

    const endY    = y + 2;
    const endPage = (doc.internal as { getCurrentPageInfo(): { pageNumber: number } }).getCurrentPageInfo().pageNumber;

    // ── Draw accent bar (one segment per spanned page) ───────────────────────
    doc.setFillColor(...barColor);
    if (endPage === startPage) {
      doc.rect(mX - 3, startY, 1.5, endY - startY, "F");
    } else {
      doc.setPage(startPage); doc.setFillColor(...barColor);
      doc.rect(mX - 3, startY, 1.5, SAFE_BOTTOM - startY, "F");
      for (let p = startPage + 1; p < endPage; p++) {
        doc.setPage(p); doc.setFillColor(...barColor);
        doc.rect(mX - 3, 18, 1.5, SAFE_BOTTOM - 18, "F");
      }
      doc.setPage(endPage); doc.setFillColor(...barColor);
      doc.rect(mX - 3, 18, 1.5, endY - 18, "F");
    }

    // ── Spacing between user query and assistant response (no page break) ────
    if (i < segmented.length - 1 && !isUser) {
      // Assistant → next user: page break will handle it, just add bottom margin
      y += 8;
    } else if (i < segmented.length - 1 && isUser) {
      // User → assistant: thin separator + spacing
      y += 5;
      ensureSpace(8);
      doc.setDrawColor(50, 40, 90); doc.setLineWidth(0.1);
      doc.line(mX + 2, y, pageW - mX, y);
      y += 6;
    }
  }

  // ── Footers ───────────────────────────────────────────────────────────────

  const totalPages = (doc.internal as { getNumberOfPages(): number }).getNumberOfPages();
  drawFooters(totalPages);

  doc.save(`${filename}_${new Date().toISOString().split("T")[0]}.pdf`);
}
