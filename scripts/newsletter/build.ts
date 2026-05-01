import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { getSupabase } from "../lib/supabase-client";

// Posts older than this drop out of the picker. Beehiiv newsletters are
// weekly; 30 days gives enough headroom for skipped weeks.
const LOOKBACK_DAYS = 30;

async function main() {
  const sb = getSupabase();

  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 86400 * 1000).toISOString();
  const { data: posts, error } = await sb
    .from("posts")
    .select("id,title,link,source,category,thumbnail_url,created_at,newsletter_status")
    .gte("created_at", cutoff)
    .or("newsletter_status.is.null,newsletter_status.eq.queued")
    .order("created_at", { ascending: false });

  if (error) {
    if (/column.*newsletter_status.*does not exist/i.test(error.message)) {
      console.error("\n  Schema migration required.");
      console.error("  Run this in Supabase → SQL editor, then re-run:\n");
      console.error("    ALTER TABLE posts");
      console.error("      ADD COLUMN IF NOT EXISTS newsletter_status text DEFAULT NULL;\n");
      console.error("    CREATE INDEX IF NOT EXISTS idx_posts_newsletter_status");
      console.error("      ON posts (newsletter_status)");
      console.error("      WHERE newsletter_status IS NULL OR newsletter_status = 'queued';\n");
      process.exit(1);
    }
    throw new Error(`Failed to fetch posts: ${error.message}`);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const html = buildHtml(posts ?? [], supabaseUrl, serviceKey);

  const outDir = path.resolve(__dirname, "../../reports");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "newsletter.html");
  fs.writeFileSync(outPath, html, "utf-8");

  console.log(`Newsletter builder: ${outPath}`);
  console.log(`Eligible posts (last ${LOOKBACK_DAYS}d, unsent): ${posts?.length ?? 0}`);
  console.log(`Open in your browser to pick items, copy HTML, paste into Beehiiv.`);
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

