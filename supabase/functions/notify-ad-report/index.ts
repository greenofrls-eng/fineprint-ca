// Edge Function: notify-ad-report
// Called by a database trigger (see supabase/webhook.sql) whenever a row is
// inserted into ad_reports. Emails the report to NOTIFY_TO via Resend.
//
// Secrets (set in Supabase → Edge Functions → Secrets, or via the Management API):
//   RESEND_API_KEY  – from resend.com
//   NOTIFY_TO       – where to send the email
//   NOTIFY_FROM     – a verified sender on your Resend domain, e.g. "Fine Print CA <reports@yourdomain.com>"
//   NOTIFY_SECRET   – shared secret; the trigger sends it as a Bearer token
//   DASHBOARD_URL   – optional; link to the ad_reports table in the Supabase dashboard

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const secret = Deno.env.get("NOTIFY_SECRET") ?? "";
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });

  let payload: any;
  try { payload = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }
  const r = payload?.record ?? payload;
  if (!r || !r.what_it_said) return new Response("No record", { status: 400 });

  const measure = r.measure_number ? `Prop ${r.measure_number}${r.measure_title ? " — " + r.measure_title : ""}` : "Measure not specified";
  const side = { yes: "For (Yes)", no: "Against (No)" }[r.side as string] ?? "Not sure";
  const esc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
  const dash = Deno.env.get("DASHBOARD_URL");

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:640px;line-height:1.5">
      <h2 style="margin:0 0 4px">New ad report: ${esc(measure)}</h2>
      <p style="color:#666;margin:0 0 16px">${esc(side)} · ${esc(r.where_seen || "location not given")} · ${esc(r.created_at || "")}</p>
      <blockquote style="border-left:4px solid #2f4f4f;margin:0 0 16px;padding:8px 14px;background:#f6f5f2;white-space:pre-wrap">${esc(r.what_it_said)}</blockquote>
      ${r.link ? `<p><b>Link:</b> <a href="${esc(r.link)}">${esc(r.link)}</a></p>` : ""}
      ${r.contact_email ? `<p><b>From:</b> ${esc(r.contact_email)}</p>` : ""}
      ${dash ? `<p><a href="${esc(dash)}">Open ad_reports in Supabase</a> (id ${esc(r.id)})</p>` : `<p style="color:#888">id ${esc(r.id)}</p>`}
    </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("NOTIFY_FROM") ?? "Fine Print CA <onboarding@resend.dev>",
      to: [Deno.env.get("NOTIFY_TO")],
      subject: `[Fine Print CA] Ad report: ${measure} (${side})`,
      html,
      ...(r.contact_email ? { reply_to: r.contact_email } : {}),
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    console.error("Resend error", res.status, t);
    return new Response(`Resend error: ${t}`, { status: 502 });
  }
  return new Response("ok");
});
