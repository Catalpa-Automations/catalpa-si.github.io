const STAGES = ["All", "New", "Contacted", "Quoted", "Won", "Lost"];

const state = {
  stage: "All",
  q: "",
  leads: [],
  stats: null,
};

const $ = (id) => document.getElementById(id);

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function fmtGhs(n) {
  return Number(n || 0).toLocaleString("en-GH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function renderStats() {
  const s = state.stats;
  if (!s) return;
  const items = [
    { k: "Total", v: s.total },
    ...s.stages.map((st) => ({ k: st, v: s.byStage[st] || 0 })),
    { k: "Pipeline GHS", v: fmtGhs(s.pipelineGhs) },
    { k: "Won GHS", v: fmtGhs(s.wonGhs) },
  ];
  $("stats").innerHTML = items
    .map(
      (i) => `<div class="stat"><div class="k">${i.k}</div><div class="v">${i.v}</div></div>`
    )
    .join("");
}

function renderFilters() {
  $("stage-filters").innerHTML = STAGES.map(
    (s) =>
      `<button type="button" class="chip${state.stage === s ? " active" : ""}" data-stage="${s}">${s}</button>`
  ).join("");
}

function renderRows() {
  const tbody = $("rows");
  const empty = $("empty");
  if (!state.leads.length) {
    tbody.innerHTML = "";
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  tbody.innerHTML = state.leads
    .map((l) => {
      const phoneDisp = l.phone ? `+${l.phone}` : "—";
      return `<tr data-id="${l.id}">
        <td>
          <div class="lead-name">${escapeHtml(l.name)}</div>
          <div class="lead-meta">${escapeHtml(phoneDisp)} · ${escapeHtml(l.city || "—")}</div>
        </td>
        <td><span class="badge ${escapeHtml(l.stage)}">${escapeHtml(l.stage)}</span></td>
        <td>${fmtGhs(l.valueGhs)}</td>
        <td>${escapeHtml(l.source || "—")}</td>
        <td>
          <a class="btn wa" href="${escapeAttr(l.waLink)}" target="_blank" rel="noopener">Chat</a>
          ${
            l.stage === "Quoted" || l.stage === "Contacted"
              ? `<a class="btn ghost" href="${escapeAttr(l.waQuoteLink)}" target="_blank" rel="noopener">Quote</a>`
              : ""
          }
        </td>
        <td>
          <div class="row-actions">
            <button type="button" class="btn ghost edit">Edit</button>
            ${stageButtons(l)}
          </div>
        </td>
      </tr>`;
    })
    .join("");
}

function stageButtons(lead) {
  const order = ["New", "Contacted", "Quoted", "Won", "Lost"];
  const i = order.indexOf(lead.stage);
  const next = order[i + 1];
  if (!next || lead.stage === "Won" || lead.stage === "Lost") return "";
  return `<button type="button" class="btn ghost advance" data-next="${next}">→ ${next}</button>`;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

async function refresh() {
  const q = encodeURIComponent(state.q);
  const stage = encodeURIComponent(state.stage);
  const [leadsRes, statsRes] = await Promise.all([
    api(`/api/leads?stage=${stage}&q=${q}`),
    api("/api/stats"),
  ]);
  state.leads = leadsRes.leads;
  state.stats = statsRes;
  renderStats();
  renderFilters();
  renderRows();
}

function openDialog(lead) {
  const dlg = $("dlg");
  $("dlg-title").textContent = lead ? "Edit lead" : "New lead";
  $("f-id").value = lead?.id || "";
  $("f-name").value = lead?.name || "";
  $("f-phone").value = lead?.phone || "";
  $("f-city").value = lead?.city || "Accra";
  $("f-stage").value = lead?.stage || "New";
  $("f-source").value = lead?.source || "";
  $("f-value").value = lead?.valueGhs ?? 0;
  $("f-notes").value = lead?.notes || "";
  $("btn-delete").hidden = !lead;
  dlg.showModal();
}

function closeDialog() {
  $("dlg").close();
}

$("btn-new").addEventListener("click", () => openDialog(null));
$("dlg-close").addEventListener("click", closeDialog);

$("stage-filters").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-stage]");
  if (!btn) return;
  state.stage = btn.dataset.stage;
  refresh().catch(alert);
});

let qTimer;
$("q").addEventListener("input", (e) => {
  clearTimeout(qTimer);
  qTimer = setTimeout(() => {
    state.q = e.target.value.trim();
    refresh().catch(alert);
  }, 200);
});

$("rows").addEventListener("click", async (e) => {
  const tr = e.target.closest("tr[data-id]");
  if (!tr) return;
  const id = tr.dataset.id;
  const lead = state.leads.find((l) => l.id === id);
  if (e.target.closest(".edit")) {
    openDialog(lead);
    return;
  }
  const adv = e.target.closest(".advance");
  if (adv && lead) {
    try {
      await api(`/api/leads/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ stage: adv.dataset.next }),
      });
      await refresh();
    } catch (err) {
      alert(err.message);
    }
  }
});

$("lead-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = $("f-id").value;
  const body = {
    name: $("f-name").value,
    phone: $("f-phone").value,
    city: $("f-city").value,
    stage: $("f-stage").value,
    source: $("f-source").value,
    valueGhs: Number($("f-value").value) || 0,
    notes: $("f-notes").value,
  };
  try {
    if (id) {
      await api(`/api/leads/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    } else {
      await api("/api/leads", { method: "POST", body: JSON.stringify(body) });
    }
    closeDialog();
    await refresh();
  } catch (err) {
    alert(err.message);
  }
});

$("btn-delete").addEventListener("click", async () => {
  const id = $("f-id").value;
  if (!id || !confirm("Delete this lead?")) return;
  try {
    await api(`/api/leads/${encodeURIComponent(id)}`, { method: "DELETE" });
    closeDialog();
    await refresh();
  } catch (err) {
    alert(err.message);
  }
});

refresh().catch((err) => {
  $("empty").hidden = false;
  $("empty").textContent = `Could not load CRM: ${err.message}. Is the server running?`;
});