function buildHtml(posts: any[], supabaseUrl: string, serviceKey: string): string {
  const generatedAt = new Date().toLocaleString();
  const postsMap = Object.fromEntries(posts.map((p) => [p.id, p]));

  return `<!DOCTYPE html>
<!-- LOCAL USE ONLY — contains Supabase service role key. Do not share or deploy. -->
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>DesAIgn Newsletter Builder (${posts.length})</title>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"><\/script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f4f4f4; color: #111; min-height: 100vh; padding-bottom: 90px; }

    .header { background: #111; color: #fff; padding: 18px 32px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 10; }
    .header h1 { font-size: 16px; font-weight: 700; letter-spacing: -0.2px; }
    .header-meta { font-size: 12px; color: #888; }

    .toolbar { background: #1f1f1f; padding: 12px 32px; display: flex; gap: 16px; align-items: center; flex-wrap: wrap; color: #ddd; font-size: 12px; position: sticky; top: 56px; z-index: 9; border-top: 1px solid #2a2a2a; }
    .toolbar label { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
    .toolbar select { background: #2a2a2a; color: #fff; border: 1px solid #3a3a3a; border-radius: 6px; padding: 5px 9px; font-size: 12px; font-family: inherit; cursor: pointer; }
    .toolbar input[type=checkbox] { width: 14px; height: 14px; cursor: pointer; }
    .toolbar .spacer { flex: 1; }
    .toolbar button { background: #2563eb; color: #fff; border: none; border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; }
    .toolbar button:hover { opacity: 0.85; }
    .toolbar button.muted { background: #2a2a2a; color: #ccc; }

    .container { max-width: 980px; margin: 26px auto; padding: 0 20px; }
    .empty { text-align: center; padding: 80px 0; color: #999; font-size: 15px; }

    .group-header { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #888; margin: 28px 4px 10px; }

    .banner-card { background: #fff; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.07); padding: 16px 18px; margin-bottom: 22px; border-left: 4px solid #eab308; }
    .banner-card h3 { font-size: 13px; font-weight: 700; color: #111; margin-bottom: 4px; }
    .banner-card .banner-help { font-size: 12px; color: #777; margin-bottom: 10px; line-height: 1.5; }
    .banner-input { width: 100%; border: 1.5px solid #e4e4e4; border-radius: 7px; padding: 8px 11px; font-size: 13px; font-family: inherit; color: #111; outline: none; transition: border-color 0.15s; margin-bottom: 7px; }
    .banner-input:last-child { margin-bottom: 0; }
    .banner-input:focus { border-color: #eab308; }

    .post-row { background: #fff; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.07); display: flex; align-items: center; gap: 14px; padding: 12px 16px; margin-bottom: 8px; transition: border-left 0.15s, opacity 0.2s; border-left: 4px solid transparent; }
    .post-row.checked { border-left-color: #16a34a; }
    .post-row.hidden { display: none; }
    .post-row input[type=checkbox] { width: 18px; height: 18px; cursor: pointer; flex-shrink: 0; }
    .post-row .thumb { width: 96px; height: 54px; object-fit: cover; border-radius: 6px; background: #f0f0f0; flex-shrink: 0; }
    .post-row .info { flex: 1; min-width: 0; }
    .post-row .title { font-size: 14px; font-weight: 600; line-height: 1.4; color: #111; }
    .post-row .title a { color: #111; text-decoration: none; }
    .post-row .title a:hover { text-decoration: underline; }
    .post-row .meta { font-size: 12px; color: #888; margin-top: 3px; display: flex; gap: 8px; flex-wrap: wrap; }
    .post-row .meta .badge { background: #f4f4f4; border-radius: 4px; padding: 1px 6px; font-size: 11px; color: #555; }
    .post-row .open { color: #555; text-decoration: none; font-size: 12px; padding: 4px 8px; border-radius: 6px; }
    .post-row .open:hover { background: #f0f0f0; }

    .action-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #111; color: #fff; padding: 14px 32px; display: flex; align-items: center; gap: 14px; z-index: 50; border-top: 1px solid #333; }
    .action-bar .summary { font-size: 13px; color: #aaa; }
    .action-bar .summary strong { color: #fff; }
    .action-bar .spacer { flex: 1; }
    .action-bar button { border: none; border-radius: 7px; padding: 8px 16px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
    .action-bar button:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-generate { background: #fff; color: #111; }
    .btn-mark-sent { background: #16a34a; color: #fff; }
    .btn-mark-sent:hover:not(:disabled) { opacity: 0.85; }

    .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 100; align-items: center; justify-content: center; padding: 30px; }
    .modal-overlay.open { display: flex; }
    .modal { background: #fff; border-radius: 14px; padding: 24px 26px; width: 100%; max-width: 760px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 24px 64px rgba(0,0,0,0.25); }
    .modal h2 { font-size: 16px; font-weight: 700; margin-bottom: 6px; }
    .modal .modal-sub { font-size: 12px; color: #777; margin-bottom: 14px; }
    .modal textarea { flex: 1; min-height: 320px; border: 1.5px solid #e4e4e4; border-radius: 8px; padding: 12px 14px; font-size: 12px; line-height: 1.55; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; resize: vertical; outline: none; color: #111; }
    .modal textarea:focus { border-color: #111; }
    .modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 14px; }
    .modal-actions button { border: none; border-radius: 7px; padding: 7px 14px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
    .btn-copy { background: #111; color: #fff; }
    .btn-cancel { background: #f0f0f0; color: #555; }

    .toast { position: fixed; bottom: 84px; right: 22px; background: #111; color: #fff; padding: 11px 18px; border-radius: 9px; font-size: 13px; font-weight: 500; z-index: 200; opacity: 0; transform: translateY(6px); transition: all 0.22s; pointer-events: none; }
    .toast.show { opacity: 1; transform: translateY(0); }
    .toast.error { background: #dc2626; }
  </style>
</head>
<body>

<div class="header">
  <h1>DesAIgn Newsletter Builder</h1>
  <span class="header-meta"><span id="visible-count">${posts.length}</span> shown · <span id="selected-count">0</span> selected · ${generatedAt}</span>
</div>

<div class="toolbar">
  <label>
    Days:
    <select id="days-filter" onchange="applyFilters()">
      <option value="7" selected>Last 7</option>
      <option value="14">Last 14</option>
      <option value="30">Last 30</option>
    </select>
  </label>
  <label>
    Type:
    <select id="type-filter" onchange="applyFilters()">
      <option value="all" selected>All</option>
      <option value="Videos">Videos</option>
      <option value="Articles">Articles</option>
      <option value="Images">Images</option>
    </select>
  </label>
  <label>
    <input type="checkbox" id="include-thumbs" checked />
    Include thumbnails in HTML
  </label>
  <label>
    <input type="checkbox" id="picks-only" onchange="applyFilters()" />
    Show only ★ picks
  </label>
  <div class="spacer"></div>
  <button class="muted" onclick="selectVisible()">Select all visible</button>
  <button class="muted" onclick="selectNone()">Clear selection</button>
</div>

<div class="container">
  <div class="banner-card">
    <h3>★ Cover image (optional)</h3>
    <p class="banner-help">Paste an Instagram image URL — it&apos;ll appear at the very top of the newsletter, above all posts.</p>
    <input type="text" id="banner-img" class="banner-input" placeholder="Image URL — e.g. https://...cdninstagram.com/.../image.jpg" />
    <input type="text" id="banner-link" class="banner-input" placeholder="Link URL (optional) — e.g. https://www.instagram.com/p/..." />
  </div>
  <div id="post-list">
    ${posts.length === 0
      ? '<div class="empty">No eligible posts in the last ' + LOOKBACK_DAYS + ' days. Approve some via the review queue first.</div>'
      : ""}
  </div>
</div>

<div class="action-bar">
  <span class="summary"><strong id="ab-selected">0</strong> selected</span>
  <span class="spacer"></span>
  <button class="btn-mark-sent" id="btn-mark-sent" onclick="markSent()" disabled>Mark selected as sent</button>
  <button class="btn-generate" id="btn-generate" onclick="showPreview()" disabled>Generate HTML →</button>
</div>

<div class="modal-overlay" id="preview-overlay">
  <div class="modal">
    <h2>Beehiiv-ready HTML</h2>
    <p class="modal-sub">Paste this into a new Beehiiv post (Code view). Edit intro/outro in Beehiiv.</p>
    <textarea id="preview-output" readonly></textarea>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closePreview()">Close</button>
      <button class="btn-copy" onclick="copyHtml()">Copy HTML</button>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
/* LOCAL USE ONLY */
const SUPABASE_URL = ${safeJson(supabaseUrl)};
const SUPABASE_KEY = ${safeJson(serviceKey)};
const POSTS_MAP = ${safeJson(postsMap)};

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const selected = new Set();

function classifyType(p) {
  var src = (p.source || '').toLowerCase();
  var cat = (p.category || '').toLowerCase();
  if (src.indexOf('youtube') !== -1) return 'Videos';
  if (src.indexOf('instagram') !== -1 || cat.indexOf('ai culture') !== -1 || cat.indexOf('ai images') !== -1) return 'Images';
  return 'Articles';
}

function postTimestampMs(p) {
  return p.created_at ? Date.parse(p.created_at) : 0;
}

function escHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escAttr(s) {
  return escHtml(s).replace(/"/g, '&quot;');
}

function showToast(msg, isErr) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (isErr ? ' error' : '');
  clearTimeout(el._t);
  el._t = setTimeout(function() { el.className = 'toast'; }, 3000);
}

function renderPostRow(p) {
  var date = p.created_at
    ? new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  var isQueued = p.newsletter_status === 'queued';
  var queuedBadge = isQueued
    ? '<span class="badge" style="background:#fef3c7;color:#92400e;">★ picked</span>'
    : '';
  var rowClass = isQueued ? 'post-row checked' : 'post-row';
  var checkedAttr = isQueued ? 'checked' : '';
  return '<label class="' + rowClass + '" data-id="' + escAttr(p.id) + '" data-type="' + classifyType(p) + '" data-ts="' + postTimestampMs(p) + '" data-status="' + escAttr(p.newsletter_status || '') + '">'
    + '<input type="checkbox" data-id="' + escAttr(p.id) + '" ' + checkedAttr + ' onchange="onToggle(this)" />'
    + (p.thumbnail_url
        ? '<img class="thumb" src="' + escAttr(p.thumbnail_url) + '" alt="" loading="lazy" />'
        : '<div class="thumb"></div>')
    + '<div class="info">'
    +   '<div class="title"><a href="' + escAttr(p.link) + '" target="_blank" rel="noopener">' + escHtml(p.title) + '</a></div>'
    +   '<div class="meta">'
    +     '<span>' + escHtml(p.source || '—') + '</span>'
    +     '<span class="badge">' + escHtml(p.category || '') + '</span>'
    +     '<span>' + escHtml(date) + '</span>'
    +     queuedBadge
    +   '</div>'
    + '</div>'
    + '<a class="open" href="' + escAttr(p.link) + '" target="_blank" rel="noopener">↗</a>'
  + '</label>';
}

function renderList() {
  var listEl = document.getElementById('post-list');
  if (Object.keys(POSTS_MAP).length === 0) return;

  // Group by content type, then sort newest-first within each group.
  var groups = { Videos: [], Articles: [], Images: [] };
  Object.values(POSTS_MAP).forEach(function(p) {
    var t = classifyType(p);
    (groups[t] || (groups[t] = [])).push(p);
  });

  var html = '';
  ['Videos', 'Articles', 'Images'].forEach(function(t) {
    var arr = groups[t];
    if (!arr || !arr.length) return;
    arr.sort(function(a, b) { return postTimestampMs(b) - postTimestampMs(a); });
    html += '<div class="group" data-type="' + t + '">';
    html += '<div class="group-header">' + t + ' · ' + arr.length + '</div>';
    arr.forEach(function(p) { html += renderPostRow(p); });
    html += '</div>';
  });

  listEl.innerHTML = html;

  // Pre-populate the selection from items starred during review
  // (newsletter_status === queued). User can untick before generating.
  Object.values(POSTS_MAP).forEach(function(p) {
    if (p.newsletter_status === 'queued') selected.add(p.id);
  });

  applyFilters();
}

function onToggle(cb) {
  var id = cb.getAttribute('data-id');
  var row = cb.closest('.post-row');
  if (cb.checked) {
    selected.add(id);
    row.classList.add('checked');
  } else {
    selected.delete(id);
    row.classList.remove('checked');
  }
  updateCounts();
}

function updateCounts() {
  document.getElementById('selected-count').textContent = selected.size;
  document.getElementById('ab-selected').textContent = selected.size;
  document.getElementById('btn-generate').disabled = selected.size === 0;
  document.getElementById('btn-mark-sent').disabled = selected.size === 0;
}

function applyFilters() {
  var days = document.getElementById('days-filter').value;
  var type = document.getElementById('type-filter').value;
  var picksOnly = document.getElementById('picks-only').checked;
  var cutoff = Date.now() - parseInt(days, 10) * 86400000;

  var visible = 0;
  document.querySelectorAll('.post-row').forEach(function(row) {
    var ts = parseInt(row.getAttribute('data-ts'), 10);
    var rowType = row.getAttribute('data-type');
    var rowStatus = row.getAttribute('data-status');
    var match = ts >= cutoff
      && (type === 'all' || rowType === type)
      && (!picksOnly || rowStatus === 'queued');
    row.classList.toggle('hidden', !match);
    if (match) visible++;
  });

  // Hide group headers whose group is empty
  document.querySelectorAll('.group').forEach(function(g) {
    var anyVisible = g.querySelectorAll('.post-row:not(.hidden)').length > 0;
    var header = g.querySelector('.group-header');
    if (header) header.style.display = anyVisible ? '' : 'none';
  });

  document.getElementById('visible-count').textContent = visible;
}

function selectVisible() {
  document.querySelectorAll('.post-row:not(.hidden)').forEach(function(row) {
    var cb = row.querySelector('input[type=checkbox]');
    if (!cb.checked) {
      cb.checked = true;
      onToggle(cb);
    }
  });
}

function selectNone() {
  document.querySelectorAll('.post-row input[type=checkbox]:checked').forEach(function(cb) {
    cb.checked = false;
    onToggle(cb);
  });
}

function buildBeehiivHtml() {
  var includeThumbs = document.getElementById('include-thumbs').checked;
  var bannerImg = (document.getElementById('banner-img').value || '').trim();
  var bannerLink = (document.getElementById('banner-link').value || '').trim();

  var groups = { Videos: [], Articles: [], Images: [] };
  selected.forEach(function(id) {
    var p = POSTS_MAP[id];
    if (!p) return;
    var t = classifyType(p);
    (groups[t] || (groups[t] = [])).push(p);
  });
  // Sort each group newest-first
  Object.keys(groups).forEach(function(k) {
    groups[k].sort(function(a, b) { return postTimestampMs(b) - postTimestampMs(a); });
  });

  var labels = { Videos: 'Videos', Articles: 'Reads & studio notes', Images: 'Images' };
  var out = [];
  out.push('<!-- Generated by DesAIgn newsletter builder -->');

  // Optional cover image at the very top.
  if (bannerImg) {
    out.push('');
    var imgTag = '<img src="' + escAttr(bannerImg) + '" alt="" style="max-width:100%;border-radius:8px;" />';
    if (bannerLink) {
      out.push('<p><a href="' + escAttr(bannerLink) + '">' + imgTag + '</a></p>');
    } else {
      out.push('<p>' + imgTag + '</p>');
    }
    out.push('<hr />');
  }

  ['Videos', 'Articles', 'Images'].forEach(function(t) {
    var arr = groups[t];
    if (!arr || !arr.length) return;
    out.push('');
    out.push('<h2>' + labels[t] + '</h2>');
    arr.forEach(function(p) {
      out.push('');
      if (includeThumbs && p.thumbnail_url) {
        out.push('<p><a href="' + escAttr(p.link) + '"><img src="' + escAttr(p.thumbnail_url) + '" alt="' + escAttr(p.title) + '" style="max-width:100%;border-radius:8px;" /></a></p>');
      }
      out.push('<p><strong><a href="' + escAttr(p.link) + '">' + escHtml(p.title) + '</a></strong><br />' + escHtml(p.source || '') + (p.category ? ' · ' + escHtml(p.category) : '') + '</p>');
    });
    out.push('');
    out.push('<hr />');
  });
  // Drop trailing <hr/>
  if (out[out.length - 1] === '<hr />') out.pop();
  return out.join('\\n');
}

function showPreview() {
  if (selected.size === 0) return;
  document.getElementById('preview-output').value = buildBeehiivHtml();
  document.getElementById('preview-overlay').classList.add('open');
}

function closePreview() {
  document.getElementById('preview-overlay').classList.remove('open');
}

document.getElementById('preview-overlay').addEventListener('click', function(e) {
  if (e.target === this) closePreview();
});
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closePreview();
});

async function copyHtml() {
  var ta = document.getElementById('preview-output');
  if (!ta.value) return;
  try {
    await navigator.clipboard.writeText(ta.value);
    showToast('Copied to clipboard ✓');
  } catch (err) {
    ta.select();
    document.execCommand('copy');
    showToast('Copied to clipboard ✓');
  }
}

async function markSent() {
  if (selected.size === 0) return;
  var ids = Array.from(selected);
  if (!confirm('Mark ' + ids.length + ' post(s) as sent in Beehiiv? They will disappear from the picker on next reload.')) return;

  var btn = document.getElementById('btn-mark-sent');
  btn.disabled = true;
  btn.textContent = 'Marking…';
  try {
    var { error } = await sb.from('posts').update({ newsletter_status: 'sent' }).in('id', ids);
    if (error) throw new Error(error.message);
    showToast('Marked ' + ids.length + ' as sent ✓');
    // Remove from local state and DOM
    ids.forEach(function(id) {
      delete POSTS_MAP[id];
      var row = document.querySelector('.post-row[data-id="' + CSS.escape(id) + '"]');
      if (row) row.remove();
    });
    selected.clear();
    updateCounts();
    applyFilters();
  } catch (err) {
    showToast('Update failed: ' + err.message, true);
  } finally {
    btn.disabled = selected.size === 0;
    btn.textContent = 'Mark selected as sent';
  }
}

renderList();
updateCounts();
<\/script>

</body>
</html>`;
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
