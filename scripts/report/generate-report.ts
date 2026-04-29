import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { getSupabase } from "../lib/supabase-client";

async function main() {
  const sb = getSupabase();

  // Cleanup: any 'new' rows that lack a thumbnail are auto-rejected so
  // they never appear in the review queue. This keeps legacy items
  // (collected before the auto-reject was added at insert time) out of view.
  const { data: cleaned, error: cleanupErr } = await sb
    .from("raw_items")
    .update({ status: "rejected", notes: "Auto-rejected: no thumbnail (cleanup)" })
    .eq("status", "new")
    .is("thumbnail_url", null)
    .select("id");
  if (cleanupErr) {
    console.warn(`Cleanup warning: ${cleanupErr.message}`);
  } else if (cleaned && cleaned.length > 0) {
    console.log(`Auto-rejected ${cleaned.length} legacy item(s) without thumbnail`);
  }

  const { data: items, error } = await sb
    .from("raw_items")
    .select("*")
    .eq("status", "new")
    .not("thumbnail_url", "is", null)
    .order("raw_published_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch raw_items: ${error.message}`);

  const { data: existingPosts } = await sb.from("posts").select("category");
  const existingCategories = [
    ...new Set(
      (existingPosts ?? [])
        .map((p: any) => p.category as string)
        .filter(Boolean)
    ),
  ].sort();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN ?? "";
  const telegramChannelId = process.env.TELEGRAM_CHANNEL_ID ?? "";

  const contentTypes = Array.from(
    new Set((items ?? []).map((i: any) => i.content_type).filter(Boolean))
  ).sort();

  const html = buildHtml(items ?? [], existingCategories, contentTypes, supabaseUrl, serviceKey, telegramBotToken, telegramChannelId);

  const outDir = path.resolve(__dirname, "../../reports");
  fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, "youtube-review.html");
  fs.writeFileSync(outPath, html, "utf-8");

  console.log(`Report: ${outPath}`);
  console.log(`Items to review: ${items?.length ?? 0}`);
  console.log(`Open the file in your browser to start reviewing.`);
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeJson(v: unknown): string {
  return JSON.stringify(v)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

function formatDuration(iso: string): string {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return "";
  const h = parseInt(m[1] ?? "0", 10);
  const min = parseInt(m[2] ?? "0", 10);
  const s = parseInt(m[3] ?? "0", 10);
  if (h > 0) return `${h}:${String(min).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${min}:${String(s).padStart(2, "0")}`;
}

function renderCard(item: any): string {
  const dur = formatDuration(item.metadata?.duration ?? "");
  const date = item.raw_published_at
    ? new Date(item.raw_published_at).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
      })
    : "";
  const desc = (item.raw_description ?? "").slice(0, 200);

  return `<div class="card" id="card-${item.id}">
  <div class="card-thumb">
    <img src="${esc(item.thumbnail_url)}" alt="" loading="lazy" onerror="autoRejectBroken('${item.id}')" />
  </div>
  <div class="card-body">
    <div class="card-title">
      <a href="${esc(item.source_url)}" target="_blank" rel="noopener">${esc(item.raw_title ?? "(no title)")}</a>
    </div>
    <div class="card-meta">
      <span>${esc(item.raw_author ?? "")}</span>
      ${date ? `<span>${date}</span>` : ""}
      ${dur ? `<span class="badge">${dur}</span>` : ""}
    </div>
    ${desc ? `<div class="card-desc">${esc(desc)}</div>` : ""}
    <div class="card-actions">
      <a class="btn btn-open" href="${esc(item.source_url)}" target="_blank" rel="noopener">Open ↗</a>
      <button class="btn btn-details" onclick="openDetails('${item.id}')">⋯ Details</button>
      <button class="btn btn-approve" id="approve-${item.id}" onclick="quickApprove('${item.id}')">✓ Approve</button>
      <button class="btn btn-reject" id="reject-${item.id}" onclick="reject('${item.id}')">✕ Reject</button>
    </div>
  </div>
</div>`;
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  video: "Videos",
  case_study: "Cases",
  article: "Articles",
  image: "Images",
};

function contentTypeLabel(t: string): string {
  return (
    CONTENT_TYPE_LABELS[t] ??
    t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, " ") + "s"
  );
}

