import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { getSupabase } from "../lib/supabase-client";

// Posts older than this drop out of the picker. Beehiiv newsletters are
// weekly; 30 days gives enough headroom for skipped weeks.
const LOOKBACK_DAYS = 30;
// Jobs are time-sensitive — only surface those discovered in the last week.
const JOBS_LOOKBACK_DAYS = 7;
// Stats window for "Top skills & tools this month" — rolling recent demand.
const STATS_LOOKBACK_DAYS = 30;

async function main() {
  const sb = getSupabase();

  const postsCutoff = new Date(Date.now() - LOOKBACK_DAYS * 86400 * 1000).toISOString();
  const jobsCutoff = new Date(Date.now() - JOBS_LOOKBACK_DAYS * 86400 * 1000).toISOString();
  const statsCutoff = new Date(Date.now() - STATS_LOOKBACK_DAYS * 86400 * 1000).toISOString();

  const [postsRes, jobsRes, statsRes] = await Promise.all([
    sb
      .from("posts")
      .select("id,title,link,source,category,thumbnail_url,created_at,newsletter_status")
      .gte("created_at", postsCutoff)
      .or("newsletter_status.is.null,newsletter_status.eq.queued")
      .order("created_at", { ascending: false }),
    sb
      .from("jobs")
      .select("id,company,title,location,url,posted_date,department,category,first_seen_at,newsletter_status")
      .eq("active", true)
      .gte("first_seen_at", jobsCutoff)
      .or("newsletter_status.is.null,newsletter_status.eq.queued")
      .order("posted_date", { ascending: false, nullsFirst: false }),
    sb
      .from("jobs")
      .select("skills,tools,posted_date,first_seen_at")
      .eq("active", true)
      .or(`posted_date.gte.${statsCutoff},first_seen_at.gte.${statsCutoff}`),
  ]);

  const { data: posts, error } = postsRes;
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

  const { data: jobs, error: jobsErr } = jobsRes;
  if (jobsErr) {
    if (/column.*newsletter_status.*does not exist/i.test(jobsErr.message)) {
      console.error("\n  Schema migration required for jobs table.");
      console.error("  Run this in Supabase → SQL editor, then re-run:\n");
      console.error("    ALTER TABLE jobs");
      console.error("      ADD COLUMN IF NOT EXISTS newsletter_status text DEFAULT NULL;\n");
      console.error("    CREATE INDEX IF NOT EXISTS jobs_newsletter_status_idx");
      console.error("      ON jobs (newsletter_status)");
      console.error("      WHERE newsletter_status IS NULL OR newsletter_status = 'queued';\n");
      process.exit(1);
    }
    throw new Error(`Failed to fetch jobs: ${jobsErr.message}`);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const statsRows = (statsRes.data ?? []) as Array<{ skills: string[] | null; tools: string[] | null }>;
  const topSkills = topItems(statsRows.map((r) => r.skills));
  const topTools = topItems(statsRows.map((r) => r.tools));

  const html = buildHtml(posts ?? [], jobs ?? [], topSkills, topTools, statsRows.length, supabaseUrl, serviceKey);

  const outDir = path.resolve(__dirname, "../../reports");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "newsletter.html");
  fs.writeFileSync(outPath, html, "utf-8");

  console.log(`Newsletter builder: ${outPath}`);
  console.log(`Eligible posts (last ${LOOKBACK_DAYS}d, unsent): ${posts?.length ?? 0}`);
  console.log(`Eligible jobs  (last ${JOBS_LOOKBACK_DAYS}d, unsent): ${jobs?.length ?? 0}`);
  console.log(`Top-3 skills (last ${STATS_LOOKBACK_DAYS}d, ${statsRows.length} jobs): ${topSkills.map((s) => `${s.name} (${s.count})`).join(", ") || "—"}`);
  console.log(`Top-3 tools  (last ${STATS_LOOKBACK_DAYS}d, ${statsRows.length} jobs): ${topTools.map((s) => `${s.name} (${s.count})`).join(", ") || "—"}`);
  console.log(`Open in your browser to pick items, copy HTML, paste into Beehiiv.`);
}

