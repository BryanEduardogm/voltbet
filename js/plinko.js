/* ==========================================================================
   VOLTBET — Plinko jogável (demonstração)

   A bolinha cai sozinha por 8 fileiras de pinos, virando left/right numa
   moeda a cada uma — exatamente como um Galton board de verdade, o que já
   dá a distribuição certa (cai muito mais no meio do que nas pontas).
   A tabela de multiplicadores é a mesma usada por casas de apostas de
   verdade no modo "risco baixo, 8 fileiras".
   ========================================================================== */

(function () {
  "use strict";

  const VB = window.VOLTBET;
  const modal = document.getElementById("modal-plinko");
  const fundo = document.getElementById("fundo-plinko");
  const botaoAbrir = document.querySelector('.jogo-cassino__jogar[data-jogo="Plinko"]');

  if (!modal || !VB || !botaoAbrir) return;

  const fechar = document.getElementById("btn-fechar-plinko");
  const elPinos = document.getElementById("plinko-pinos");
  const elBolinha = document.getElementById("plinko-bolinha");
  const elSlots = document.getElementById("plinko-slots");
  const elStatus = document.getElementById("plinko-status");
  const elValor = document.getElementById("plinko-valor");
  const btnSoltar = document.getElementById("plinko-soltar");
  const botoesAtalho = modal.querySelectorAll(".atalho");

  const FILEIRAS = 8;
  const MULTIPLICADORES = [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6];

  let caindo = false;
  let elSlotsBotoes = [];

  /* ---------- Monta o tabuleiro (uma vez só) ---------- */

  function montarTabuleiro() {
    elPinos.innerHTML = "";
    for (let linha = 0; linha < FILEIRAS; linha++) {
      const divLinha = document.createElement("div");
      divLinha.className = "plinko-jogo__linha";
      const qtdPinos = linha + 2;
      for (let p = 0; p < qtdPinos; p++) {
        const pino = document.createElement("span");
        pino.className = "plinko-jogo__pino";
        divLinha.appendChild(pino);
      }
      elPinos.appendChild(divLinha);
    }

    elSlots.innerHTML = "";
    elSlotsBotoes = MULTIPLICADORES.map(function (mult) {
      const div = document.createElement("div");
      div.className = "plinko-jogo__slot";
      div.textContent = mult.toFixed(2).replace(/\.?0+$/, "") + "x";
      elSlots.appendChild(div);
      return div;
    });
  }

  /* ---------- Abrir e fechar ---------- */

  let focoAnterior = null;

  function abrirJogo() {
    if (elSlotsBotoes.length === 0) montarTabuleiro();
    focoAnterior = document.activeElement;
    modal.hidden = false;
    if (fundo) fundo.classList.add("visivel");
    document.body.classList.add("sem-rolagem");
    if (fechar) fechar.focus();
  }

  function fecharJogo() {
    if (caindo) {
      VB.avisar("Espere a bolinha parar antes de fechar.", "erro");
      return;
    }
    modal.hidden = true;
    if (fundo) fundo.classList.remove("visivel");
    document.body.classList.remove("sem-rolagem");
    if (focoAnterior && focoAnterior.focus) focoAnterior.focus();
  }

  botaoAbrir.addEventListener("click", abrirJogo);
  if (fechar) fechar.addEventListener("click", fecharJogo);
  if (fundo) fundo.addEventListener("click", fecharJogo);

  document.addEventListener("keydown", function (evento) {
    if (evento.key === "Escape" && !modal.hidden) fecharJogo();
  });

  /* ---------- Valores rápidos ---------- */

  botoesAtalho.forEach(function (botao) {
    botao.addEventListener("click", function () {
      if (caindo) return;
      const atual = parseFloat(elValor.value) || 0;
      elValor.value = String(atual + Number(botao.dataset.valor));
    });
  });

  /* ---------- Soltar a bolinha ---------- */

  function soltar() {
    if (caindo) return;

    const valor = parseFloat(elValor.value);
    const saldo = VB.lerSaldo();

    if (!isFinite(valor) || valor <= 0) {
      VB.avisar("Informe um valor de aposta maior que zero.", "erro");
      return;
    }
    if (valor > saldo) {
      VB.avisar("Saldo insuficiente para essa aposta.", "erro");
      return;
    }

    VB.gravarSaldo(saldo - valor);
    caindo = true;
    btnSoltar.disabled = true;
    elValor.disabled = true;
    elSlotsBotoes.forEach((el) => el.classList.remove("ativo"));
    elStatus.textContent = "A bolinha está caindo...";

    // 8 caras-ou-coroas: quantas vezes foi "direita" decide o slot final (0-8)
    // — é literalmente como um Galton board de verdade funciona.
    const escolhas = [];
    for (let i = 0; i < FILEIRAS; i++) escolhas.push(Math.random() < 0.5);
    const slotFinal = escolhas.filter(Boolean).length;

    elBolinha.classList.add("visivel");
    elBolinha.style.left = "50%";
    elBolinha.style.top = "18px";

    let coluna = 4; // 0 a 8, começa centralizada
    let passo = 0;

    const larguraTela = document.getElementById("plinko-tela").clientWidth;
    const alturaTela = document.getElementById("plinko-tela").clientHeight;

    function proximoPasso() {
      if (passo >= FILEIRAS) {
        pousar(slotFinal, valor);
        return;
      }
      coluna += escolhas[passo] ? 0.5 : -0.5;
      const leftPx = (coluna / 8) * larguraTela;
      const topPx = ((passo + 1) / (FILEIRAS + 1)) * (alturaTela - 30) + 18;

      elBolinha.style.left = leftPx + "px";
      elBolinha.style.top = topPx + "px";

      passo += 1;
      setTimeout(proximoPasso, 130);
    }

    setTimeout(proximoPasso, 80);
  }

  function pousar(slotFinal, valor) {
    const mult = MULTIPLICADORES[slotFinal];
    const ganho = valor * mult;

    elSlotsBotoes[slotFinal].classList.add("ativo");
    VB.gravarSaldo(VB.lerSaldo() + ganho);

    if (mult >= 1) {
      elStatus.textContent = "Caiu no " + mult.toFixed(2) + "x — você ganhou " + VB.emReais(ganho) + "!";
      VB.avisar(VB.emReais(ganho) + " creditados — caiu no " + mult.toFixed(2) + "x!");
    } else {
      elStatus.textContent = "Caiu no " + mult.toFixed(2) + "x — voltou só " + VB.emReais(ganho) + ".";
      VB.avisar("Caiu no meio do tabuleiro: voltou " + VB.emReais(ganho) + ".", "erro");
    }

    setTimeout(function () {
      caindo = false;
      btnSoltar.disabled = false;
      elValor.disabled = false;
      elBolinha.classList.remove("visivel");
      elStatus.textContent = "Aposte e solte a bolinha.";
    }, 1100);
  }

  btnSoltar.addEventListener("click", soltar);
})();