function buildHtml(
  items: any[],
  existingCategories: string[],
  contentTypes: string[],
  supabaseUrl: string,
  serviceKey: string,
  telegramBotToken: string,
  telegramChannelId: string,
): string {
  const generatedAt = new Date().toLocaleString();
  const defaultCategories = ["AI Tools", "Design", "UX", "Tutorial", "Case Study", "News", "Tool"];
  const allCategories = [...new Set([...existingCategories, ...defaultCategories])].sort();

  const itemsMap = Object.fromEntries(items.map((i) => [i.id, i]));

  return `<!DOCTYPE html>
<!-- LOCAL USE ONLY — contains Supabase service role key. Do not share or deploy. -->
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>DesAIgn Review Queue (${items.length})</title>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"><\/script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f4f4f4; color: #111; min-height: 100vh; padding-bottom: 80px; }

    .header { background: #111; color: #fff; padding: 18px 32px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 10; }
    .header h1 { font-size: 16px; font-weight: 700; letter-spacing: -0.2px; }
    .header-meta { font-size: 12px; color: #888; }
    #queue-count { font-weight: 600; color: #fff; }

    .container { max-width: 820px; margin: 28px auto; padding: 0 20px; }
    .empty { text-align: center; padding: 80px 0; color: #999; font-size: 15px; }

    .card { background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.07); display: flex; overflow: hidden; margin-bottom: 14px; transition: opacity 0.35s, max-height 0.4s, border-left 0.15s; max-height: 200px; border-left: 4px solid transparent; }
    .card.removing { opacity: 0; max-height: 0; margin-bottom: 0; pointer-events: none; }
    .card.card-queued { border-left: 4px solid #16a34a; }
    .card.card-rejected { border-left: 4px solid #dc2626; opacity: 0.55; }

    .card-thumb { flex-shrink: 0; width: 192px; background: #111; }
    .card-thumb img { width: 192px; height: 108px; object-fit: cover; display: block; }

    .card-body { flex: 1; padding: 14px 18px; display: flex; flex-direction: column; gap: 5px; min-width: 0; }
    .card-title { font-size: 14px; font-weight: 600; line-height: 1.4; }
    .card-title a { color: #111; text-decoration: none; }
    .card-title a:hover { text-decoration: underline; }
    .card-meta { font-size: 12px; color: #999; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
    .badge { background: #f0f0f0; border-radius: 4px; padding: 1px 6px; font-size: 11px; color: #666; }
    .card-desc { font-size: 12px; color: #666; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .card-actions { margin-top: auto; display: flex; gap: 7px; padding-top: 6px; }

    .btn { border: none; border-radius: 7px; padding: 6px 13px; font-size: 12px; font-weight: 600; cursor: pointer; transition: opacity 0.15s; white-space: nowrap; }
    .btn:hover:not(:disabled) { opacity: 0.82; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-open { background: #f0f0f0; color: #555; text-decoration: none; display: inline-flex; align-items: center; }
    .btn-details { background: #f0f0f0; color: #555; }
    .btn-approve { background: #16a34a; color: #fff; }
    .btn-reject { background: #dc2626; color: #fff; }
    .btn-cancel { background: #f0f0f0; color: #555; }
    .btn-publish { background: #111; color: #fff; }

    .btn-select-all { background: #2563eb; color: #fff; font-size: 12px; padding: 6px 14px; border-radius: 7px; border: none; cursor: pointer; font-weight: 600; transition: opacity 0.15s; }
    .btn-select-all:hover { opacity: 0.82; }
    .btn-select-all.active { background: #374151; }

    .run-bar { display: none; position: fixed; bottom: 0; left: 0; right: 0; background: #111; color: #fff; padding: 14px 32px; align-items: center; justify-content: space-between; z-index: 50; border-top: 1px solid #333; }
    .run-bar.visible { display: flex; }
    .run-bar-summary { font-size: 13px; color: #aaa; }
    .run-bar-summary strong { color: #fff; }

    .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 100; align-items: center; justify-content: center; }
    .modal-overlay.open { display: flex; }
    .modal { background: #fff; border-radius: 16px; padding: 28px 30px; width: 100%; max-width: 500px; max-height: 92vh; overflow-y: auto; box-shadow: 0 24px 64px rgba(0,0,0,0.22); }
    .modal h2 { font-size: 16px; font-weight: 700; margin-bottom: 18px; }
    .modal-thumb { width: 100%; border-radius: 8px; max-height: 160px; object-fit: cover; margin-bottom: 16px; background: #f0f0f0; }

    .field { margin-bottom: 13px; }
    .field label { display: block; font-size: 11px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; }
    .field input, .field textarea { width: 100%; border: 1.5px solid #e4e4e4; border-radius: 8px; padding: 9px 11px; font-size: 14px; font-family: inherit; color: #111; outline: none; transition: border-color 0.15s; }
    .field input:focus, .field textarea:focus { border-color: #111; }
    .field textarea { resize: vertical; min-height: 85px; line-height: 1.5; }
    .modal-actions { display: flex; gap: 9px; justify-content: flex-end; margin-top: 18px; }

    .toast { position: fixed; bottom: 70px; right: 22px; background: #111; color: #fff; padding: 11px 18px; border-radius: 9px; font-size: 13px; font-weight: 500; z-index: 200; opacity: 0; transform: translateY(6px); transition: all 0.22s; pointer-events: none; }
    .toast.show { opacity: 1; transform: translateY(0); }
    .toast.error { background: #dc2626; }

    /* Tabs */
    .tabs { display: flex; gap: 4px; padding: 0 32px; background: #111; border-top: 1px solid #1f1f1f; }
    .tab { background: transparent; color: #888; border: none; padding: 11px 20px; font-size: 13px; font-weight: 600; cursor: pointer; border-bottom: 2px solid transparent; font-family: inherit; }
    .tab:hover { color: #ddd; }
    .tab.active { color: #fff; border-bottom-color: #fff; }
    .tab-panel { display: none; }
    .tab-panel.active { display: block; }

    /* X Post Builder */
    .x-container { max-width: 820px; margin: 28px auto; padding: 0 20px; }
    .x-card { background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.07); padding: 22px 26px; margin-bottom: 16px; }
    .x-mode-row { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; flex-wrap: wrap; }
    .x-mode-row label { font-size: 13px; color: #444; font-weight: 600; }
    .x-mode-row select { border: 1.5px solid #e4e4e4; border-radius: 7px; padding: 6px 9px; font-size: 13px; font-family: inherit; }
    .x-status { font-size: 12px; color: #666; margin-left: auto; }
    .x-status strong { color: #111; }
    .x-status.warn strong { color: #dc2626; }

    .x-source-section { margin-top: 14px; }
    .x-source-section h3 { font-size: 11px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .x-row { display: flex; align-items: center; gap: 11px; padding: 8px 4px; border-bottom: 1px solid #f0f0f0; }
    .x-row:last-child { border-bottom: none; }
    .x-row input[type=checkbox] { width: 16px; height: 16px; cursor: pointer; flex-shrink: 0; }
    .x-row.disabled { opacity: 0.5; }
    .x-row-thumb { width: 64px; height: 36px; object-fit: cover; border-radius: 4px; background: #f0f0f0; flex-shrink: 0; }
    .x-row-info { flex: 1; min-width: 0; }
    .x-row-title { font-size: 13px; font-weight: 600; color: #111; line-height: 1.35; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; }
    .x-row-meta { font-size: 11px; color: #888; margin-top: 2px; }

    .x-preview-card { background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.07); padding: 22px 26px; }
    .x-preview-card h3 { font-size: 11px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
    .x-preview-cover { width: 100%; max-height: 260px; object-fit: cover; border-radius: 8px; margin-bottom: 14px; background: #f0f0f0; display: block; }
    .x-preview-cover-empty { width: 100%; height: 120px; background: #f4f4f4; border-radius: 8px; margin-bottom: 14px; display: flex; align-items: center; justify-content: center; color: #999; font-size: 12px; }
    .x-text { width: 100%; min-height: 220px; border: 1.5px solid #e4e4e4; border-radius: 8px; padding: 12px 14px; font-size: 13px; line-height: 1.55; font-family: inherit; resize: vertical; outline: none; }
    .x-text:focus { border-color: #111; }
    .x-actions { display: flex; gap: 9px; justify-content: flex-end; margin-top: 14px; }
    .x-char-count { font-size: 11px; color: #888; margin-right: auto; align-self: center; }
    .x-char-count.over { color: #dc2626; font-weight: 600; }
    .btn-copy { background: #111; color: #fff; }
    .btn-reset { background: #f0f0f0; color: #555; }
    .x-empty { text-align: center; padding: 60px 0; color: #999; font-size: 14px; }
  </style>
</head>
<body>

<div class="header">
  <h1>DesAIgn Review Queue</h1>
  <div style="display:flex;align-items:center;gap:16px;">
    <label class="header-meta" style="display:flex;align-items:center;gap:8px;color:#aaa;">
      Freshness:
      <select id="freshness-filter" onchange="applyFilters()" style="background:#1f1f1f;color:#fff;border:1px solid #333;border-radius:6px;padding:4px 8px;font-size:12px;font-family:inherit;cursor:pointer;">
        <option value="1">1 day</option>
        <option value="3">3 days</option>
        <option value="7" selected>7 days</option>
        <option value="14">14 days</option>
        <option value="30">30 days</option>
        <option value="all">All time</option>
      </select>
    </label>
    <label class="header-meta" style="display:flex;align-items:center;gap:8px;color:#aaa;">
      Per source:
      <select id="limit-filter" onchange="applyFilters()" style="background:#1f1f1f;color:#fff;border:1px solid #333;border-radius:6px;padding:4px 8px;font-size:12px;font-family:inherit;cursor:pointer;" title="Max items per channel (YouTube) or per studio">
        <option value="3">3</option>
        <option value="5" selected>5</option>
        <option value="10">10</option>
        <option value="20">20</option>
        <option value="all">All</option>
      </select>
    </label>
    <label class="header-meta" style="display:flex;align-items:center;gap:8px;color:#aaa;">
      Sort:
      <select id="sort-order" onchange="applyFilters()" style="background:#1f1f1f;color:#fff;border:1px solid #333;border-radius:6px;padding:4px 8px;font-size:12px;font-family:inherit;cursor:pointer;">
        <option value="newest" selected>Newest first</option>
        <option value="oldest">Oldest first</option>
      </select>
    </label>
    ${
      contentTypes.length > 0
        ? `<div class="header-meta type-filter" style="display:flex;align-items:center;gap:10px;color:#aaa;flex-wrap:wrap;">
      Show:
      ${contentTypes
        .map(
          (t) => `<label style="display:inline-flex;align-items:center;gap:5px;cursor:pointer;color:#ddd;font-size:12px;">
        <input type="checkbox" class="type-cb" value="${esc(t)}" checked onchange="applyFilters()" style="cursor:pointer;" />${esc(contentTypeLabel(t))}
      </label>`
        )
        .join("")}
    </div>`
        : ""
    }
    <button class="btn-select-all" id="select-all-btn" onclick="selectAll()">Select All</button>
    <span class="header-meta"><span id="queue-count">${items.length}</span> / <span id="queue-total">${items.length}</span> items · ${generatedAt}</span>
  </div>
</div>

<div class="tabs">
  <button class="tab active" id="tab-review" onclick="switchTab('review')">Review queue</button>
  <button class="tab" id="tab-x" onclick="switchTab('x')">X post</button>
</div>

<div class="tab-panel active" id="panel-review">
  <div class="container" id="queue">
    ${
      items.length === 0
        ? '<div class="empty">No new items to review.</div>'
        : items.map(renderCard).join("\n  ")
    }
  </div>

  <div class="run-bar" id="run-bar">
    <span class="run-bar-summary" id="run-summary"></span>
    <button class="btn btn-publish" id="run-btn" onclick="runAll()">Run all →</button>
  </div>
</div>

<div class="tab-panel" id="panel-x">
  <div class="x-container">
    ${items.length === 0 ? '<div class="x-empty">No collected items yet — run the collector first.</div>' : `
    <div class="x-preview-card">
      <h3>X post preview</h3>
      <div id="x-cover-wrap"></div>
      <textarea class="x-text" id="x-text" oninput="updateCharCount()"></textarea>
      <div class="x-actions">
        <span class="x-char-count" id="x-char-count">0 / 280</span>
        <button class="btn btn-reset" onclick="rebuildXText()">Reset text</button>
        <button class="btn btn-copy" onclick="copyXPost()">Copy to clipboard</button>
      </div>
    </div>

    <div class="x-card" style="margin-top:16px;">
      <div class="x-mode-row">
        <label for="x-mode">Selection:</label>
        <select id="x-mode" onchange="renderXPanel()">
          <option value="auto">Auto (newest 2 YouTube + 1 studio)</option>
          <option value="manual">Manual (pick from list)</option>
        </select>
        <span class="x-status" id="x-status"></span>
      </div>
      <div id="x-source-list"></div>
    </div>
    `}
  </div>
</div>

<div class="modal-overlay" id="modal-overlay">
  <div class="modal">
    <h2>Edit details</h2>
    <img id="modal-thumb" class="modal-thumb" src="" alt="" />
    <form id="approve-form">
      <input type="hidden" id="f-raw-id" />
      <input type="hidden" id="f-link" />
      <div class="field">
        <label>Title</label>
        <input type="text" id="f-title" required maxlength="200" />
      </div>
      <div class="field">
        <label>Summary</label>
        <textarea id="f-summary" maxlength="500" placeholder="Short original summary for the public feed…"></textarea>
      </div>
      <div class="field">
        <label>Category</label>
        <input type="text" id="f-category" required list="cat-list" placeholder="e.g. AI Tools" autocomplete="off" />
        <datalist id="cat-list">
          ${allCategories.map((c) => `<option value="${esc(c)}">`).join("")}
        </datalist>
      </div>
      <div class="field">
        <label>Thumbnail URL</label>
        <input type="url" id="f-thumbnail" required />
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-cancel" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-publish" id="publish-btn">Save to queue →</button>
      </div>
    </form>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
/* LOCAL USE ONLY — Supabase service role key embedded. Do not share or deploy. */
const SUPABASE_URL = ${safeJson(supabaseUrl)};
const SUPABASE_KEY = ${safeJson(serviceKey)};
const ITEMS_MAP = ${safeJson(itemsMap)};
const TELEGRAM_BOT_TOKEN = ${safeJson(telegramBotToken)};
const TELEGRAM_CHANNEL_ID = ${safeJson(telegramChannelId)};

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let remaining = ${items.length};

// queue[rawId] = { action: 'approve', postData: {...} } | { action: 'reject' }
const queue = {};

function updateCount() {
  document.getElementById("queue-count").textContent = remaining;
  document.title = "DesAIgn Review Queue (" + remaining + ")";
}

function updateRunBar() {
  const approvals = Object.values(queue).filter(function(q) { return q.action === 'approve'; }).length;
  const rejections = Object.values(queue).filter(function(q) { return q.action === 'reject'; }).length;
  const bar = document.getElementById('run-bar');
  const summary = document.getElementById('run-summary');
  if (approvals + rejections === 0) {
    bar.classList.remove('visible');
  } else {
    bar.classList.add('visible');
    const parts = [];
    if (approvals) parts.push('<strong>' + approvals + '</strong> to publish');
    if (rejections) parts.push('<strong>' + rejections + '</strong> to delete');
    summary.innerHTML = parts.join(' &nbsp;·&nbsp; ');
  }
}

function showToast(msg, isErr) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "toast show" + (isErr ? " error" : "");
  clearTimeout(el._t);
  el._t = setTimeout(function() { el.className = "toast"; }, 3200);
}

function removeCard(id) {
  const card = document.getElementById("card-" + id);
  if (!card) return;
  card.classList.add("removing");
  remaining = Math.max(0, remaining - 1);
  updateCount();
  setTimeout(function() {
    card.remove();
    if (remaining === 0) {
      document.getElementById("queue").innerHTML = '<div class="empty">All done! Queue is empty.</div>';
    }
  }, 420);
}

function buildAutoPostData(item) {
  var category = guessCategory(item.raw_title, item.raw_description);
  return {
    title: (item.raw_title || '').trim(),
    summary: (item.raw_description || '').slice(0, 300).trim(),
    category: category,
    thumbnail_url: (item.thumbnail_url || '').trim(),
    link: item.source_url,
    source: item.source || 'Unknown',
  };
}

// Quick approve: toggle queued state without opening the modal.
// Uses auto-guessed defaults (same heuristic as Select All).
function quickApprove(id) {
  var card = document.getElementById('card-' + id);
  var btn = document.getElementById('approve-' + id);

  // If already queued for approval, un-queue.
  if (queue[id] && queue[id].action === 'approve') {
    delete queue[id];
    autoQueuedIds = autoQueuedIds.filter(function(i) { return i !== id; });
    if (card) card.classList.remove('card-queued');
    if (btn) btn.textContent = '✓ Approve';
    updateRunBar();
    return;
  }

  // If currently rejected, clear that state first.
  if (queue[id] && queue[id].action === 'reject') {
    if (card) card.classList.remove('card-rejected');
    var rejectBtn = document.getElementById('reject-' + id);
    if (rejectBtn) rejectBtn.textContent = '✕ Reject';
  }

  var item = ITEMS_MAP[id];
  if (!item) return;
  queue[id] = { action: 'approve', postData: buildAutoPostData(item), _auto: true };

  if (card) {
    card.classList.remove('card-rejected');
    card.classList.add('card-queued');
  }
  if (btn) btn.textContent = '✓ Queued';
  updateRunBar();
}

// Details: open the modal to edit fields before queuing (or to edit
// the values of an already-queued item).
function openDetails(id) {
  const item = ITEMS_MAP[id];
  if (!item) return;
  // Pre-fill with existing queued values if they exist, else item defaults.
  var existing = queue[id] && queue[id].action === 'approve' ? queue[id].postData : null;
  document.getElementById("f-raw-id").value = item.id;
  document.getElementById("f-link").value = existing ? existing.link : item.source_url;
  document.getElementById("f-title").value = existing ? existing.title : (item.raw_title || "");
  document.getElementById("f-summary").value = existing ? existing.summary : (item.raw_description || "").slice(0, 300);
  document.getElementById("f-category").value = existing
    ? existing.category
    : (item.content_type === "case_study" ? "Case Study" : guessCategory(item.raw_title, item.raw_description));
  document.getElementById("f-thumbnail").value = existing ? existing.thumbnail_url : (item.thumbnail_url || "");
  document.getElementById("modal-thumb").src = item.thumbnail_url || "";
  document.getElementById("modal-overlay").classList.add("open");
  setTimeout(function() { document.getElementById("f-title").focus(); }, 50);
}

function closeModal() {
  document.getElementById("modal-overlay").classList.remove("open");
}

document.getElementById("modal-overlay").addEventListener("click", function(e) {
  if (e.target === this) closeModal();
});

document.addEventListener("keydown", function(e) {
  if (e.key === "Escape") closeModal();
});

// Save to queue (no Supabase call yet)
document.getElementById("approve-form").addEventListener("submit", function(e) {
  e.preventDefault();
  const rawId = document.getElementById("f-raw-id").value;
  const rawItem = ITEMS_MAP[rawId];
  const postData = {
    title: document.getElementById("f-title").value.trim(),
    summary: document.getElementById("f-summary").value.trim(),
    category: document.getElementById("f-category").value.trim(),
    thumbnail_url: document.getElementById("f-thumbnail").value.trim(),
    link: document.getElementById("f-link").value,
    source: rawItem ? rawItem.source : "Unknown",
  };

  queue[rawId] = { action: 'approve', postData: postData };

  const card = document.getElementById('card-' + rawId);
  if (card) {
    card.classList.remove('card-rejected');
    card.classList.add('card-queued');
    const btn = card.querySelector('.btn-approve');
    if (btn) btn.textContent = '✓ Queued';
    const rejectBtn = document.getElementById('reject-' + rawId);
    if (rejectBtn) rejectBtn.textContent = '✕ Reject';
  }

  closeModal();
  updateRunBar();
  showToast('Queued for publishing ✓');
});

function reject(id) {
  const card = document.getElementById('card-' + id);
  const btn = document.getElementById('reject-' + id);

  if (queue[id] && queue[id].action === 'reject') {
    // Un-reject
    delete queue[id];
    if (card) card.classList.remove('card-rejected');
    if (btn) btn.textContent = '✕ Reject';
  } else {
    // If currently queued for approval, clear that state first
    if (queue[id] && queue[id].action === 'approve') {
      autoQueuedIds = autoQueuedIds.filter(function(i) { return i !== id; });
      if (card) card.classList.remove('card-queued');
      const approveBtn = card ? card.querySelector('.btn-approve') : null;
      if (approveBtn) approveBtn.textContent = '✓ Approve';
    }
    queue[id] = { action: 'reject' };
    if (card) { card.classList.add('card-rejected'); }
    if (btn) btn.textContent = '↩ Undo';
  }

  updateRunBar();
}

async function sendToTelegram(post, postId) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHANNEL_ID) return;

  const siteUrl = "https://desaign-radar.vercel.app";
  const escHtml = function(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); };
  const caption =
    "<b>" + escHtml(post.title) + "</b>" +
    (post.summary ? "\\n\\n" + escHtml(post.summary) : "") +
    "\\n\\nSource: " + (post.source || "Link") + " · " + (post.category || "Design + AI") +
    "\\nLink: " + post.link +
    "\\n\\nDesAIgn Radar: " + siteUrl;

  const hasThumbnail = Boolean(post.thumbnail_url);
  const method = hasThumbnail ? "sendPhoto" : "sendMessage";
  const apiUrl = "https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/" + method;
  const body = hasThumbnail
    ? { chat_id: TELEGRAM_CHANNEL_ID, photo: post.thumbnail_url, caption: caption, parse_mode: "HTML" }
    : { chat_id: TELEGRAM_CHANNEL_ID, text: caption, parse_mode: "HTML", disable_web_page_preview: false };

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.description || "Telegram API error");
    await sb.from("posts").update({ telegram_sent: true }).eq("id", postId);
  } catch (err) {
    showToast("Published ✓ — Telegram failed: " + err.message, true);
  }
}

async function executeApprove(id, postData) {
  try {
    const { data: inserted, error: ie } = await sb.from("posts").insert([postData]).select("id").single();
    if (ie) throw new Error("Insert to posts failed: " + ie.message);

    const { error: ue } = await sb.from("raw_items").update({
      status: "approved",
      processed_post_id: inserted.id,
    }).eq("id", id);
    if (ue) throw new Error("Update raw_items failed: " + ue.message);

    await sendToTelegram(postData, inserted.id);
    delete queue[id];
    removeCard(id);
  } catch (err) {
    showToast(err.message, true);
  }
}

async function executeReject(id) {
  const { error } = await sb.from("raw_items").update({ status: "rejected" }).eq("id", id);
  if (error) {
    showToast("Reject failed: " + error.message, true);
    return;
  }
  delete queue[id];
  removeCard(id);
}

// Image failed to load → auto-reject so the broken card disappears from view.
const _brokenHandled = {};
async function autoRejectBroken(id) {
  if (_brokenHandled[id]) return;
  _brokenHandled[id] = true;
  delete queue[id]; // drop any pending approve/reject queue entry
  try {
    await sb.from("raw_items").update({
      status: "rejected",
      notes: "Auto-rejected: broken thumbnail (404 / load error)",
    }).eq("id", id);
  } catch (_) { /* best-effort */ }
  removeCard(id);
}

// Keyword-based category guesser — no AI, pure heuristics
function guessCategory(title, desc) {
  var text = ((title || '') + ' ' + (desc || '')).toLowerCase();

  // Tutorial: how-to, step-by-step, course, workshop
  if (/\bhow[\s-]to\b|tutorial|step[\s-]by[\s-]step|\bbeginner\b|\blearn\b|\bguide\b|\bcourse\b|walkthrough|masterclass|workshop|getting[\s-]started|deep[\s-]dive|\bexplained\b|\btips\b|\btricks\b/.test(text)) return 'Tutorial';

  // Case Study: analysis, behind the scenes, retrospective
  if (/case[\s-]study|redesign|behind[\s-]the[\s-]scenes|how we built|our process|lessons learned|retrospective|postmortem/.test(text)) return 'Case Study';

  // News: hiring, funding, product launches, announcements
  if (/\bhir(es|ing|ed)\b|rais(es|ed) \$|funding|acqui(res|red|sition)|launch(es|ed)|announc(es|ed)|introduc(es|ed)|new feature|\brelease\b|\bversus\b|\bvs\b|\breport\b/.test(text)) return 'News';

  // UX: user experience, research, accessibility
  if (/\bux\b|user[\s-]experience|user[\s-]research|usability|accessibility|\ba11y\b|interaction[\s-]design|\bprototype\b|\bwireframe\b|\bpersona\b|journey[\s-]map|information[\s-]architecture/.test(text)) return 'UX';

  // AI Tools: generative AI, specific models/tools
  if (/\bai\b|chatgpt|midjourney|stable[\s-]diffusion|\bgenerative\b|\bllm\b|\bgpt[\s-]?\d|\bartificial[\s-]intelligence|machine[\s-]learning|\bclaude\b|\bgemini\b|\bcopilot\b|dall[\s-]?e|\bsora\b|\brunway\b|\bflux\b|\bdiffusion\b|\bneural\b/.test(text)) return 'AI Tools';

  // Design: design tools, typography, layout, branding
  if (/\bdesign\b|\bfigma\b|\badobe\b|typography|typeface|\bcolor\b|\bcolour\b|\blayout\b|\bgrid\b|\bbranding\b|\blogo\b|\bvisual\b|\bgraphic\b|ui[\s-]kit|\bcomponent\b|\bicon\b|illustration|\bmotion\b|\banimation\b/.test(text)) return 'Design';

  // Tool: software, plugins, platforms
  if (/\btool\b|\bplugin\b|\bextension\b|\bapp\b|\bsoftware\b|\bplatform\b|\bresource\b|\blibrary\b|\bframework\b|\bsdk\b|\bapi\b/.test(text)) return 'Tool';

  return 'Design'; // default fallback
}

var selectAllActive = false;
var autoQueuedIds = [];

function selectAll() {
  var btn = document.getElementById('select-all-btn');

  if (selectAllActive) {
    // Deselect: remove only auto-queued items
    autoQueuedIds.forEach(function(id) {
      if (queue[id] && queue[id]._auto) {
        delete queue[id];
        var card = document.getElementById('card-' + id);
        if (card) card.classList.remove('card-queued');
        var approveBtn = card ? card.querySelector('.btn-approve') : null;
        if (approveBtn) approveBtn.textContent = '✓ Approve';
      }
    });
    autoQueuedIds = [];
    selectAllActive = false;
    btn.textContent = 'Select All';
    btn.classList.remove('active');
    updateRunBar();
    return;
  }

  // Select all items not already in queue and not rejected,
  // and limit to what's currently visible under the freshness/per-source filter.
  var newIds = [];
  Object.keys(ITEMS_MAP).forEach(function(id) {
    if (queue[id]) return; // already manually queued/rejected — skip
    var item = ITEMS_MAP[id];
    var card = document.getElementById('card-' + id);
    if (!card || card.classList.contains('removing')) return;
    if (card.style.display === 'none') return; // skip filtered-out items

    var category = guessCategory(item.raw_title, item.raw_description);
    var postData = {
      title: (item.raw_title || '').trim(),
      summary: (item.raw_description || '').slice(0, 300).trim(),
      category: category,
      thumbnail_url: (item.thumbnail_url || '').trim(),
      link: item.source_url,
      source: item.source || 'Unknown',
    };

    queue[id] = { action: 'approve', postData: postData, _auto: true };
    card.classList.remove('card-rejected');
    card.classList.add('card-queued');
    var approveBtn = card.querySelector('.btn-approve');
    if (approveBtn) approveBtn.textContent = '✓ Queued';
    newIds.push(id);
  });

  autoQueuedIds = newIds;
  selectAllActive = true;
  btn.textContent = 'Deselect All';
  btn.classList.add('active');
  updateRunBar();
  showToast('Queued ' + newIds.length + ' items with auto-tags ✓');
}

async function runAll() {
  const btn = document.getElementById('run-btn');
  btn.disabled = true;
  btn.textContent = 'Running…';

  const entries = Object.entries(queue);
  const approvals = entries.filter(function(e) { return e[1].action === 'approve'; });
  const rejections = entries.filter(function(e) { return e[1].action === 'reject'; });

  for (var i = 0; i < approvals.length; i++) {
    await executeApprove(approvals[i][0], approvals[i][1].postData);
  }
  for (var j = 0; j < rejections.length; j++) {
    await executeReject(rejections[j][0]);
  }

  updateRunBar();
  if (Object.keys(queue).length === 0) showToast('All done ✓');
  btn.disabled = false;
  btn.textContent = 'Run all →';

  // After clearing the current batch, re-apply the filter so the next set
  // of items in each per-source bucket becomes visible.
  setTimeout(function() {
    selectAllActive = false;
    var sab = document.getElementById('select-all-btn');
    if (sab) { sab.textContent = 'Select All'; sab.classList.remove('active'); }
    autoQueuedIds = [];
    applyFilters();
  }, 500);
}

/* -------- Filters: freshness + per-source + sort + content type -------- */

function itemTimestampMs(item) {
  // Prefer raw_published_at; fall back to created_at (e.g. for studios with no publish date).
  var t = item.raw_published_at ? Date.parse(item.raw_published_at) : NaN;
  if (!isFinite(t)) t = item.created_at ? Date.parse(item.created_at) : NaN;
  return isFinite(t) ? t : 0;
}

function sourceBucket(item) {
  // YouTube items group by channel; studio items group by studio name (the source field).
  if ((item.source || '').toLowerCase() === 'youtube') {
    var meta = item.metadata || {};
    return 'yt::' + (meta.channel_url || meta.channel_name || item.raw_author || 'unknown');
  }
  return 'studio::' + (item.source || 'unknown');
}

function selectedContentTypes() {
  var cbs = document.querySelectorAll('.type-cb');
  if (!cbs.length) return null; // no filter UI → allow all
  var set = {};
  cbs.forEach(function(cb) { if (cb.checked) set[cb.value] = true; });
  return set;
}

function applyFilters() {
  var sel = document.getElementById('freshness-filter');
  var lim = document.getElementById('limit-filter');
  var sort = document.getElementById('sort-order');
  if (!sel || !lim) return;
  var val = sel.value;
  var cutoffMs = val === 'all' ? -Infinity : Date.now() - parseInt(val, 10) * 86400000;
  var perSource = lim.value === 'all' ? Infinity : parseInt(lim.value, 10);
  var sortDir = sort && sort.value === 'oldest' ? 1 : -1;
  var allowedTypes = selectedContentTypes();

  // Step 1: filter out stale, removed, or type-unchecked items.
  var fresh = [];
  Object.values(ITEMS_MAP).forEach(function(item) {
    var card = document.getElementById('card-' + item.id);
    if (!card) return;
    if (card.classList.contains('removing')) return;
    if (allowedTypes && item.content_type && !allowedTypes[item.content_type]) {
      card.style.display = 'none';
      return;
    }
    var ts = itemTimestampMs(item);
    if (ts >= cutoffMs) fresh.push({ item: item, card: card, ts: ts });
    else card.style.display = 'none';
  });

  // Step 2: bucket by source, sort newest first within bucket, cap to perSource.
  var buckets = {};
  fresh.forEach(function(entry) {
    var key = sourceBucket(entry.item);
    (buckets[key] = buckets[key] || []).push(entry);
  });

  var visible = [];
  Object.keys(buckets).forEach(function(key) {
    var arr = buckets[key];
    arr.sort(function(a, b) { return b.ts - a.ts; });
    arr.slice(0, perSource).forEach(function(entry) { visible.push(entry); });
  });

  var visibleIds = {};
  visible.forEach(function(entry) { visibleIds[entry.item.id] = true; });

  // Step 3: hide non-visible.
  fresh.forEach(function(entry) {
    if (!visibleIds[entry.item.id]) entry.card.style.display = 'none';
  });

  // Step 4: sort visible by selected direction and reorder DOM.
  visible.sort(function(a, b) { return sortDir * (b.ts - a.ts); });
  var queueDiv = document.getElementById('queue');
  visible.forEach(function(entry) {
    entry.card.style.display = '';
    queueDiv.appendChild(entry.card); // moves the node to the end in order
  });

  remaining = visible.length;
  updateCount();

  // Keep the X tab in sync if it's currently rendered.
  if (document.getElementById('panel-x') && document.getElementById('panel-x').classList.contains('active')) {
    renderXPanel();
  }

  var existingEmpty = queueDiv.querySelector('.empty.filter-empty');
  if (visible.length === 0 && Object.keys(ITEMS_MAP).length > 0) {
    if (!existingEmpty) {
      var d = document.createElement('div');
      d.className = 'empty filter-empty';
      d.textContent = 'No items in this freshness window. Try widening it ↑';
      queueDiv.appendChild(d);
    }
  } else if (existingEmpty) {
    existingEmpty.remove();
  }
}

// Apply default freshness on initial render so the user sees only fresh items.
window.addEventListener('DOMContentLoaded', applyFilters);

/* -------- Tabs + X post builder -------- */

const SITE_URL = "https://desaign-radar.vercel.app";
const X_HEADER = "Design + AI roundup — this week on DesAIgn Radar";
const X_FOOTER_PREFIX = "More: ";
const X_TARGET_YT = 2;
const X_TARGET_STUDIOS = 1;

const xSelected = {}; // id -> true

function switchTab(name) {
  document.getElementById('tab-review').classList.toggle('active', name === 'review');
  document.getElementById('tab-x').classList.toggle('active', name === 'x');
  document.getElementById('panel-review').classList.toggle('active', name === 'review');
  document.getElementById('panel-x').classList.toggle('active', name === 'x');
  if (name === 'x') renderXPanel();
}

function isYouTube(item) {
  return (item.source || '').toLowerCase() === 'youtube';
}

function isStudio(item) {
  return !isYouTube(item);
}

function getActiveItems() {
  // Items still visible in the review queue: not removed via approve/reject
  // AND not hidden by the freshness filter.
  return Object.values(ITEMS_MAP).filter(function(it) {
    var card = document.getElementById('card-' + it.id);
    if (!card) return false;
    if (card.classList.contains('removing')) return false;
    if (card.style.display === 'none') return false;
    return true;
  });
}

function sortNewestFirst(arr) {
  return arr.slice().sort(function(a, b) {
    var da = a.raw_published_at ? Date.parse(a.raw_published_at) : 0;
    var db = b.raw_published_at ? Date.parse(b.raw_published_at) : 0;
    return db - da;
  });
}

function autoPickIds() {
  var items = getActiveItems();
  var yt = sortNewestFirst(items.filter(isYouTube)).slice(0, X_TARGET_YT);
  var st = sortNewestFirst(items.filter(isStudio)).slice(0, X_TARGET_STUDIOS);
  return yt.concat(st).map(function(i) { return i.id; });
}

function renderXPanel() {
  var listEl = document.getElementById('x-source-list');
  if (!listEl) return; // empty state
  var mode = document.getElementById('x-mode').value;
  var items = getActiveItems();

  if (mode === 'auto') {
    // Reset selection to auto-pick
    for (var k in xSelected) delete xSelected[k];
    autoPickIds().forEach(function(id) { xSelected[id] = true; });
  }

  var yt = sortNewestFirst(items.filter(isYouTube));
  var st = sortNewestFirst(items.filter(isStudio));

  var html = '';
  if (yt.length) {
    html += '<div class="x-source-section"><h3>YouTube · target ' + X_TARGET_YT + '</h3>';
    yt.forEach(function(it) { html += renderXRow(it, mode); });
    html += '</div>';
  }
  if (st.length) {
    html += '<div class="x-source-section"><h3>Design Studios · target ' + X_TARGET_STUDIOS + '</h3>';
    st.forEach(function(it) { html += renderXRow(it, mode); });
    html += '</div>';
  }
  if (!yt.length && !st.length) {
    html = '<div class="x-empty">No items available.</div>';
  }
  listEl.innerHTML = html;

  updateXStatus();
  rebuildXText();
}

function renderXRow(item, mode) {
  var checked = xSelected[item.id] ? 'checked' : '';
  var disabled = mode === 'auto' ? 'disabled' : '';
  var date = item.raw_published_at
    ? new Date(item.raw_published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';
  var thumb = item.thumbnail_url
    ? '<img class="x-row-thumb" src="' + escAttr(item.thumbnail_url) + '" alt="" loading="lazy" />'
    : '<div class="x-row-thumb"></div>';
  return '<label class="x-row ' + (mode === 'auto' ? 'disabled' : '') + '">'
    + '<input type="checkbox" data-id="' + escAttr(item.id) + '" ' + checked + ' ' + disabled + ' onchange="onXToggle(this)" />'
    + thumb
    + '<div class="x-row-info">'
    +   '<div class="x-row-title">' + escHtml(item.raw_title || '(no title)') + '</div>'
    +   '<div class="x-row-meta">' + escHtml(item.source || '') + (date ? ' · ' + date : '') + '</div>'
    + '</div>'
    + '</label>';
}

function escHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escAttr(s) {
  return escHtml(s).replace(/"/g, '&quot;');
}

function onXToggle(cb) {
  var id = cb.getAttribute('data-id');
  if (cb.checked) xSelected[id] = true; else delete xSelected[id];
  updateXStatus();
  rebuildXText();
}

function selectedItemsOrdered() {
  // Up to 3 newest YouTube + up to 2 newest studios, in that order
  var items = getActiveItems().filter(function(i) { return xSelected[i.id]; });
  var yt = sortNewestFirst(items.filter(isYouTube)).slice(0, X_TARGET_YT);
  var st = sortNewestFirst(items.filter(isStudio)).slice(0, X_TARGET_STUDIOS);
  return yt.concat(st);
}

function updateXStatus() {
  var statusEl = document.getElementById('x-status');
  if (!statusEl) return;
  var items = getActiveItems().filter(function(i) { return xSelected[i.id]; });
  var ytCount = items.filter(isYouTube).length;
  var stCount = items.filter(isStudio).length;
  var ytUsed = Math.min(ytCount, X_TARGET_YT);
  var stUsed = Math.min(stCount, X_TARGET_STUDIOS);
  var total = ytUsed + stUsed;
  var over = (ytCount > X_TARGET_YT) || (stCount > X_TARGET_STUDIOS);
  statusEl.classList.toggle('warn', over);
  var note = over ? ' (extras ignored)' : '';
  statusEl.innerHTML = 'Using <strong>' + total + '</strong> · '
    + ytUsed + '/' + X_TARGET_YT + ' YT · '
    + stUsed + '/' + X_TARGET_STUDIOS + ' studios' + note;
}

function buildXText() {
  var picked = selectedItemsOrdered();
  if (picked.length === 0) return '';
  var lines = [X_HEADER, ''];
  picked.forEach(function(it, idx) {
    lines.push((idx + 1) + '. ' + (it.raw_title || '(no title)') + ' — ' + it.source_url);
  });
  lines.push('');
  lines.push(X_FOOTER_PREFIX + SITE_URL);
  return lines.join('\\n');
}

function rebuildXText() {
  var ta = document.getElementById('x-text');
  if (!ta) return;
  ta.value = buildXText();
  renderXCover();
  updateCharCount();
}

function renderXCover() {
  var wrap = document.getElementById('x-cover-wrap');
  if (!wrap) return;
  var picked = selectedItemsOrdered();
  var firstWithImage = picked.find(function(p) { return p.thumbnail_url; });
  if (firstWithImage) {
    wrap.innerHTML = '<img class="x-preview-cover" src="' + escAttr(firstWithImage.thumbnail_url) + '" alt="" />';
  } else {
    wrap.innerHTML = '<div class="x-preview-cover-empty">No cover image — select an item with a thumbnail</div>';
  }
}

function updateCharCount() {
  var ta = document.getElementById('x-text');
  var el = document.getElementById('x-char-count');
  if (!ta || !el) return;
  var n = ta.value.length;
  el.textContent = n + ' / 280';
  el.classList.toggle('over', n > 280);
}

async function copyXPost() {
  var ta = document.getElementById('x-text');
  if (!ta || !ta.value.trim()) {
    showToast('Nothing to copy — pick at least one item', true);
    return;
  }
  try {
    await navigator.clipboard.writeText(ta.value);
    showToast('Copied X post ✓');
  } catch (err) {
    ta.select();
    document.execCommand('copy');
    showToast('Copied X post ✓');
  }
}
<\/script>

</body>
</html>`;
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
