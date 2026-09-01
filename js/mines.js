/* ==========================================================================
   VOLTBET — Mines jogável (demonstração)

   Campo minado de apostas: 25 casas, 3 bombas escondidas. Cada gema revelada
   aumenta o multiplicador (na conta exata de probabilidade, com uma margem
   de casa de 3% em cima) e dá pra retirar a qualquer momento — like o
   Aviator, mas o "risco" é escolher a próxima casa em vez de esperar o tempo.
   ========================================================================== */

(function () {
  "use strict";

  const VB = window.VOLTBET;
  const modal = document.getElementById("modal-mines");
  const fundo = document.getElementById("fundo-mines");
  const botaoAbrir = document.querySelector('.jogo-cassino__jogar[data-jogo="Mines"]');

  if (!modal || !VB || !botaoAbrir) return;

  const fechar = document.getElementById("btn-fechar-mines");
  const elGrade = document.getElementById("mines-grade");
  const elStatus = document.getElementById("mines-status");
  const elValor = document.getElementById("mines-valor");
  const btnApostar = document.getElementById("mines-apostar");
  const btnRetirar = document.getElementById("mines-retirar");
  const elRetirarValor = document.getElementById("mines-retirar-valor");
  const botoesAtalho = modal.querySelectorAll(".atalho");

  const TOTAL_CASAS = 25;
  const BOMBAS = 3;

  let estado = "parado"; // "parado" | "jogando"
  let apostaAtual = 0;
  let posicoesBomba = new Set();
  let reveladas = 0;
  let casas = []; // referências aos 25 botões

  /* ---------- Monta o grid (uma vez só) ---------- */

  function montarGrade() {
    elGrade.innerHTML = "";
    casas = [];
    for (let i = 0; i < TOTAL_CASAS; i++) {
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "mines-jogo__casa";
      botao.textContent = "❔";
      botao.disabled = true;
      botao.addEventListener("click", function () { abrirCasa(i); });
      elGrade.appendChild(botao);
      casas.push(botao);
    }
  }

  function resetarVisualGrade() {
    casas.forEach(function (botao) {
      botao.textContent = "❔";
      botao.disabled = true;
      botao.classList.remove("revelada--gema", "revelada--bomba");
    });
  }

  /* ---------- Multiplicador justo (com margem da casa) ---------- */

  function multiplicadorAtual(qtdReveladas) {
    let justo = 1;
    for (let i = 0; i < qtdReveladas; i++) {
      const restantes = TOTAL_CASAS - i;
      justo *= restantes / (restantes - BOMBAS);
    }
    return justo * 0.97;
  }

  /* ---------- Abrir e fechar o jogo ---------- */

  let focoAnterior = null;

  function abrirJogo() {
    if (casas.length === 0) montarGrade();
    focoAnterior = document.activeElement;
    modal.hidden = false;
    if (fundo) fundo.classList.add("visivel");
    document.body.classList.add("sem-rolagem");
    if (fechar) fechar.focus();
  }

  function fecharJogo() {
    if (estado === "jogando") {
      VB.avisar("Retire ou abra uma bomba antes de fechar.", "erro");
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
      if (estado !== "parado") return;
      const atual = parseFloat(elValor.value) || 0;
      elValor.value = String(atual + Number(botao.dataset.valor));
    });
  });

  /* ---------- Começar uma rodada ---------- */

  function sortearBombas() {
    const posicoes = new Set();
    while (posicoes.size < BOMBAS) {
      posicoes.add(Math.floor(Math.random() * TOTAL_CASAS));
    }
    return posicoes;
  }

  function apostar() {
    if (estado !== "parado") return;

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

    apostaAtual = valor;
    VB.gravarSaldo(saldo - valor);

    posicoesBomba = sortearBombas();
    reveladas = 0;
    estado = "jogando";

    resetarVisualGrade();
    casas.forEach((botao) => (botao.disabled = false));

    elStatus.textContent = "Escolha uma casa. " + BOMBAS + " bombas estão escondidas nas 25.";
    btnApostar.hidden = true;
    btnRetirar.hidden = true;
    elValor.disabled = true;
  }

  /* ---------- Abrir uma casa ---------- */

  function abrirCasa(indice) {
    if (estado !== "jogando") return;
    const botao = casas[indice];
    if (botao.disabled) return;

    botao.disabled = true;

    if (posicoesBomba.has(indice)) {
      explodir(indice);
      return;
    }

    reveladas += 1;
    botao.textContent = "💎";
    botao.classList.add("revelada--gema");

    const mult = multiplicadorAtual(reveladas);
    elRetirarValor.textContent = "(" + VB.emReais(apostaAtual * mult) + ")";
    btnRetirar.hidden = false;
    elStatus.textContent = reveladas + " gema" + (reveladas > 1 ? "s" : "") +
      " revelada" + (reveladas > 1 ? "s" : "") + " · multiplicador " + mult.toFixed(2) + "x";

    // Achou todas as gemas: não sobrou casa segura pra abrir, então encerra
    // sozinho no maior multiplicador possível.
    if (reveladas === TOTAL_CASAS - BOMBAS) {
      retirar();
    }
  }

  /* ---------- Explodiu (perdeu) ---------- */

  function explodir(indiceClicado) {
    estado = "parado";

    posicoesBomba.forEach(function (i) {
      casas[i].disabled = true;
      casas[i].textContent = "💣";
      casas[i].classList.add("revelada--bomba");
    });

    elStatus.textContent = "💥 Bomba! Você perdeu " + VB.emReais(apostaAtual) + ".";
    btnRetirar.hidden = true;
    VB.avisar("Encontrou uma bomba — aposta perdida.", "erro");

    setTimeout(prepararNovaRodada, 1500);
  }

  /* ---------- Retirar (ganhar) ---------- */

  function retirar() {
    if (estado !== "jogando" || reveladas === 0) return;

    estado = "parado";
    const mult = multiplicadorAtual(reveladas);
    const ganho = apostaAtual * mult;
    VB.gravarSaldo(VB.lerSaldo() + ganho);

    casas.forEach((botao) => (botao.disabled = true));

    // Mostra onde as bombas estavam, mesmo tendo retirado antes de achá-las
    posicoesBomba.forEach(function (i) {
      if (casas[i].classList.contains("revelada--gema")) return;
      casas[i].textContent = "💣";
      casas[i].classList.add("revelada--bomba");
    });

    elStatus.textContent = "Você retirou com " + reveladas + " gemas em " + mult.toFixed(2) +
      "x e ganhou " + VB.emReais(ganho) + "!";
    btnRetirar.hidden = true;
    VB.avisar("Retirou em " + mult.toFixed(2) + "x — ganhou " + VB.emReais(ganho) + "!");

    setTimeout(prepararNovaRodada, 1200);
  }

  /* ---------- Preparar nova rodada ---------- */

  function prepararNovaRodada() {
    estado = "parado";
    reveladas = 0;
    resetarVisualGrade();
    elStatus.textContent = BOMBAS + " bombas escondidas em " + TOTAL_CASAS + " casas. Aposte para abrir o campo.";
    btnApostar.hidden = false;
    btnRetirar.hidden = true;
    elValor.disabled = false;
  }

  btnApostar.addEventListener("click", apostar);
  btnRetirar.addEventListener("click", retirar);
})();
