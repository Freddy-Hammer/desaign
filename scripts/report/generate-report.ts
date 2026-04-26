import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { getSupabase } from "../lib/supabase-client";

async function main() {
  const sb = getSupabase();

  const { data: items, error } = await sb
    .from("raw_items")
    .select("*")
    .eq("status", "new")
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

  const html = buildHtml(items ?? [], existingCategories, supabaseUrl, serviceKey, telegramBotToken, telegramChannelId);

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
    <img src="${esc(item.thumbnail_url)}" alt="" loading="lazy" onerror="this.parentElement.style.background='#1a1a1a'" />
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
      <button class="btn btn-approve" onclick="openApprove('${item.id}')">✓ Approve</button>
      <button class="btn btn-reject" id="reject-${item.id}" onclick="reject('${item.id}')">✕ Reject</button>
    </div>
  </div>
</div>`;
}

function buildHtml(
  items: any[],
  existingCategories: string[],
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
    .btn-approve { background: #16a34a; color: #fff; }
    .btn-reject { background: #dc2626; color: #fff; }
    .btn-cancel { background: #f0f0f0; color: #555; }
    .btn-publish { background: #111; color: #fff; }

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
  </style>
</head>
<body>

<div class="header">
  <h1>DesAIgn Review Queue</h1>
  <span class="header-meta"><span id="queue-count">${items.length}</span> items · ${generatedAt}</span>
</div>

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

<div class="modal-overlay" id="modal-overlay">
  <div class="modal">
    <h2>Queue for publishing</h2>
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

function openApprove(id) {
  // If already queued for approval, un-queue on click
  if (queue[id] && queue[id].action === 'approve') {
    delete queue[id];
    const card = document.getElementById('card-' + id);
    if (card) card.classList.remove('card-queued');
    const card2 = document.getElementById('card-' + id);
    const btn = card2 ? card2.querySelector('.btn-approve') : null;
    if (btn) btn.textContent = '✓ Approve';
    updateRunBar();
    return;
  }

  const item = ITEMS_MAP[id];
  if (!item) return;
  document.getElementById("f-raw-id").value = item.id;
  document.getElementById("f-link").value = item.source_url;
  document.getElementById("f-title").value = item.raw_title || "";
  document.getElementById("f-summary").value = (item.raw_description || "").slice(0, 300);
  document.getElementById("f-category").value = item.content_type === "case_study" ? "Case Study" : "";
  document.getElementById("f-thumbnail").value = item.thumbnail_url || "";
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
  // Can't reject an item already queued for approval
  if (queue[id] && queue[id].action === 'approve') {
    showToast('Remove from publish queue first (click ✓ Queued to undo)', true);
    return;
  }

  const card = document.getElementById('card-' + id);
  const btn = document.getElementById('reject-' + id);

  if (queue[id] && queue[id].action === 'reject') {
    // Un-reject
    delete queue[id];
    if (card) card.classList.remove('card-rejected');
    if (btn) btn.textContent = '✕ Reject';
  } else {
    // Mark for deletion
    queue[id] = { action: 'reject' };
    if (card) card.classList.add('card-rejected');
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
  const { error } = await sb.from("raw_items").delete().eq("id", id);
  if (error) {
    showToast("Delete failed: " + error.message, true);
    return;
  }
  delete queue[id];
  removeCard(id);
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
}
<\/script>

</body>
</html>`;
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
