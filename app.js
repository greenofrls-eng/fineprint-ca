/* Fine Print CA — app
   Hash-routed single page. Data comes from Supabase when configured, otherwise
   from data/measures.json so the site runs with no backend at all. */
(function () {
  "use strict";
  const CFG = window.FP_CONFIG || {};
  const app = document.getElementById("app");
  const useSupabase = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase);
  const sb = useSupabase ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;

  let DATA = null; // { election, measures:[...], ads:[...] } normalized to the JSON shape

  // ---------- helpers ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const list = (arr) => (arr && arr.length ? `<ul>${arr.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "");
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
  const fmtDate = (d) => { try { return new Date(d + "T12:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }); } catch { return d; } };

  // ---------- data ----------
  async function loadData() {
    if (DATA) return DATA;
    if (useSupabase) {
      const [{ data: el }, { data: ms, error }, { data: cs }, { data: ads }, { data: claims }] = await Promise.all([
        sb.from("elections").select("*").limit(1).single(),
        sb.from("measures").select("*").order("number"),
        sb.from("committees").select("*").order("sort_order"),
        sb.from("ads").select("*"),
        sb.from("claims").select("*").order("sort_order"),
      ]);
      if (error) throw error;
      const byId = {};
      const measures = ms.map((m) => {
        const out = {
          id: m.id, number: m.number, slug: m.slug, short_title: m.short_title, official_title: m.official_title,
          type: m.type, origin: m.origin, what_it_does: m.what_it_does, yes_means: m.yes_means, no_means: m.no_means,
          fiscal_impact: m.fiscal_impact, pro_arguments: m.pro_arguments, con_arguments: m.con_arguments,
          leaves_out: { yes: m.leaves_out_yes, no: m.leaves_out_no }, campaign_links: m.campaign_links, sources: m.sources,
          committees: (cs || []).filter((c) => c.measure_id === m.id),
        };
        byId[m.id] = m.number;
        return out;
      });
      const adsN = (ads || []).map((a) => ({ ...a, measure: byId[a.measure_id], claims: (claims || []).filter((c) => c.ad_id === a.id) }));
      DATA = { election: { name: el?.name, date: el?.election_date, funding_as_of: el?.funding_as_of }, measures, ads: adsN };
    } else {
      const r = await fetch("data/measures.json", { cache: "no-cache" });
      if (!r.ok) throw new Error("Could not load data/measures.json");
      DATA = await r.json();
    }
    const fd = document.querySelector("[data-funding-date]");
    if (fd && DATA.election?.funding_as_of) fd.textContent = fmtDate(DATA.election.funding_as_of);
    return DATA;
  }

  const adsFor = (num, side) => (DATA.ads || []).filter((a) => a.measure === num && a.side === side && a.status !== "draft" && a.status !== "rejected");

  // ---------- views ----------
  function viewIndex() {
    const { election, measures } = DATA;
    const cards = measures.map((m) => {
      const y = adsFor(m.number, "yes").length, n = adsFor(m.number, "no").length;
      return `<a class="card" href="#/${esc(m.slug)}">
        <div class="num">Prop ${m.number}</div>
        <h3>${esc(m.short_title)}</h3>
        <div class="desc">${esc(m.official_title.replace(/\.\s*(Legislative|Initiative)[^.]*\.?$/, "."))}</div>
        <div class="meta">
          <span class="pill yes">${y} Yes ad${y === 1 ? "" : "s"}</span>
          <span class="pill no">${n} No ad${n === 1 ? "" : "s"}</span>
          <span class="pill neutral">${esc((m.type || "").replace("Initiative Constitutional Amendment and Statute", "Initiative Amend. + Statute"))}</span>
        </div>
      </a>`;
    }).join("");
    return `
      <section class="hero">
        <div class="kicker">${esc(election.name)} · ${fmtDate(election.date)}</div>
        <h1>Every ballot-measure ad, and what it leaves out.</h1>
        <p>Fourteen propositions. For each one: what it actually does, the official arguments on both sides, who is paying for the ads, and the part each side's commercials tend to skip. Same treatment for Yes and No.</p>
        <p class="small muted">Saw a TV spot and want it checked? <a href="#/report">Tell us what it said</a>.</p>
      </section>
      <div class="grid">${cards}</div>`;
  }

  function committeeHtml(c) {
    return `<div class="committee">
      <span class="cname">${esc(c.name)}</span>${c.fppc_id ? `<span class="fppc">FPPC #${esc(c.fppc_id)}</span>` : ""}
      ${c.raised ? `<div class="raised">${esc(c.raised)}</div>` : ""}
      ${c.top_funders && c.top_funders.length ? `<ul>${c.top_funders.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}
    </div>`;
  }

  function adHtml(a) {
    const needs = a.status === "needs_transcript";
    const claims = (a.claims || []).map((c) => `<div class="claim">
        <div class="says"><span class="lbl">The ad says</span>${esc(c.claim)}</div>
        <div class="leaves-out"><span class="lbl">What it leaves out</span>${esc(c.context)}${c.source_url ? ` <a href="${esc(c.source_url)}" target="_blank" rel="noopener">source</a>` : ""}</div>
      </div>`).join("");
    return `<div class="ad ${needs ? "needs" : ""}">
      <div class="ad-title">${esc(a.title)}</div>
      <div class="ad-meta">${esc(a.format || "Ad")} · ${esc(a.sponsor || "")}${a.first_seen ? ` · first seen ${esc(a.first_seen)}` : ""}</div>
      ${a.url ? `<div class="ad-link"><a href="${esc(a.url)}" target="_blank" rel="noopener">Watch / view on ${esc(host(a.url))} ↗</a></div>` : ""}
      ${claims}
      ${needs && !claims ? `<div class="todo">Transcript not yet reviewed. <a href="#/report?prop=${a.measure}">Saw it? Tell us what it claimed.</a></div>` : ""}
    </div>`;
  }

  function sideHtml(m, side) {
    const isYes = side === "yes";
    const label = isYes ? "Yes" : "No";
    const args = isYes ? m.pro_arguments : m.con_arguments;
    const leaves = (m.leaves_out || {})[side] || [];
    const committees = (m.committees || []).filter((c) => c.side === side);
    const ads = adsFor(m.number, side);
    const links = ((m.campaign_links || {})[side] || []).map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(host(u))} ↗</a>`).join("");
    return `<div class="side ${side}">
      <div class="side-head">The ${label} side</div>
      <div class="side-body">
        <h3>Official ${label} argument (voter guide)</h3>
        ${list(args) || "<p class='no-ads'>No argument filed.</p>"}
        <div class="leaves">
          <h3>What the ${label} ads tend to leave out</h3>
          ${list(leaves) || "<p class='no-ads'>Nothing catalogued yet.</p>"}
        </div>
        <h3>Ads (${ads.length})</h3>
        ${ads.length ? ads.map(adHtml).join("") : `<p class="no-ads">No ${label} ads catalogued yet. <a href="#/report?prop=${m.number}">Seen one?</a></p>`}
        <h3>Who is paying</h3>
        ${committees.length ? committees.map(committeeHtml).join("") : "<p class='no-ads'>No committee reported.</p>"}
        ${links ? `<h3>Campaign sites</h3><p class="links">${links}</p>` : ""}
      </div>
    </div>`;
  }

  function viewMeasure(slug) {
    const m = DATA.measures.find((x) => x.slug === slug);
    if (!m) return `<section class="hero"><h1>Not found</h1><p><a href="#/">Back to all measures</a></p></section>`;
    document.title = `Prop ${m.number}: ${m.short_title} — Fine Print CA`;
    return `
      <div class="measure-head">
        <div class="num">Proposition ${m.number}</div>
        <h1>${esc(m.short_title)}</h1>
        <div class="official">${esc(m.official_title)}</div>
        <div class="origin">${esc(m.origin || m.type || "")}</div>
      </div>

      <section class="section">
        <h2>What it actually does</h2>
        <p class="what">${esc(m.what_it_does)}</p>
        <div class="yn">
          <div class="yes-box"><strong>A Yes vote means</strong>${esc(m.yes_means)}</div>
          <div class="no-box"><strong>A No vote means</strong>${esc(m.no_means)}</div>
        </div>
        <div class="fiscal"><strong>Fiscal effect (Legislative Analyst):</strong> ${esc(m.fiscal_impact)}</div>
      </section>

      <section class="section">
        <h2>Both sides, side by side</h2>
        <div class="sides">${sideHtml(m, "yes")}${sideHtml(m, "no")}</div>
      </section>

      <section class="section">
        <h2>Saw an ad about Prop ${m.number}?</h2>
        ${formHtml(m.number)}
      </section>

      <section class="section sources">
        <h2>Sources</h2>
        ${list(m.sources).replace(/<li>(.*?)<\/li>/g, (_, u) => `<li><a href="${u}" target="_blank" rel="noopener">${u}</a></li>`)}
      </section>
      <a class="back" href="#/">← All measures</a>`;
  }

  function formHtml(preselect) {
    const opts = DATA.measures.map((m) => `<option value="${m.number}" ${String(m.number) === String(preselect) ? "selected" : ""}>Prop ${m.number} — ${esc(m.short_title)}</option>`).join("");
    return `<form class="form" id="report-form">
      <p class="small muted">Tell us what the ad claimed and where you saw it. We'll find the spot, check it against the measure text and official arguments, and add it to the page. Both sides welcome.</p>
      <label for="r-measure">Which measure?</label>
      <select id="r-measure" name="measure_id" required><option value="">Choose…</option>${opts}<option value="unsure">Not sure</option></select>
      <label for="r-side">Was it for or against?</label>
      <select id="r-side" name="side"><option value="unsure">Not sure</option><option value="yes">For (Yes)</option><option value="no">Against (No)</option></select>
      <label for="r-where">Where did you see it?</label>
      <input id="r-where" name="where_seen" placeholder="e.g. KTVU during the 6pm news, YouTube pre-roll, Instagram">
      <label for="r-what">What did it say? (as close to word-for-word as you can)</label>
      <textarea id="r-what" name="what_it_said" required></textarea>
      <label for="r-link">Link to the ad, if you have one</label>
      <input id="r-link" name="link" type="url" placeholder="https://">
      <label for="r-email">Your email (optional, only if you want a reply)</label>
      <input id="r-email" name="contact_email" type="email">
      <button type="submit">Send it in</button>
      <div class="msg"></div>
    </form>`;
  }

  function viewReport(params) {
    document.title = "I saw an ad — Fine Print CA";
    return `<section class="hero"><h1>I saw an ad.</h1><p>Political ads are legally allowed to leave things out. Tell us about one and we'll fill in the fine print.</p></section>${formHtml(params.get("prop"))}`;
  }

  function viewAbout() {
    document.title = "How this works — Fine Print CA";
    return `<section class="hero"><h1>How this works</h1></section>
    <div class="prose">
      <p>A 30-second ballot-measure ad can't explain a 40-page initiative, so it picks the one angle that polls best. The thing you'd want to know—who funded it, what the measure actually does, who loses if it passes—is almost never in the ad. This site is the fine print.</p>
      <h2>Neutral by construction</h2>
      <p>We organize by measure, not by ad, and every measure gets the same template: what it does (from the official voter guide), the fiscal effect (from the nonpartisan Legislative Analyst), the official Yes and No arguments, the committees and top funders on each side (from state FPPC filings), and a list of what each side's ads tend to leave out. Yes and No get the same boxes, in the same order, with the same sourcing standard.</p>
      <h2>"What it leaves out" is not "what is false"</h2>
      <p>We don't rate ads true or false. We list the facts from official sources that the ad's framing omits. Most of the time the ad is technically accurate and the omission is what matters.</p>
      <h2>Where the ads come from</h2>
      <p>Campaign YouTube channels, campaign websites, the Meta Ad Library, the Google Ads Transparency Center, and viewers who <a href="#/report">tell us what they saw</a>. We link to ads; we don't host or edit them.</p>
      <h2>Sources</h2>
      <p>The <a href="https://voterguide.sos.ca.gov/propositions/" target="_blank" rel="noopener">California Official Voter Information Guide</a>, the <a href="https://lao.ca.gov/" target="_blank" rel="noopener">Legislative Analyst's Office</a> ballot analyses, the <a href="https://www.fppc.ca.gov/search-filings/top-10-contributors-list/november-2026-general-election/" target="_blank" rel="noopener">FPPC Top 10 Contributors list</a>, and nonpartisan coverage from CalMatters, KQED, and KPBS. Each measure page lists its sources.</p>
      <h2>This is a test</h2>
      <p>California, November 2026, ballot measures only. If it's useful, it grows.</p>
    </div>`;
  }

  // ---------- form submit ----------
  async function handleSubmit(e) {
    e.preventDefault();
    const f = e.target, msg = f.querySelector(".msg"), btn = f.querySelector("button");
    const fd = Object.fromEntries(new FormData(f).entries());
    msg.className = "msg"; msg.textContent = "";
    if (!fd.what_it_said?.trim()) return;
    btn.disabled = true;
    try {
      if (useSupabase) {
        const num = parseInt(fd.measure_id, 10);
        const m = DATA.measures.find((x) => x.number === num);
        const row = {
          measure_id: m ? m.id : null, side: fd.side || "unsure", where_seen: fd.where_seen || null,
          what_it_said: fd.what_it_said.trim(), link: fd.link || null, contact_email: fd.contact_email || null,
        };
        const { error } = await sb.from("ad_reports").insert(row);
        if (error) throw error;
      } else {
        const body = `Measure: Prop ${fd.measure_id}\nSide: ${fd.side}\nWhere: ${fd.where_seen}\nLink: ${fd.link}\n\nWhat it said:\n${fd.what_it_said}\n\nFrom: ${fd.contact_email}`;
        window.location.href = `mailto:${CFG.REPORT_EMAIL}?subject=${encodeURIComponent("Ad report: Prop " + fd.measure_id)}&body=${encodeURIComponent(body)}`;
      }
      msg.className = "msg ok"; msg.textContent = "Thanks. We'll check it and add it to the page.";
      f.reset();
    } catch (err) {
      msg.className = "msg err"; msg.textContent = "Couldn't send that: " + (err.message || err);
    } finally { btn.disabled = false; }
  }

  // ---------- router ----------
  async function render() {
    try {
      await loadData();
      const raw = location.hash.replace(/^#\/?/, "");
      const [path, qs] = raw.split("?");
      const params = new URLSearchParams(qs || "");
      let html;
      if (!path) { document.title = "Fine Print CA — What the ballot ads leave out"; html = viewIndex(); }
      else if (path === "about") html = viewAbout();
      else if (path === "report") html = viewReport(params);
      else html = viewMeasure(path);
      app.innerHTML = html;
      window.scrollTo(0, 0);
      const form = document.getElementById("report-form");
      if (form) form.addEventListener("submit", handleSubmit);
    } catch (err) {
      app.innerHTML = `<section class="hero"><h1>Something broke</h1><p class="muted">${esc(err.message || err)}</p></section>`;
      console.error(err);
    }
  }
  window.addEventListener("hashchange", render);
  render();
})();
