/* Markdown wiki viewer — renders window.WIKI (built by build.py) */
(function () {
  "use strict";
  const W = window.WIKI || { pages: [], root: "대문", name: "위키", built: "" };
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const enc = encodeURIComponent;

  // ---------- index ----------
  const byKey = new Map();
  W.pages.forEach((p) => {
    [p.title, ...(p.aliases || [])].forEach((k) => byKey.set(k.toLowerCase(), p));
  });
  const find = (name) => byKey.get(String(name).trim().toLowerCase());
  const backlinks = new Map(W.pages.map((p) => [p.title, new Set()]));
  const redFrom = new Map();
  W.pages.forEach((p) => {
    (p.links || []).forEach((l) => {
      const t = find(l);
      if (t) { if (t.title !== p.title) backlinks.get(t.title).add(p.title); }
      else { if (!redFrom.has(l.toLowerCase())) redFrom.set(l.toLowerCase(), new Set()); redFrom.get(l.toLowerCase()).add(p.title); }
    });
  });
  const href = (title, sec) => "#/w/" + enc(title) + (sec ? "::" + enc(sec) : "");

  // ---------- markdown ----------
  if (window.marked) marked.setOptions({ gfm: true, breaks: false });
  const P0 = "", P1 = "";

  function renderMd(src, opts = {}) {
    const store = [];
    const hold = (v) => { store.push(v); return P0 + (store.length - 1) + P1; };
    // footnote definitions
    const fnDefs = {}, fnOrder = [];
    src = src.replace(/^\[\^([^\]]+)\]:[ \t]*(.+)$/gm, (_, id, txt) => { fnDefs[id] = txt; return ""; });
    // protect code
    src = src.replace(/```[\s\S]*?```/g, (m) => hold({ raw: m }));
    src = src.replace(/`[^`\n]+`/g, (m) => hold({ raw: m }));
    // math
    src = src.replace(/\$\$([\s\S]+?)\$\$/g, (_, t) => hold({ tex: t, display: true }));
    src = src.replace(/(^|[^\\$\w])\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\w)/g, (_, pre, t) => pre + hold({ tex: t, display: false }));
    // wiki links  [[Target#sec|label]]   (\| also accepted, for tables)
    src = src.replace(/\[\[([^\]]+?)\]\]/g, (_, inner) => {
      const parts = inner.split(/\\?\|/);
      let target = parts[0].trim(), label = parts.length > 1 ? parts.slice(1).join("|").trim() : "";
      let sec = "";
      const hi = target.indexOf("#");
      if (hi >= 0) { sec = target.slice(hi + 1).trim(); target = target.slice(0, hi).trim(); }
      const p = find(target);
      if (!label) label = sec ? (target ? target + " § " + sec : sec) : target;
      if (!target && sec) return `<a class="wl sec" href="#" data-sec="${esc(sec)}">${esc(label)}</a>`;
      const cls = p ? "wl" : "wl red";
      const t = p ? p.title : target;
      return `<a class="${cls}" href="${href(t, sec)}" data-t="${esc(t)}">${esc(label)}</a>`;
    });
    // footnote refs
    src = src.replace(/\[\^([^\]]+)\]/g, (_, id) => {
      if (!(id in fnDefs)) return _;
      if (!fnOrder.includes(id)) fnOrder.push(id);
      const n = fnOrder.indexOf(id) + 1;
      return `<sup class="fn"><a href="#" data-fn="${esc(id)}" title="${esc(fnDefs[id].replace(/\[\[|\]\]/g, ""))}">[${n}]</a></sup>`;
    });
    // restore code before markdown
    src = src.replace(new RegExp(P0 + "(\\d+)" + P1, "g"), (m, i) => (store[i].raw !== undefined ? store[i].raw : m));
    let html = window.marked ? marked.parse(src) : "<pre>" + esc(src) + "</pre>";
    // math
    html = html.replace(new RegExp(P0 + "(\\d+)" + P1, "g"), (m, i) => {
      const s = store[i];
      if (!s || s.tex === undefined) return m;
      try { return katex.renderToString(s.tex.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"), { displayMode: s.display, throwOnError: false }); }
      catch (e) { return esc(s.tex); }
    });
    if (fnOrder.length && !opts.noFootnotes) {
      html += '<div class="fns"><b>각주</b>' + fnOrder.map((id, i) =>
        `<div id="fn-${esc(id)}"><span class="fid">[${i + 1}]</span>${renderInline(fnDefs[id])}</div>`).join("") + "</div>";
    }
    return html;
  }
  function renderInline(s) {
    const h = renderMd(s, { noFootnotes: true }).trim();
    return h.replace(/^<p>/, "").replace(/<\/p>$/, "");
  }

  function decorate(root, withToc) {
    // callouts: > [!note] 제목
    root.querySelectorAll("blockquote").forEach((bq) => {
      const p = bq.firstElementChild;
      if (!p || p.tagName !== "P") return;
      const m = p.innerHTML.match(/^\[!(note|warn|risk|idea|tip|info)\]\s*([^\n<]*)(?:\n|<br>)?/i);
      if (!m) return;
      const type = m[1].toLowerCase();
      const map = { note: "note", info: "note", tip: "idea", idea: "idea", warn: "warn", risk: "risk" };
      const label = { note: "참고", warn: "주의", risk: "리스크", idea: "아이디어" }[map[type]];
      p.innerHTML = p.innerHTML.slice(m[0].length);
      if (!p.innerHTML.trim()) p.remove();
      const div = document.createElement("div");
      div.className = "co " + map[type];
      div.innerHTML = `<div class="co-t">${esc(m[2].trim() || label)}</div>` + bq.innerHTML;
      bq.replaceWith(div);
    });
    root.querySelectorAll("td, th").forEach((c) => { if (c.textContent.trim().length <= 12) c.classList.add("nw"); });
    root.querySelectorAll("a[href^='http']").forEach((a) => { a.classList.add("ext"); a.target = "_blank"; a.rel = "noopener"; });
    if (!withToc) return null;
    // numbered headings + toc
    const hs = [...root.querySelectorAll("h2, h3, h4")];
    if (!hs.length) return null;
    const cnt = [0, 0, 0];
    const items = [];
    hs.forEach((h, i) => {
      const lv = +h.tagName[1] - 2;
      cnt[lv]++; for (let j = lv + 1; j < 3; j++) cnt[j] = 0;
      const num = cnt.slice(0, lv + 1).map((x) => x || 1).join(".") + ".";
      const id = "s-" + num.slice(0, -1);
      h.id = id;
      h.dataset.text = h.textContent;
      h.insertAdjacentHTML("afterbegin", `<a class="n" href="#" data-toc="1">${num}</a>`);
      items.push(`<a class="l${lv + 2}" href="#" data-sid="${id}"><span class="n">${num}</span>${esc(h.dataset.text)}</a>`);
    });
    return items.length >= 2 ? `<div class="toc" id="toc"><div class="tt">목차</div>${items.join("")}</div>` : null;
  }

  // ---------- trail (탐색 경로) ----------
  let trail = [];
  try { trail = JSON.parse(sessionStorage.getItem("wiki-trail") || "[]"); } catch (e) { trail = []; }
  let viaLink = false;
  function updateTrail(title) {
    const i = trail.indexOf(title);
    if (i >= 0) trail = trail.slice(0, i + 1);
    else if (viaLink && trail.length) trail.push(title);
    else trail = [title];
    viaLink = false;
    if (trail.length > 30) trail = trail.slice(-30);
    try { sessionStorage.setItem("wiki-trail", JSON.stringify(trail)); } catch (e) {}
  }
  function trailHtml() {
    if (trail.length < 2) return "";
    const parts = trail.map((t, i) => i === trail.length - 1
      ? `<span class="cur">${esc(t)}</span>`
      : `<a href="${href(t)}" data-trail="${i}">${esc(t)}</a>`);
    return `<div class="trail"><b>탐색 경로</b>${parts.join('<span class="sep">›</span>')}` +
      `<button data-trail="0" title="처음 출발한 문서로">↩ 출발점: ${esc(trail[0])}</button></div>`;
  }

  // ---------- views ----------
  const main = $("#main"), side = $("#side");
  function setTitle(t) { document.title = t + " - " + (W.name || "") + " 위키"; }

  function viewPage(title, sec) {
    const p = find(title);
    if (!p) return viewMissing(title);
    if (p.title !== title) { location.replace(href(p.title, sec)); return; }
    updateTrail(p.title);
    setTitle(p.title);
    const body = document.createElement("div");
    body.className = "body";
    body.innerHTML = renderMd(p.body);
    const toc = decorate(body, true);
    const parent = p.parent && p.parent !== p.title
      ? `<div class="parent">상위 문서: <a class="wl${find(p.parent) ? "" : " red"}" href="${href(find(p.parent) ? find(p.parent).title : p.parent)}" data-t="${esc(p.parent)}">${esc(p.parent)}</a></div>` : "";
    const meta = [
      `<span>분류: <a href="#/all::${enc(p.category)}">${esc(p.category)}</a></span>`,
      p.status ? `<span class="badge s-${esc(p.status)}">${esc(p.status)}</span>` : "",
      p.updated ? `<span>최근 수정 ${esc(p.updated)}</span>` : "",
      p.aliases && p.aliases.length ? `<span>다른 이름: ${p.aliases.map(esc).join(", ")}</span>` : "",
    ].join("");
    const bl = [...backlinks.get(p.title)].sort();
    main.innerHTML = trailHtml() +
      `<h1 class="ptitle">${esc(p.title)}</h1><div class="pmeta">${meta}</div>` + parent +
      (p.summary ? `<div class="summary">${renderInline(p.summary)}</div>` : "") +
      (toc || "");
    main.appendChild(body);
    main.insertAdjacentHTML("beforeend",
      `<div class="back"><h4>이 문서를 가리키는 문서 (${bl.length})</h4><div class="chips">` +
      (bl.length ? bl.map((t) => `<a class="chip wl" href="${href(t)}" data-t="${esc(t)}">${esc(t)}</a>`).join("") : "<span>없음</span>") +
      `</div><div class="src">원본: <code>${esc(p.file)}</code></div></div>`);
    if (sec) scrollToSec(sec); else window.scrollTo(0, 0);
    renderSide(p);
  }
  function scrollToSec(sec) {
    const s = sec.toLowerCase();
    const h = [...main.querySelectorAll(".body h2, .body h3, .body h4")].find((x) => (x.dataset.text || "").toLowerCase().includes(s));
    if (h) h.scrollIntoView({ block: "start" }); else window.scrollTo(0, 0);
    if (h) window.scrollBy(0, -60);
  }

  function viewMissing(title) {
    setTitle(title);
    const from = [...(redFrom.get(title.toLowerCase()) || [])];
    main.innerHTML = trailHtml() + `<h1 class="ptitle">${esc(title)}</h1><div class="pmeta"><span class="badge s-폐기">아직 없는 문서</span></div>
      <div class="body"><p>이 문서는 아직 작성되지 않았습니다. Claude에게 <code>[[${esc(title)}]] 문서 만들어줘</code>라고 요청하거나 <code>pages/</code>에 직접 <code>.md</code> 파일을 추가한 뒤 <code>python3 build.py</code>를 실행하세요.</p>
      ${from.length ? `<h3>이 문서를 기다리는 문서</h3><ul>${from.map((t) => `<li><a class="wl" href="${href(t)}" data-t="${esc(t)}">${esc(t)}</a></li>`).join("")}</ul>` : ""}</div>`;
    renderSide(null);
  }

  function groupByCat(pages) {
    const g = {};
    pages.forEach((p) => (g[p.category] = g[p.category] || []).push(p));
    return Object.keys(g).sort().map((k) => [k, g[k].sort((a, b) => a.title.localeCompare(b.title, "ko"))]);
  }
  function viewAll(cat) {
    setTitle("전체 문서");
    const groups = groupByCat(W.pages).filter(([k]) => !cat || k === cat);
    main.innerHTML = `<h1 class="ptitle">${cat ? "분류: " + esc(cat) : "전체 문서"}</h1><div class="pmeta"><span>${W.pages.length}개 문서</span>${cat ? '<a href="#/all">전체 보기</a>' : ""}</div>` +
      groups.map(([k, ps]) => `<div class="cat"><h3><a href="#/all::${enc(k)}">${esc(k)}</a> <small>(${ps.length})</small></h3><ul class="plist">` +
        ps.map((p) => `<li><a class="wl" href="${href(p.title)}" data-t="${esc(p.title)}">${esc(p.title)}</a>${p.status ? ` <span class="badge s-${esc(p.status)}">${esc(p.status)}</span>` : ""}<small>${esc(p.summary || "").replace(/\[\[([^\]|]+)(\|[^\]]*)?\]\]/g, "$1")}</small></li>`).join("") + "</ul></div>").join("");
    renderSide(null);
  }
  function viewRecent() {
    setTitle("최근 수정");
    const ps = [...W.pages].sort((a, b) => (b.updated || "").localeCompare(a.updated || "") || a.title.localeCompare(b.title, "ko"));
    main.innerHTML = `<h1 class="ptitle">최근 수정</h1><div class="pmeta"><span>빌드 ${esc(W.built)}</span></div><ul class="plist">` +
      ps.map((p) => `<li><small>${esc(p.updated || "-")}</small> <a class="wl" href="${href(p.title)}" data-t="${esc(p.title)}">${esc(p.title)}</a><small>${esc(p.category)}</small></li>`).join("") + "</ul>";
    renderSide(null);
  }

  // ---------- search ----------
  function plain(s) { return s.replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\\?\|([^\]]*))?\]\]/g, (_, a, b) => b || a).replace(/[#>*`$_]/g, ""); }
  function search(q) {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return W.pages.map((p) => {
      let score = 0;
      const t = p.title.toLowerCase();
      if (t === s) score += 100; else if (t.startsWith(s)) score += 60; else if (t.includes(s)) score += 40;
      if ((p.aliases || []).some((a) => a.toLowerCase().includes(s))) score += 35;
      if ((p.summary || "").toLowerCase().includes(s)) score += 10;
      const b = p.body.toLowerCase();
      let i = b.indexOf(s), n = 0;
      while (i >= 0 && n < 20) { n++; i = b.indexOf(s, i + s.length); }
      score += n * 2;
      return { p, score };
    }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  }
  function viewSearch(q) {
    setTitle("검색: " + q);
    const res = search(q);
    const s = q.toLowerCase();
    const snip = (p) => {
      const txt = plain(p.body).replace(/\s+/g, " ");
      const i = txt.toLowerCase().indexOf(s);
      if (i < 0) return esc(plain(p.summary || ""));
      const a = Math.max(0, i - 50), part = txt.slice(a, i + s.length + 80);
      return (a ? "…" : "") + esc(part).replace(new RegExp(esc(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), (m) => `<mark>${m}</mark>`) + "…";
    };
    main.innerHTML = `<h1 class="ptitle">검색: ${esc(q)}</h1><div class="pmeta"><span>${res.length}건</span></div>` +
      (find(q) ? "" : `<p>‘${esc(q)}’ 문서는 없습니다. <a class="wl red" href="${href(q)}" data-t="${esc(q)}">새 문서로 보기</a></p>`) +
      `<ul class="plist">${res.map(({ p }) => `<li><a class="wl" href="${href(p.title)}" data-t="${esc(p.title)}">${esc(p.title)}</a><small>${esc(p.category)}</small><div style="font-size:13px;color:var(--muted)">${snip(p)}</div></li>`).join("")}</ul>`;
    renderSide(null);
  }
  const qi = $("#q"), sg = $("#sugg");
  let sIdx = -1;
  qi.addEventListener("input", () => {
    const res = search(qi.value).slice(0, 8);
    sIdx = -1;
    if (!qi.value.trim()) { sg.hidden = true; return; }
    sg.innerHTML = res.map(({ p }) => `<a href="${href(p.title)}">${esc(p.title)}<small>${esc(p.category)}</small></a>`).join("") +
      `<a href="#/search/${enc(qi.value)}">‘${esc(qi.value)}’ 전체 검색</a>`;
    sg.hidden = false;
  });
  qi.addEventListener("keydown", (e) => {
    const as = [...sg.querySelectorAll("a")];
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      sIdx = (sIdx + (e.key === "ArrowDown" ? 1 : -1) + as.length) % as.length;
      as.forEach((a, i) => a.classList.toggle("on", i === sIdx));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (sIdx >= 0 && as[sIdx]) location.hash = as[sIdx].getAttribute("href");
      else { const r = find(qi.value); location.hash = r ? href(r.title) : "#/search/" + enc(qi.value); }
      sg.hidden = true; qi.blur();
    } else if (e.key === "Escape") { sg.hidden = true; qi.blur(); }
  });
  qi.addEventListener("blur", () => setTimeout(() => (sg.hidden = true), 150));
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== qi && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); qi.focus(); qi.select(); }
  });

  // ---------- sidebar ----------
  function renderSide(p) {
    const recent = [...W.pages].sort((a, b) => (b.updated || "").localeCompare(a.updated || "")).slice(0, 8);
    let html = "";
    if (p) {
      const out = (p.links || []).map((l) => find(l)).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i && x.title !== p.title);
      const kids = W.pages.filter((x) => x.parent && find(x.parent) === p);
      if (kids.length) html += `<div class="box"><h4>하위 문서</h4><ul>${kids.map((x) => `<li><a class="wl" href="${href(x.title)}" data-t="${esc(x.title)}">${esc(x.title)}</a></li>`).join("")}</ul></div>`;
      if (out.length) html += `<div class="box"><h4>이 문서가 가리키는 문서 (${out.length})</h4><ul>${out.map((x) => `<li><a class="wl" href="${href(x.title)}" data-t="${esc(x.title)}">${esc(x.title)}</a></li>`).join("")}</ul></div>`;
    }
    html += `<div class="box"><h4>최근 수정</h4><ul>${recent.map((x) => `<li><a class="wl" href="${href(x.title)}" data-t="${esc(x.title)}">${esc(x.title)}</a></li>`).join("")}</ul></div>`;
    html += `<div class="box"><h4>분류</h4><ul>${groupByCat(W.pages).map(([k, ps]) => `<li><a href="#/all::${enc(k)}">${esc(k)}</a> (${ps.length})</li>`).join("")}</ul></div>`;
    side.innerHTML = html;
  }

  // ---------- hover preview (중첩 가능) ----------
  const stack = []; // {el, link}
  let openT = null, closeT = null;
  const cache = new Map();
  function previewHtml(t) {
    if (cache.has(t)) return cache.get(t);
    const p = find(t);
    let h;
    if (!p) {
      h = `<div class="pv-h"><a href="${href(t)}" class="wl red" data-t="${esc(t)}">${esc(t)}</a></div><p>아직 없는 문서입니다.</p>`;
    } else {
      const div = document.createElement("div");
      // 첫 번째 h2 전까지(=개요) 또는 앞부분만
      const cut = p.body.split(/\n## /)[0];
      div.innerHTML = renderMd(cut.length > 40 ? cut : p.body.slice(0, 1400), { noFootnotes: true });
      decorate(div, false);
      [...div.children].slice(6).forEach((x) => x.remove());
      h = `<div class="pv-h"><a href="${href(p.title)}" class="wl" data-t="${esc(p.title)}">${esc(p.title)}</a>` +
        (p.status ? `<span class="badge s-${esc(p.status)}">${esc(p.status)}</span>` : "") + `<small style="color:var(--muted)">${esc(p.category)}</small></div>` +
        (p.summary ? `<div class="pv-s">${renderInline(p.summary)}</div>` : "") + div.innerHTML +
        `<div class="more">클릭하면 문서로 이동 · 미리보기 안의 링크에도 마우스를 올려 보세요</div>`;
    }
    cache.set(t, h);
    return h;
  }
  function levelOf(el) { const pv = el.closest && el.closest(".pv"); return pv ? +pv.dataset.level : 0; }
  function closeAbove(n) { while (stack.length > n) stack.pop().el.remove(); }
  function openPreview(a) {
    const lvl = levelOf(a);
    closeAbove(lvl);
    const t = a.dataset.t;
    if (!t) return;
    const pv = document.createElement("div");
    pv.className = "pv" + (find(t) ? "" : " red-pv");
    pv.dataset.level = lvl + 1;
    pv.innerHTML = previewHtml(t);
    document.body.appendChild(pv);
    const r = a.getBoundingClientRect();
    const w = pv.offsetWidth, h = pv.offsetHeight;
    let x = r.left + window.scrollX, y = r.bottom + window.scrollY + 6;
    x = Math.min(x, window.scrollX + document.documentElement.clientWidth - w - 12);
    x = Math.max(window.scrollX + 12, x);
    if (r.bottom + h + 12 > window.innerHeight && r.top - h - 6 > 0) y = r.top + window.scrollY - h - 6;
    pv.style.left = x + "px"; pv.style.top = y + "px";
    stack.push({ el: pv, link: a });
  }
  const canHover = window.matchMedia && window.matchMedia("(hover: hover)").matches;
  if (canHover) {
    document.addEventListener("mouseover", (e) => {
      const a = e.target.closest && e.target.closest("a.wl[data-t]");
      const lvl = levelOf(e.target);
      clearTimeout(closeT);
      if (a) {
        clearTimeout(openT);
        const already = stack[lvl] && stack[lvl].link === a;
        if (!already) openT = setTimeout(() => openPreview(a), 280);
      } else {
        clearTimeout(openT);
        closeT = setTimeout(() => closeAbove(lvl), 380);
      }
    });
  }

  // ---------- clicks ----------
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a, button");
    if (!a) return;
    if (a.dataset.fn) { e.preventDefault(); const el = document.getElementById("fn-" + a.dataset.fn); if (el) { el.scrollIntoView({ block: "center" }); el.style.background = "var(--soft)"; } return; }
    if (a.dataset.sid) { e.preventDefault(); document.getElementById(a.dataset.sid).scrollIntoView(); window.scrollBy(0, -60); return; }
    if (a.dataset.toc) { e.preventDefault(); const t = $("#toc"); if (t) { t.scrollIntoView(); window.scrollBy(0, -60); } return; }
    if (a.dataset.sec) { e.preventDefault(); scrollToSec(a.dataset.sec); return; }
    if (a.dataset.trail !== undefined) {
      e.preventDefault();
      const i = +a.dataset.trail; const t = trail[i];
      trail = trail.slice(0, i + 1); viaLink = true;
      try { sessionStorage.setItem("wiki-trail", JSON.stringify(trail)); } catch (err) {}
      location.hash = href(t); closeAbove(0); return;
    }
    if (a.classList.contains("wl")) { viaLink = !!a.closest("main, .pv"); closeAbove(0); }
  });

  // ---------- router ----------
  function route() {
    closeAbove(0);
    const h = decodeURIComponent(location.hash.slice(1) || "/w/" + W.root);
    if (h.startsWith("/w/")) { const [t, sec] = h.slice(3).split("::"); viewPage(t, sec); }
    else if (h.startsWith("/all")) viewAll(h.split("::")[1]);
    else if (h === "/recent") viewRecent();
    else if (h.startsWith("/search/")) viewSearch(h.slice(8));
    else if (h === "/random") { const p = W.pages[Math.floor(Math.random() * W.pages.length)]; location.replace(href(p.title)); }
    else viewPage(W.root);
  }
  window.addEventListener("hashchange", route);
  const logo = $("#logo");
  if (logo) { logo.href = "#/w/" + enc(W.root); logo.innerHTML = esc(W.name || "") + "<span>위키</span>"; }
  $("#foot").innerHTML = `문서 ${W.pages.length}개 · 빌드 ${esc(W.built)} · 링크에 마우스를 올리면 미리보기 · <kbd>/</kbd> 검색`;
  route();
})();