function topItems(rows: Array<string[] | null | undefined>): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const seen = new Set<string>();
    for (const raw of row) {
      const name = typeof raw === "string" ? raw.trim() : "";
      if (!name || seen.has(name)) continue;
      seen.add(name);
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([name, count]) => ({ name, count }));
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

function buildHtml(
  posts: any[],
  jobs: any[],
  topSkills: Array<{ name: string; count: number }>,
  topTools: Array<{ name: string; count: number }>,
  statsJobCount: number,
  supabaseUrl: string,
  serviceKey: string,
): string {
  const generatedAt = new Date().toLocaleString();
  const postsMap = Object.fromEntries(posts.map((p) => [p.id, p]));
  const jobsMap = Object.fromEntries(jobs.map((j) => [j.id, j]));

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
    .post-row.cover-active { border-left-color: #eab308; background: #fffbeb; }
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
    Newsletter posts only
  </label>
  <div class="spacer"></div>
  <button class="muted" onclick="selectVisible()">Select all visible</button>
  <button class="muted" onclick="selectNone()">Clear selection</button>
</div>

<div class="container">
  <div class="banner-card">
    <h3>★ Cover image (optional)</h3>
    <p class="banner-help">Paste an Instagram image URL — it&apos;ll appear at the very top of the newsletter, above all posts. Checking an Instagram post below auto-fills this and removes it from the body.</p>
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
const JOBS_MAP = ${safeJson(jobsMap)};
const TOP_SKILLS = ${safeJson(topSkills)};
const TOP_TOOLS = ${safeJson(topTools)};
const STATS_JOB_COUNT = ${safeJson(statsJobCount)};
const STATS_LOOKBACK_DAYS = ${safeJson(30)};

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const selected = new Set();        // post ids (body items only — cover is excluded)
const selectedJobs = new Set();    // job ids — kept separate so markSent hits the right table
var coverPostId = null;            // id of the Instagram post currently used as cover

function isInstagramPost(p) {
  return (p.source || '').toLowerCase().indexOf('instagram') !== -1;
}

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
  var isIg = isInstagramPost(p);
  var queuedBadge = isQueued
    ? '<span class="badge" style="background:#fef3c7;color:#92400e;">★ picked</span>'
    : '';
  var igBadge = isIg
    ? '<span class="badge" style="background:#fef3c7;color:#92400e;">📸 sets cover</span>'
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
    +     igBadge
    +   '</div>'
    + '</div>'
    + '<a class="open" href="' + escAttr(p.link) + '" target="_blank" rel="noopener">↗</a>'
  + '</label>';
}

function jobTimestampMs(j) {
  return j.first_seen_at ? Date.parse(j.first_seen_at) : 0;
}

function renderJobRow(j) {
  var date = j.posted_date
    ? new Date(j.posted_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : (j.first_seen_at ? new Date(j.first_seen_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
  var isQueued = j.newsletter_status === 'queued';
  var rowClass = isQueued ? 'post-row checked' : 'post-row';
  var checkedAttr = isQueued ? 'checked' : '';
  return '<label class="' + rowClass + '" data-id="' + escAttr(j.id) + '" data-kind="job" data-type="Jobs" data-ts="' + jobTimestampMs(j) + '" data-status="' + escAttr(j.newsletter_status || '') + '">'
    + '<input type="checkbox" data-id="' + escAttr(j.id) + '" data-kind="job" ' + checkedAttr + ' onchange="onToggleJob(this)" />'
    + '<div class="thumb" style="display:flex;align-items:center;justify-content:center;font-size:18px;background:#f4f0e8;color:#7c5cff;">💼</div>'
    + '<div class="info">'
    +   '<div class="title"><a href="' + escAttr(j.url) + '" target="_blank" rel="noopener">' + escHtml(j.title) + '</a></div>'
    +   '<div class="meta">'
    +     '<span><strong>' + escHtml(j.company) + '</strong></span>'
    +     '<span class="badge">' + escHtml(j.category || '') + '</span>'
    +     (j.location ? '<span>' + escHtml(j.location) + '</span>' : '')
    +     '<span>' + escHtml(date) + '</span>'
    +   '</div>'
    + '</div>'
    + '<a class="open" href="' + escAttr(j.url) + '" target="_blank" rel="noopener">↗</a>'
  + '</label>';
}

function renderList() {
  var listEl = document.getElementById('post-list');
  if (Object.keys(POSTS_MAP).length === 0 && Object.keys(JOBS_MAP).length === 0) return;

  // Posts grouped by content type, newest first within each group.
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

  // Jobs group — separate, after posts. Sorted by posted_date desc, then first_seen_at.
  var jobsArr = Object.values(JOBS_MAP);
  if (jobsArr.length > 0) {
    jobsArr.sort(function(a, b) { return jobTimestampMs(b) - jobTimestampMs(a); });
    html += '<div class="group" data-type="Jobs">';
    html += '<div class="group-header">💼 Open roles · ' + jobsArr.length + '</div>';
    jobsArr.forEach(function(j) { html += renderJobRow(j); });
    html += '</div>';
  }

  listEl.innerHTML = html;

  // Pre-populate selections from items starred during review.
  Object.values(POSTS_MAP).forEach(function(p) {
    if (p.newsletter_status === 'queued') selected.add(p.id);
  });
  Object.values(JOBS_MAP).forEach(function(j) {
    if (j.newsletter_status === 'queued') selectedJobs.add(j.id);
  });

  // Auto-pick: jobs aren't manually starred during /collect, so default the
  // newsletter to the freshest N jobs from distinct companies. The user can
  // tick more or untick any of these in the picker.
  var AUTO_PICK_TARGET = 5;
  var allJobs = Object.values(JOBS_MAP).slice().sort(function(a, b) { return jobTimestampMs(b) - jobTimestampMs(a); });
  var seenCompanies = new Set();
  var autoPicks = [];
  for (var i = 0; i < allJobs.length && autoPicks.length < AUTO_PICK_TARGET; i++) {
    if (!seenCompanies.has(allJobs[i].company)) {
      autoPicks.push(allJobs[i]);
      seenCompanies.add(allJobs[i].company);
    }
  }
  // If we ran out of distinct companies, fill any remaining slots with newest unpicked.
  for (var i = 0; i < allJobs.length && autoPicks.length < AUTO_PICK_TARGET; i++) {
    if (autoPicks.indexOf(allJobs[i]) === -1) autoPicks.push(allJobs[i]);
  }
  autoPicks.forEach(function(j) {
    if (selectedJobs.has(j.id)) return;
    selectedJobs.add(j.id);
    var row = document.querySelector('.post-row[data-kind="job"][data-id="' + CSS.escape(j.id) + '"]');
    if (row) {
      var cb = row.querySelector('input[type=checkbox]');
      if (cb) cb.checked = true;
      row.classList.add('checked');
    }
  });

  autoSetInstagramCover();
  applyFilters();
}

function setCoverPost(id) {
  var p = POSTS_MAP[id];
  if (!p) return;
  // Clear previous cover row
  if (coverPostId && coverPostId !== id) {
    var prevRow = document.querySelector('.post-row[data-id="' + CSS.escape(coverPostId) + '"]');
    if (prevRow) {
      prevRow.classList.remove('cover-active');
      var prevCb = prevRow.querySelector('input[type=checkbox]');
      if (prevCb) prevCb.checked = false;
    }
  }
  document.getElementById('banner-img').value = p.thumbnail_url || '';
  document.getElementById('banner-link').value = p.link || '';
  coverPostId = id;
  selected.delete(id); // not in body
  var row = document.querySelector('.post-row[data-id="' + CSS.escape(id) + '"]');
  if (row) {
    row.classList.remove('checked');
    row.classList.add('cover-active');
    var cb = row.querySelector('input[type=checkbox]');
    if (cb) cb.checked = false;
  }
}

function clearCoverPost() {
  if (!coverPostId) return;
  var row = document.querySelector('.post-row[data-id="' + CSS.escape(coverPostId) + '"]');
  if (row) { row.classList.remove('cover-active'); }
  document.getElementById('banner-img').value = '';
  document.getElementById('banner-link').value = '';
  coverPostId = null;
}

function autoSetInstagramCover() {
  // If any pre-selected (★ picked) post is an Instagram post, set it as cover.
  var igId = null;
  selected.forEach(function(id) { if (!igId && isInstagramPost(POSTS_MAP[id])) igId = id; });
  if (igId) { setCoverPost(igId); showToast('Instagram image auto-set as cover ✓'); }
}

function onToggle(cb) {
  var id = cb.getAttribute('data-id');
  var row = cb.closest('.post-row');
  var p = POSTS_MAP[id];
  if (cb.checked) {
    if (p && isInstagramPost(p)) {
      // Instagram posts go to cover, not body
      setCoverPost(id);
      cb.checked = false; // visually unchecked in body; cover-active border shows it's used
      showToast('Instagram image set as cover ✓');
      updateCounts();
      return;
    }
    selected.add(id);
    row.classList.add('checked');
  } else {
    if (coverPostId === id) { clearCoverPost(); updateCounts(); return; }
    selected.delete(id);
    row.classList.remove('checked');
  }
  updateCounts();
}

function onToggleJob(cb) {
  var id = cb.getAttribute('data-id');
  var row = cb.closest('.post-row');
  if (cb.checked) {
    selectedJobs.add(id);
    row.classList.add('checked');
  } else {
    selectedJobs.delete(id);
    row.classList.remove('checked');
  }
  updateCounts();
}

function totalSelected() { return selected.size + selectedJobs.size; }

function updateCounts() {
  var total = totalSelected();
  document.getElementById('selected-count').textContent = total;
  document.getElementById('ab-selected').textContent = total;
  document.getElementById('btn-generate').disabled = total === 0;
  document.getElementById('btn-mark-sent').disabled = total === 0;
  // Re-apply filters live so "show checked only" stays accurate as selection changes.
  if (document.getElementById('picks-only').checked) applyFilters();
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
    var id = row.getAttribute('data-id');
    var isJob = row.getAttribute('data-kind') === 'job';
    var isChecked = isJob ? selectedJobs.has(id) : (selected.has(id) || coverPostId === id);
    var match = ts >= cutoff
      && (type === 'all' || rowType === type)
      && (!picksOnly || isChecked);
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

function toggleRowCheckbox(cb, on) {
  cb.checked = on;
  if (cb.getAttribute('data-kind') === 'job') onToggleJob(cb);
  else onToggle(cb);
}

function selectVisible() {
  document.querySelectorAll('.post-row:not(.hidden)').forEach(function(row) {
    var cb = row.querySelector('input[type=checkbox]');
    if (!cb.checked) toggleRowCheckbox(cb, true);
  });
}

function selectNone() {
  document.querySelectorAll('.post-row input[type=checkbox]:checked').forEach(function(cb) {
    toggleRowCheckbox(cb, false);
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
  var fontStack = '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif';
  var h2Style = 'font-family:' + fontStack + ';font-size:13px;font-weight:800;letter-spacing:0.22em;text-transform:uppercase;color:#475240;margin:0 0 16px 0;';
  var out = [];
  out.push('<!-- Generated by DesAIgn newsletter builder -->');
  // Brand-tinted cream wrapper — matches the site's #f7f4ef page background so
  // cards float on the same warm tone they do on desaign-radar.vercel.app.
  out.push('<div style="background:#f7f4ef;padding:28px 22px;border-radius:18px;">');

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

  // Site-styled card for posts. Same palette + card chrome as the jobs cards
  // for visual consistency in the newsletter. Inline CSS, table-based layout
  // for email-client compatibility.
  function postCardHtml(p, useThumbs) {
    var url = escAttr(p.link);
    var title = escHtml(p.title || '');
    var source = escHtml((p.source || '').toUpperCase());
    var category = escHtml((p.category || '').toUpperCase());
    var date = '';
    if (p.created_at) {
      var d = new Date(p.created_at);
      if (!isNaN(d.getTime())) {
        date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
      }
    }

    var fontStack = '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif';
    var titleStyle = 'font-family:' + fontStack + ';font-size:22px;font-weight:900;line-height:1.15;color:#18181b;letter-spacing:-0.01em;text-decoration:none;';
    var eyebrowStyle = 'font-family:' + fontStack + ';font-size:11px;font-weight:700;letter-spacing:0.2em;color:#475240;';
    var pillStyle = 'display:inline-block;background:#fafafa;border:1px solid #e4e4e7;border-radius:999px;padding:3px 10px;font-family:' + fontStack + ';font-size:10px;font-weight:700;letter-spacing:0.16em;color:#3f3f46;';
    var metaStyle = 'font-family:' + fontStack + ';font-size:11px;font-weight:600;letter-spacing:0.14em;color:#71717a;';
    var openStyle = 'font-family:' + fontStack + ';font-size:11px;font-weight:700;letter-spacing:0.2em;color:#18181b;text-decoration:none;';

    var html = '';
    html += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px 0;border-collapse:separate;">';
    html +=   '<tr><td style="background:#ffffff;border:1px solid #e4e4e7;border-radius:14px;overflow:hidden;padding:0;">';

    // Full-bleed image, top corners rounded.
    if (useThumbs && p.thumbnail_url) {
      html += '<a href="' + url + '" style="display:block;text-decoration:none;"><img src="' + escAttr(p.thumbnail_url) + '" alt="' + escAttr(p.title) + '" style="display:block;width:100%;height:auto;max-width:100%;border-radius:14px 14px 0 0;" /></a>';
    }

    // Body wrapped in a div for padding. Avoiding nested <table>s here because
    // Beehiiv's email CSS reset adds visible borders to every <td>; using
    // <div> + float for the eyebrow/footer rows sidesteps that entirely.
    html += '<div style="padding:22px 24px;">';

    // Eyebrow row: source on left, category pill on right
    html += '<div style="overflow:hidden;margin-bottom:14px;">';
    html +=   '<span style="float:left;' + eyebrowStyle + '">' + source + '</span>';
    if (category) {
      html += '<span style="float:right;' + pillStyle + '">' + category + '</span>';
    }
    html += '</div>';

    // Title
    html += '<div style="margin:0 0 18px 0;"><a href="' + url + '" style="' + titleStyle + '">' + title + '</a></div>';

    // Footer row: date on left, Open ↗ on right
    html += '<div style="border-top:1px solid #f4f4f5;padding-top:12px;overflow:hidden;">';
    html +=   '<span style="float:left;' + metaStyle + '">' + date + '</span>';
    html +=   '<span style="float:right;"><a href="' + url + '" style="' + openStyle + '">OPEN &#8599;</a></span>';
    html += '</div>';

    html += '</div>';                // close body div
    html += '</td></tr></table>';    // close outer card
    return html;
  }

  ['Videos', 'Articles', 'Images'].forEach(function(t) {
    var arr = groups[t];
    if (!arr || !arr.length) return;
    out.push('');
    out.push('<h2 style="' + h2Style + '">' + labels[t] + '</h2>');
    out.push('');
    arr.forEach(function(p) { out.push(postCardHtml(p, includeThumbs)); });
    out.push('<p style="margin-bottom:28px;">&nbsp;</p>');
  });

  // Jobs section — site-styled cards with inline CSS for email clients.
  // Layout uses tables (most universally rendered) and the sage-green brand
  // palette from app/globals.css: brand #758666, brand-deep #475240.
  var jobsArr = [];
  selectedJobs.forEach(function(id) {
    var j = JOBS_MAP[id];
    if (j) jobsArr.push(j);
  });
  jobsArr.sort(function(a, b) { return jobTimestampMs(b) - jobTimestampMs(a); });

  function isJobRemote(loc) {
    return !!loc && /\\bremote\\b|\\bworldwide\\b|\\banywhere\\b/i.test(loc);
  }

  function jobCardHtml(j) {
    var url = escAttr(j.url);
    var company = escHtml(j.company || '').toUpperCase();
    var title = escHtml(j.title || '');
    var category = escHtml(j.category || '').toUpperCase();
    var remote = isJobRemote(j.location);
    // When remote, strip the standalone "Remote" word from the location text so the
    // pill and the text don't duplicate. Keeps "San Francisco · Remote" -> "San Francisco".
    var rawLoc = j.location || '';
    if (remote) rawLoc = rawLoc.replace(/(^|[\\s,;\\u00b7\\u2022])remote([\\s,;\\u00b7\\u2022]|$)/gi, ' ').replace(/^[\\s,;\\u00b7\\u2022]+|[\\s,;\\u00b7\\u2022]+$/g, '').trim();
    var loc = escHtml(rawLoc || (remote ? '' : 'Location TBD'));

    var titleStyle = 'font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:20px;font-weight:900;line-height:1.2;color:#18181b;letter-spacing:-0.01em;';
    var eyebrowStyle = 'font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.2em;color:#475240;';
    var pillStyle = 'display:inline-block;background:#fafafa;border:1px solid #e4e4e7;border-radius:999px;padding:3px 10px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.16em;color:#3f3f46;';
    var metaStyle = 'font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.14em;color:#71717a;';
    var applyStyle = 'font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.2em;color:#18181b;text-decoration:none;';
    var remoteBadgeStyle = 'display:inline-block;background:#e3e7df;color:#475240;border-radius:999px;padding:2px 8px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:0.18em;margin-right:8px;vertical-align:middle;';

    var html = '';
    html += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px 0;border-collapse:separate;">';
    html +=   '<tr><td style="background:#ffffff;border:1px solid #e4e4e7;border-radius:14px;padding:22px 24px;">';
    // Eyebrow row: company on left, category pill on right
    html +=     '<div style="overflow:hidden;margin-bottom:14px;">';
    html +=       '<span style="float:left;' + eyebrowStyle + '">' + company + '</span>';
    if (category) {
      html +=     '<span style="float:right;' + pillStyle + '">' + category + '</span>';
    }
    html +=     '</div>';
    // Title
    html +=     '<div style="margin:0 0 18px 0;"><a href="' + url + '" style="' + titleStyle + 'text-decoration:none;">' + title + '</a></div>';
    // Footer row: location + remote pill on left, Apply on right, separated by a top border
    html +=     '<div style="border-top:1px solid #f4f4f5;padding-top:12px;overflow:hidden;">';
    html +=       '<span style="float:left;' + metaStyle + '">';
    if (remote) html += '<span style="' + remoteBadgeStyle + '">REMOTE</span>';
    if (loc) html += '<span style="text-transform:uppercase;">' + loc + '</span>';
    html +=       '</span>';
    html +=       '<span style="float:right;"><a href="' + url + '" style="' + applyStyle + '">APPLY &#8599;</a></span>';
    html +=     '</div>';
    html +=   '</td></tr>';
    html += '</table>';
    return html;
  }

  if (jobsArr.length > 0) {
    out.push('');
    out.push('<h2 style="' + h2Style + '">💼 Open roles</h2>');
    out.push('');
    jobsArr.forEach(function(j) { out.push(jobCardHtml(j)); });
    out.push('<p style="margin-bottom:28px;">&nbsp;</p>');
  }

  // "Top skills & tools" — common stats from the last STATS_LOOKBACK_DAYS of
  // active jobs. Sits after the jobs section as a single combined card.
  if ((TOP_SKILLS && TOP_SKILLS.length) || (TOP_TOOLS && TOP_TOOLS.length)) {
    var statsTitleStyle = 'font-family:' + fontStack + ';font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#475240;margin:0 0 14px 0;';
    var statsRowLabel = 'font-family:' + fontStack + ';font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#71717a;margin:0 0 10px 0;';
    var statsItemName = 'font-family:' + fontStack + ';font-size:15px;font-weight:800;color:#18181b;letter-spacing:-0.005em;';
    var statsItemCount = 'font-family:' + fontStack + ';font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#475240;';
    var statsFooter = 'font-family:' + fontStack + ';font-size:10px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#a1a1aa;margin:16px 0 0 0;';

    function statsListHtml(label, items) {
      if (!items || !items.length) return '';
      var rows = '';
      items.forEach(function(it, idx) {
        var divider = idx === 0 ? '' : 'border-top:1px solid #ecebe3;';
        rows += '<tr><td style="padding:10px 0;' + divider + '">'
              +   '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
              +     '<td style="' + statsItemName + '">' + escHtml(it.name) + '</td>'
              +     '<td align="right" style="' + statsItemCount + 'white-space:nowrap;">' + it.count + ' ' + (it.count === 1 ? 'JOB' : 'JOBS') + '</td>'
              +   '</tr></table>'
              + '</td></tr>';
      });
      return '<div style="margin-bottom:18px;">'
           +   '<p style="' + statsRowLabel + '">' + label + '</p>'
           +   '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">' + rows + '</table>'
           + '</div>';
    }

    out.push('');
    out.push('<h2 style="' + h2Style + '">📊 What hiring designers need right now</h2>');
    out.push('');
    out.push('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px 0;border-collapse:separate;">');
    out.push(  '<tr><td style="background:#ffffff;border:1px solid #e4e4e7;border-radius:14px;padding:22px 24px;">');
    out.push(    '<p style="' + statsTitleStyle + '">Top picks · last ' + STATS_LOOKBACK_DAYS + ' days</p>');
    out.push(    statsListHtml('Top 3 skills', TOP_SKILLS));
    out.push(    statsListHtml('Top 3 tools', TOP_TOOLS));
    out.push(    '<p style="' + statsFooter + '">Across ' + STATS_JOB_COUNT + ' active job posts on DesAIgn Radar</p>');
    out.push(  '</td></tr>');
    out.push('</table>');
    out.push('<p style="margin-bottom:28px;">&nbsp;</p>');
  }

  out.push('</div>'); // close brand-cream wrapper
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
  var total = totalSelected();
  if (total === 0) return;
  var postIds = Array.from(selected);
  var jobIds = Array.from(selectedJobs);
  if (!confirm('Mark ' + total + ' item(s) as sent in Beehiiv? They will disappear from the picker on next reload.')) return;

  var btn = document.getElementById('btn-mark-sent');
  btn.disabled = true;
  btn.textContent = 'Marking…';
  try {
    var promises = [];
    if (postIds.length > 0) promises.push(sb.from('posts').update({ newsletter_status: 'sent' }).in('id', postIds));
    if (jobIds.length > 0) promises.push(sb.from('jobs').update({ newsletter_status: 'sent' }).in('id', jobIds));
    var results = await Promise.all(promises);
    for (var i = 0; i < results.length; i++) {
      if (results[i].error) throw new Error(results[i].error.message);
    }
    showToast('Marked ' + total + ' as sent ✓');
    // Remove from local state and DOM
    postIds.forEach(function(id) {
      delete POSTS_MAP[id];
      var row = document.querySelector('.post-row[data-id="' + CSS.escape(id) + '"]');
      if (row) row.remove();
    });
    jobIds.forEach(function(id) {
      delete JOBS_MAP[id];
      var row = document.querySelector('.post-row[data-id="' + CSS.escape(id) + '"]');
      if (row) row.remove();
    });
    selected.clear();
    selectedJobs.clear();
    updateCounts();
    applyFilters();
  } catch (err) {
    showToast('Update failed: ' + err.message, true);
  } finally {
    btn.disabled = totalSelected() === 0;
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
