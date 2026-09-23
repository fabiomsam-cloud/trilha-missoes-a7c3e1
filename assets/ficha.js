/* Ficha de Formação — pesquisa de qualificação da Trilha de Missões (23/09/2026).
   Quem conclui recebe o Planner Tático da frente (PDF, link assinado pela edge "missoes").
   Usada em dois lugares:
     • dentro da trilha (app.js): obrigatória para quem entrou a partir de 23/09, card para os demais;
     • no link exclusivo /<frente>/ficha/ (disparo): pede nome + WhatsApp e já cadastra na trilha.
   As faixas de renda, pagamento e tempo de aula são IDÊNTICAS às das pesquisas antigas
   (survey_answers) para comparar com o histórico de compra. */
(function () {
  const API = "https://dqpxugdhlgafvddavzzp.supabase.co/functions/v1/missoes";
  const API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxcHh1Z2RobGdhZnZkZGF2enpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxODQ1NTMsImV4cCI6MjA5Nzc2MDU1M30.nUhYPO3oLUZEXgQCDlRtL-Jawi0nr0l1Z7_z5ecEXvc";

  const COMUNS = {
    renda: { q: "Qual a sua renda mensal hoje?", ops: [
      ["Abaixo de um salário mínimo", "Abaixo de 1 salário mínimo"],
      ["De 1.518,00 a 1.903,98", "De R$ 1.518 a R$ 1.903"],
      ["De 1.903,99 até 2.826,65", "De R$ 1.904 a R$ 2.826"],
      ["De 2.826,66 até 3.751,05", "De R$ 2.827 a R$ 3.751"],
      ["De 3.751,06 até 4.664,6", "De R$ 3.752 a R$ 4.664"],
      ["Acima de 4.664,68", "Acima de R$ 4.664"]] },
    pagamento: { q: "Quando se trata de pagamento, com qual cenário você mais se identifica?", ops: [
      "Tenho cartão e costumo pagar com cartão", "Tenho cartão e costumo pagar no PIX",
      "Não tenho cartão e costumo pagar no PIX", "Não tenho cartão e costumo pagar no boleto ou em espécie"] },
    investimento: { q: "Quanto você investe (ou investiria) por mês na sua preparação hoje?", ops: [
      "Hoje só uso conteúdo gratuito", "Até R$ 50 por mês", "De R$ 50 a R$ 100 por mês",
      "De R$ 100 a R$ 200 por mês", "Mais de R$ 200 por mês"] },
    tempo_aula: { q: "Quanto tempo você está disposto(a) a assistir a uma aula ao vivo de preparação?", ops: [
      "De 30 a 45 min", "Até 1h", "De 1h a 1h30", "2h ou mais"] },
    prioridade: { q: "Qual o nível de prioridade que esse concurso tem hoje na sua vida?", ops: [
      "Alta, quero começar a estudar o quanto antes", "Média, tenho interesse, mas não é urgente",
      "Baixa, estou só acompanhando"] },
    ex_aluno: { q: "Você já foi aluno(a) do Delegado Fábio Silva?", ops: [
      "Sim, da Elite / mentoria", "Sim, de curso ou material", "Não"] },
  };

  const FRENTES = {
    POLICIAS: {
      titulo: "Ficha de Formação", sub: "Policial do Amazonas",
      planner: "Planner Tático · Polícias do Amazonas", capa: "planner-policias.jpg",
      concurso: { q: "Qual concurso é o seu foco?", ops: ["PC-AM (Polícia Civil)", "PM-AM (Polícia Militar)", "Polícia Penal", "Ainda não decidi"] },
      duvida: "Qual a sua maior dúvida para a Sala Secreta Polícias AM?",
    },
    PRF: {
      titulo: "Ficha de Formação", sub: "Futuro PRF",
      planner: "Planner Tático · PRF", capa: "planner-prf.jpg",
      concurso: { q: "Qual é o seu foco hoje?", ops: ["Só a PRF", "PRF e PF", "PRF e outras polícias", "Ainda estou decidindo"] },
      duvida: "Qual a sua maior dúvida para a Super Aula PRF 2027?",
    },
  };

  const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmtTel = (v) => { const d = v.replace(/\D/g, "").slice(0, 11); if (d.length <= 2) return d; if (d.length <= 7) return "(" + d.slice(0, 2) + ") " + d.slice(2); return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7); };
  const px = (ev, data) => { try { if (window.fbq) fbq("trackCustom", ev, data || {}); } catch (e) {} };

  async function api(payload) {
    const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + API_KEY, apikey: API_KEY }, body: JSON.stringify(payload) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || "Falha de conexão. Tente de novo.");
    return j;
  }

  function utmAtual() {
    const u = {}, sp = new URLSearchParams(location.search);
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach((k) => { if (sp.get(k)) u[k] = sp.get(k); });
    return Object.keys(u).length ? u : null;
  }

  /* opts: { frente, me: {tel,nome}|null, origem: "trilha"|"link", assetsBase, intro (texto), onDone(res) } */
  function mount(box, opts) {
    const F = FRENTES[opts.frente];
    if (!F) return;
    const base = opts.assetsBase || "../assets/";
    const passos = [];
    if (!opts.me) passos.push({ k: "_id" });
    passos.push({ k: "concurso", q: F.concurso.q, ops: F.concurso.ops });
    ["renda", "pagamento", "investimento", "tempo_aula", "prioridade", "ex_aluno"].forEach((k) => passos.push(Object.assign({ k }, COMUNS[k])));
    passos.push({ k: "duvida", q: F.duvida, aberta: true });

    const resp = {}, id = { nome: (opts.me && opts.me.nome) || "", tel: "" };
    let i = -1; // -1 = capa

    function progresso() {
      const off = opts.me ? 0 : 1, n = passos.length - off, a = Math.max(0, i - off);
      const lbl = passos[i].k === "_id" ? "Identificação" : "Pergunta <b>" + (a + 1) + "</b> de " + n;
      return '<div class="fx-prog"><div class="bar"><i style="width:' + Math.round((a / n) * 100) + '%"></i></div>' +
        '<div class="barlbl"><span>' + lbl + "</span><span>🎁 Planner em PDF</span></div></div>";
    }

    function render() {
      if (i < 0) {
        box.innerHTML =
          '<div class="card fx">' +
            '<span class="tag">🎁 Planner grátis em PDF</span>' +
            '<h2 class="display fx-h">' + esc(F.titulo) + '<br><em>' + esc(F.sub) + "</em></h2>" +
            '<p class="sub">' + (opts.intro || "Responda 8 perguntas rápidas (cerca de 1 minuto) e receba na hora o seu <b style=\"color:#fff\">" + esc(F.planner) + "</b> em PDF.") + "</p>" +
            '<img class="fx-capa" src="' + base + F.capa + '" alt="' + esc(F.planner) + '" loading="lazy">' +
            '<button class="btn" type="button" id="fx-go">Preencher minha ficha</button>' +
            '<p class="hint">Suas respostas ajudam a montar a aula ao vivo para o seu momento.</p>' +
          "</div>";
        box.querySelector("#fx-go").onclick = () => { i = 0; render(); box.scrollIntoView({ behavior: "smooth", block: "start" }); };
        return;
      }
      const p = passos[i];
      let corpo = "";
      if (p.k === "_id") {
        corpo = '<h3 class="fx-q">Primeiro, quem é você?</h3>' +
          '<div class="field"><label for="fx-nome">Seu nome</label><input id="fx-nome" type="text" autocomplete="name" value="' + esc(id.nome) + '"></div>' +
          '<div class="field"><label for="fx-tel">WhatsApp (o mesmo que está no grupo)</label><input id="fx-tel" type="tel" inputmode="numeric" autocomplete="tel" placeholder="(92) 99999-9999" value="' + esc(id.tel) + '"></div>' +
          '<button class="btn" type="button" id="fx-next">Continuar</button>';
      } else if (p.aberta) {
        corpo = '<h3 class="fx-q">' + esc(p.q) + ' <small>(opcional)</small></h3>' +
          '<div class="field"><textarea id="fx-txt" rows="4" maxlength="600" placeholder="Escreva aqui…">' + esc(resp[p.k] || "") + "</textarea></div>" +
          '<button class="btn" type="button" id="fx-send">Enviar e liberar meu planner</button>';
      } else {
        corpo = '<h3 class="fx-q">' + esc(p.q) + "</h3>" + '<div class="fx-ops">' +
          p.ops.map((o) => { const v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o;
            return '<button type="button" class="fx-op' + (resp[p.k] === v ? " on" : "") + '" data-v="' + esc(v) + '">' + esc(t) + "</button>"; }).join("") + "</div>";
      }
      box.innerHTML = '<div class="card fx">' + progresso() + corpo +
        '<div class="err" id="fx-err"></div>' +
        (i > 0 ? '<button class="fx-back" type="button" id="fx-back">← Voltar</button>' : "") + "</div>";

      const back = box.querySelector("#fx-back"); if (back) back.onclick = () => { i--; render(); };
      box.querySelectorAll(".fx-op").forEach((b) => b.onclick = () => {
        resp[p.k] = b.dataset.v;
        box.querySelectorAll(".fx-op").forEach((x) => x.classList.toggle("on", x === b));
        setTimeout(() => { i++; render(); }, 180);
      });
      if (p.k === "_id") {
        const tel = box.querySelector("#fx-tel");
        tel.addEventListener("input", () => { tel.value = fmtTel(tel.value); });
        box.querySelector("#fx-next").onclick = () => {
          id.nome = box.querySelector("#fx-nome").value.trim(); id.tel = tel.value;
          const err = box.querySelector("#fx-err");
          if (id.nome.length < 2) { err.textContent = "Digite seu nome."; return; }
          if (id.tel.replace(/\D/g, "").length < 10) { err.textContent = "Digite seu WhatsApp com DDD."; return; }
          i++; render();
        };
      }
      const send = box.querySelector("#fx-send");
      if (send) send.onclick = async () => {
        resp.duvida = box.querySelector("#fx-txt").value.trim();
        const err = box.querySelector("#fx-err"); err.textContent = "";
        send.disabled = true; send.textContent = "Enviando…";
        try {
          const r = await api({ op: "ficha", frente: opts.frente, telefone: opts.me ? opts.me.tel : id.tel, nome: opts.me ? opts.me.nome : id.nome, respostas: resp, origem: opts.origem || "trilha", utm: utmAtual() });
          px("FichaFormacaoConcluida", { frente: opts.frente, origem: opts.origem || "trilha" });
          entregue(r.planner);
          if (opts.onDone) opts.onDone(r);
        } catch (e) { err.textContent = e.message; send.disabled = false; send.textContent = "Enviar e liberar meu planner"; }
      };
    }

    function entregue(planner) {
      box.innerHTML = '<div class="card fx fx-ok">' +
        '<span class="tag">✅ Ficha concluída</span>' +
        '<h2 class="display fx-h">Seu planner<br><em>está liberado</em></h2>' +
        '<img class="fx-capa" src="' + base + F.capa + '" alt="' + esc(F.planner) + '">' +
        (planner && planner.url
          ? '<a class="btn" style="text-decoration:none" href="' + esc(planner.url) + '">⬇️ Baixar meu planner (PDF)</a>' +
            '<p class="hint">PDF para imprimir ou usar no celular. O link vale 7 dias — baixe agora.</p>'
          : '<p class="sub">Não conseguimos gerar o link agora. Recarregue a página em instantes.</p>') +
        (opts.depois || "") + "</div>";
    }

    render();
    return { entregue };
  }

  // Card compacto para quem já respondeu (baixar o planner de novo)
  async function plannerCard(box, frente, tel, assetsBase) {
    const F = FRENTES[frente]; if (!F) return;
    try {
      const r = await api({ op: "ficha", frente, telefone: tel });
      if (!r.feita || !r.planner) { box.style.display = "none"; return; }
      box.style.display = "";
      box.innerHTML = '<a class="fx-mini" href="' + esc(r.planner.url) + '"><img src="' + (assetsBase || "../assets/") + F.capa + '" alt=""><span><b>' + esc(r.planner.nome) + "</b><small>Ficha de Formação concluída · baixar o PDF</small></span><em>⬇️</em></a>";
    } catch (e) { box.style.display = "none"; }
  }

  window.Ficha = { mount, plannerCard, FRENTES };
})();
