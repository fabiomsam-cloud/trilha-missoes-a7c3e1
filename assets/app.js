/* Trilha de Missões — vídeos de aquecimento no YouTube (Sou Concurseiro e Vou Passar)
   21/09/2026. Config vem de window.TRILHA (definida em cada /frente/index.html).
   Fluxo: gate (nome + WhatsApp, 1x, fica no navegador) → trilha (missões em ordem) → player YouTube
   com medição real de reprodução (segundos tocados, ignora pulos) → progresso no Data Core → ranking. */
(function () {
  const C = window.TRILHA;
  const API = "https://dqpxugdhlgafvddavzzp.supabase.co/functions/v1/missoes";
  const API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxcHh1Z2RobGdhZnZkZGF2enpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxODQ1NTMsImV4cCI6MjA5Nzc2MDU1M30.nUhYPO3oLUZEXgQCDlRtL-Jawi0nr0l1Z7_z5ecEXvc";
  const STORE = "trilha_" + C.frente.toLowerCase();
  const SEQUENCIAL = C.sequencial !== false;
  const PATENTES = C.patentes || ["Recruta", "Soldado", "Cabo", "Sargento", "Tenente", "Capitão", "Comandante"];
  const $ = (s, el) => (el || document).querySelector(s);

  const state = { me: null, missoes: [], progresso: {}, posicao: null, pct: 75, aberta: null };
  let player = null, tick = null, watch = null; // watch = {missao, dur, seg, last, lastFlush, pctSent}

  /* ---------- storage ---------- */
  const load = () => { try { return JSON.parse(localStorage.getItem(STORE) || "null"); } catch (e) { return null; } };
  const save = (o) => { try { localStorage.setItem(STORE, JSON.stringify(o)); } catch (e) {} };
  const segKey = (id) => STORE + "_seg_" + id;
  const loadSeg = (id) => { try { return Number(localStorage.getItem(segKey(id)) || 0); } catch (e) { return 0; } };
  const saveSeg = (id, s) => { try { localStorage.setItem(segKey(id), String(Math.round(s))); } catch (e) {} };

  /* ---------- api ---------- */
  async function api(payload, opts) {
    const res = await fetch(API, Object.assign({ method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + API_KEY, apikey: API_KEY }, body: JSON.stringify(Object.assign({ frente: C.frente }, payload)) }, opts || {}));
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || "Falha de conexão. Tente de novo.");
    return j;
  }
  const px = (ev, data) => { try { if (window.fbq) fbq("trackCustom", ev, data || {}); } catch (e) {} };

  /* ---------- helpers ---------- */
  const fmtTel = (v) => { const d = v.replace(/\D/g, "").slice(0, 11); if (d.length <= 2) return d; if (d.length <= 7) return "(" + d.slice(0, 2) + ") " + d.slice(2); return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7); };
  const done = (m) => !!(state.progresso[m.id] && state.progresso[m.id].concluida_em);
  const pctReal = (m) => { const p = state.progresso[m.id]; if (!p || !p.duracao_seg) return 0; return Math.min(100, Math.round((p.seg_assistidos / p.duracao_seg) * 100)); };
  const totalDone = () => state.missoes.filter(done).length;
  const patente = () => { const n = state.missoes.length || 1; const d = totalDone(); const idx = d >= n ? PATENTES.length - 1 : Math.min(PATENTES.length - 2, Math.floor((d / n) * (PATENTES.length - 1))); return PATENTES[Math.max(0, idx)]; };
  const disponivel = (i) => !SEQUENCIAL || i === 0 || done(state.missoes[i - 1]);
  const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const primeiro = (s) => (s || "").trim().split(" ")[0];

  /* ---------- gate ---------- */
  function showGate() {
    $("#gate").style.display = "";
    $("#trilha").style.display = "none";
    const tel = $("#tel");
    tel.addEventListener("input", () => { tel.value = fmtTel(tel.value); });
    $("#entrar").addEventListener("click", entrar);
    $("#gate form").addEventListener("submit", (e) => { e.preventDefault(); entrar(); });
  }
  async function entrar() {
    const nome = $("#nome").value.trim(), telefone = $("#tel").value;
    const btn = $("#entrar"), err = $("#gate .err");
    err.textContent = "";
    if (nome.length < 2) { err.textContent = "Digite seu nome."; return; }
    if (telefone.replace(/\D/g, "").length < 10) { err.textContent = "Digite seu WhatsApp com DDD."; return; }
    btn.disabled = true; btn.textContent = "Entrando…";
    try {
      const r = await api({ op: "entrar", nome, telefone });
      state.me = r.participante; state.missoes = r.missoes; state.progresso = r.progresso; state.posicao = r.posicao; state.pct = r.pct_conclusao;
      save({ tel: r.participante.tel, nome: r.participante.nome });
      px("TrilhaEntrou", { frente: C.frente });
      showTrilha();
    } catch (e) { err.textContent = e.message; }
    btn.disabled = false; btn.textContent = "Começar as missões";
  }

  /* ---------- trilha ---------- */
  function showTrilha() {
    $("#gate").style.display = "none";
    $("#trilha").style.display = "";
    renderStatus(); renderMissoes(); loadRanking();
  }
  function renderStatus() {
    const n = state.missoes.length, d = totalDone();
    $("#who").innerHTML = "Olá, <b>" + esc(primeiro(state.me.nome)) + "</b>" + (state.posicao && state.posicao.pontos > 0 ? " · você está em <b>" + state.posicao.posicao + "º</b>" : "");
    $("#patente").textContent = patente();
    $("#insig").textContent = d >= n && n ? "🏆" : d > 0 ? "🎖️" : "🪖";
    $("#bar i").style.width = (n ? (d / n) * 100 : 0) + "%";
    $("#barlbl").innerHTML = "<span><b>" + d + "</b> de " + n + " missões cumpridas</span><span><b>" + (state.posicao ? state.posicao.pontos : 0) + "</b> pts</span>";
    $("#aviso").style.display = state.me.membro ? "none" : "";
  }
  function renderMissoes() {
    const box = $("#missoes"); box.innerHTML = "";
    if (!state.missoes.length) { box.innerHTML = '<div class="empty">A primeira missão será liberada em breve. Fique de olho no grupo. 👀</div>'; return; }
    state.missoes.forEach((m, i) => {
      const isDone = done(m), avail = disponivel(i);
      const el = document.createElement("div");
      el.className = "missao " + (isDone ? "done" : avail ? "" : "locked");
      el.dataset.id = m.id;
      el.innerHTML =
        '<button class="mhead" type="button">' +
          '<div class="mnum display">' + (isDone ? "✔" : avail ? String(m.ordem).padStart(2, "0") : "🔒") + "</div>" +
          '<div><div class="mtit display">' + esc(m.titulo) + "</div>" +
          '<div class="msub">' + (isDone ? "Missão cumprida · +" + m.pontos + " pts" : avail ? (pctReal(m) > 0 ? pctReal(m) + "% assistido · continue" : "Vale " + m.pontos + " pts") : "Cumpra a missão anterior para liberar") + "</div></div>" +
          '<div class="mst">' + (isDone ? "Cumprida" : avail ? "Assistir" : "Bloqueada") + "</div>" +
        "</button>" +
        '<div class="mbody">' +
          (m.descricao ? '<div class="mdesc">' + esc(m.descricao) + "</div>" : "") +
          '<div class="player"><div id="yt-' + m.id + '"></div></div>' +
          '<div class="mprog"><div class="bar"><i style="width:' + pctReal(m) + '%"></i></div><div class="barlbl"><span>Assistido: <b class="pctlbl">' + pctReal(m) + "%</b></span><span>Missão cumprida em " + state.pct + "%</span></div></div>" +
          '<div class="mdone" style="display:' + (isDone ? "" : "none") + '">' +
            '<a class="btn wa" target="_blank" rel="noopener" href="' + shareUrl(m) + '">📲 Contar no grupo que cumpri</a>' +
          "</div>" +
        "</div>";
      $(".mhead", el).addEventListener("click", () => { if (avail || isDone) toggle(m, el); });
      box.appendChild(el);
    });
    // reabre a que estava aberta ou abre a próxima disponível
    const alvo = state.aberta ? state.missoes.find((m) => m.id === state.aberta) : state.missoes.find((m, i) => !done(m) && disponivel(i));
    if (alvo) toggle(alvo, box.querySelector('[data-id="' + alvo.id + '"]'), true);
  }
  function shareUrl(m) {
    const txt = "Missão " + m.ordem + " cumprida ✅ \"" + m.titulo + "\" — " + C.titulo + ". Bora, quem mais? " + location.href.split("?")[0];
    return "https://wa.me/?text=" + encodeURIComponent(txt);
  }
  function toggle(m, el, force) {
    const jaAberta = el.classList.contains("open");
    document.querySelectorAll(".missao.open").forEach((x) => x.classList.remove("open"));
    if (jaAberta && !force) { stopPlayer(); state.aberta = null; return; }
    el.classList.add("open"); state.aberta = m.id;
    mountPlayer(m, el);
    if (!force) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---------- YouTube ---------- */
  let ytReady = new Promise((res) => { if (window.YT && YT.Player) res(); else { window.onYouTubeIframeAPIReady = res; const s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(s); } });
  function stopPlayer() { if (tick) { clearInterval(tick); tick = null; } flush(true); if (player) { try { player.destroy(); } catch (e) {} player = null; } watch = null; }
  async function mountPlayer(m, el) {
    stopPlayer();
    await ytReady;
    const seg0 = Math.max(loadSeg(m.id), (state.progresso[m.id] || {}).seg_assistidos || 0);
    // duração: a cadastrada na missão manda (o player pode responder a duração do anúncio antes do vídeo)
    watch = { missao: m, el, dur: m.duracao_seg || 0, durFixa: !!m.duracao_seg, seg: seg0, last: null, lastFlush: Date.now(), busy: false };
    player = new YT.Player("yt-" + m.id, {
      videoId: m.youtube_id, playerVars: { rel: 0, modestbranding: 1, playsinline: 1, origin: location.origin },
      events: {
        onReady: (e) => { if (!watch.durFixa) { const d = e.target.getDuration(); if (d > 0) watch.dur = Math.round(d); } },
        onStateChange: (e) => {
          if (e.data === YT.PlayerState.PLAYING) { watch.last = player.getCurrentTime(); if (!tick) tick = setInterval(onTick, 1000); px("MissaoIniciada", { frente: C.frente, missao: m.ordem }); }
          else { if (tick) { clearInterval(tick); tick = null; } watch.last = null; flush(e.data === YT.PlayerState.ENDED); }
        },
      },
    });
  }
  function onTick() {
    if (!player || !watch) return;
    const cur = player.getCurrentTime();
    if (!watch.durFixa) { const d = player.getDuration(); if (d > 0) watch.dur = Math.round(d); }
    if (watch.last != null) { const delta = cur - watch.last; if (delta > 0 && delta <= 2.5) watch.seg += delta; }
    watch.last = cur;
    saveSeg(watch.missao.id, watch.seg);
    // barra local
    const pct = watch.dur ? Math.min(100, Math.round((watch.seg / watch.dur) * 100)) : 0;
    const bar = $(".mprog .bar i", watch.el), lbl = $(".pctlbl", watch.el);
    if (bar) bar.style.width = pct + "%"; if (lbl) lbl.textContent = pct + "%";
    const marco = [25, 50, 75, 100].find((k) => pct >= k && !(watch["m" + k]));
    if (marco) { watch["m" + marco] = true; flush(); }
    else if (Date.now() - watch.lastFlush > 15000) flush();
  }
  async function flush(final) {
    if (!watch || !state.me || watch.busy) return;
    if (!watch.dur || watch.seg < 1) return;
    watch.busy = true; watch.lastFlush = Date.now();
    const w = watch;
    const pos = player ? Math.min(100, Math.round((player.getCurrentTime() / (w.dur || 1)) * 100)) : 0;
    try {
      const r = await api({ op: "progresso", telefone: state.me.tel, missao_id: w.missao.id, pct: pos, seg: Math.round(w.seg), duracao: w.dur }, final ? { keepalive: true } : {});
      state.progresso[w.missao.id] = Object.assign(state.progresso[w.missao.id] || {}, { seg_assistidos: Math.round(w.seg), duracao_seg: w.dur, concluida_em: r.concluida ? (state.progresso[w.missao.id] || {}).concluida_em || new Date().toISOString() : null });
      state.posicao = r.posicao || state.posicao;
      if (r.nova_conclusao) celebrar(w.missao, w.el);
      else renderStatus();
    } catch (e) { /* tenta no próximo tick */ }
    if (watch) watch.busy = false;
  }
  function celebrar(m, el) {
    el.classList.add("done"); $(".mnum", el).textContent = "✔"; $(".mst", el).textContent = "Cumprida"; $(".msub", el).textContent = "Missão cumprida · +" + m.pontos + " pts";
    $(".mdone", el).style.display = "";
    px("MissaoConcluida", { frente: C.frente, missao: m.ordem, titulo: m.titulo });
    const total = state.missoes.length, d = totalDone();
    if (d >= total) px("TrilhaCompleta", { frente: C.frente, missoes: total });
    toast("Missão " + m.ordem + " cumprida! +" + m.pontos + " pts", d >= total ? "Trilha completa. Você é " + PATENTES[PATENTES.length - 1] + " 🏆" : "Patente: " + patente() + (state.posicao && state.posicao.posicao ? " · " + state.posicao.posicao + "º no ranking" : ""));
    renderStatus(); loadRanking();
    // libera a próxima sem destruir o player atual (o vídeo pode continuar)
    const i = state.missoes.findIndex((x) => x.id === m.id);
    const next = state.missoes[i + 1];
    if (next) { const ne = document.querySelector('[data-id="' + next.id + '"]'); if (ne) { ne.classList.remove("locked"); $(".mnum", ne).textContent = String(next.ordem).padStart(2, "0"); $(".mst", ne).textContent = "Assistir"; $(".msub", ne).textContent = "Vale " + next.pontos + " pts"; $(".mhead", ne).onclick = () => toggle(next, ne); } }
  }
  function toast(t, s) { const el = $("#toast"); $("b", el).textContent = t; $("span", el).textContent = s || ""; el.classList.add("show"); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("show"), 5000); }

  /* ---------- ranking ---------- */
  async function loadRanking() {
    try {
      const r = await api({ op: "ranking", limit: 10 });
      const ul = $("#rank"); ul.innerHTML = "";
      if (!r.top.length) { ul.innerHTML = '<li class="empty">Ninguém cumpriu missão ainda. Seja o primeiro. 🥇</li>'; return; }
      const meTel = state.me ? "•••• " + state.me.tel.slice(-4) : "";
      r.top.forEach((p) => {
        const li = document.createElement("li");
        const meu = state.me && p.tel === meTel && p.nome === primeiro(state.me.nome);
        if (meu) li.className = "me";
        li.innerHTML = '<span class="pos display">' + (p.posicao <= 3 ? ["🥇", "🥈", "🥉"][p.posicao - 1] : p.posicao + "º") + '</span><span class="nm">' + esc(p.nome) + " <small style=\"color:var(--faint)\">" + esc(p.tel) + '</small></span><span class="pts"><b style="color:#fff">' + p.pontos + "</b> pts · " + p.missoes + " " + (p.missoes === 1 ? "missão" : "missões") + "</span>";
        ul.appendChild(li);
      });
    } catch (e) {}
  }

  /* ---------- boot ---------- */
  document.addEventListener("visibilitychange", () => { if (document.hidden) flush(true); });
  window.addEventListener("pagehide", () => flush(true));
  $("#sair").addEventListener("click", () => { try { localStorage.removeItem(STORE); } catch (e) {} location.reload(); });

  (async function boot() {
    const saved = load();
    if (saved && saved.tel) {
      try {
        const r = await fetch(API + "?op=trilha&frente=" + C.frente + "&tel=" + saved.tel, { headers: { Authorization: "Bearer " + API_KEY, apikey: API_KEY } }).then((x) => x.json());
        if (r.participante) { state.me = r.participante; state.missoes = r.missoes; state.progresso = r.progresso; state.posicao = r.posicao; state.pct = r.pct_conclusao; showTrilha(); return; }
      } catch (e) {}
    }
    showGate();
    if (saved && saved.nome) $("#nome").value = saved.nome;
  })();
})();
