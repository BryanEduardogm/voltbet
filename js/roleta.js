/* ==========================================================================
   VOLTBET — Roleta Brasileira jogável (demonstração)

   Roleta europeia simplificada: 37 casas (0 a 36), aposta em vermelho, preto
   ou no verde (o zero). A faixa de números gira e desacelera até parar
   exatamente sob o marcador central — o número em que ela para é sorteado
   ANTES da animação começar, então o visual só mostra o resultado.
   ========================================================================== */

(function () {
  "use strict";

  const VB = window.VOLTBET;
  const modal = document.getElementById("modal-roleta");
  const fundo = document.getElementById("fundo-roleta");
  const botaoAbrir = document.querySelector('.jogo-cassino__jogar[data-jogo="Roleta Brasileira"]');

  if (!modal || !VB || !botaoAbrir) return;

  const fechar = document.getElementById("btn-fechar-roleta");
  const elFaixa = document.getElementById("roleta-faixa");
  const elJanela = elFaixa.parentElement;
  const elStatus = document.getElementById("roleta-status");
  const elValor = document.getElementById("roleta-valor");
  const btnGirar = document.getElementById("roleta-girar");
  const botoesCor = Array.from(document.querySelectorAll("#roleta-cores .roleta-jogo__cor"));
  const botoesAtalho = modal.querySelectorAll(".atalho");

  const VERMELHOS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const PAGA = { vermelho: 2, preto: 2, verde: 36 };
  const LARGURA_CELULA = 40;

  let girando = false;
  let corEscolhida = null;

  function corDoNumero(n) {
    if (n === 0) return "verde";
    return VERMELHOS.has(n) ? "vermelho" : "preto";
  }

  /* ---------- Abrir e fechar ---------- */

  let focoAnterior = null;

  function abrirJogo() {
    focoAnterior = document.activeElement;
    modal.hidden = false;
    if (fundo) fundo.classList.add("visivel");
    document.body.classList.add("sem-rolagem");
    if (fechar) fechar.focus();
  }

  function fecharJogo() {
    if (girando) {
      VB.avisar("Espere a roleta parar antes de fechar.", "erro");
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

  /* ---------- Escolha da cor ---------- */

  botoesCor.forEach(function (botao) {
    botao.addEventListener("click", function () {
      if (girando) return;
      corEscolhida = botao.dataset.cor;
      botoesCor.forEach((b) => b.classList.toggle("selecionada", b === botao));
    });
  });

  /* ---------- Valores rápidos ---------- */

  botoesAtalho.forEach(function (botao) {
    botao.addEventListener("click", function () {
      if (girando) return;
      const atual = parseFloat(elValor.value) || 0;
      elValor.value = String(atual + Number(botao.dataset.valor));
    });
  });

  /* ---------- Girar ---------- */

  function girar() {
    if (girando) return;

    const valor = parseFloat(elValor.value);
    const saldo = VB.lerSaldo();

    if (!corEscolhida) {
      VB.avisar("Escolha vermelho, preto ou verde antes de girar.", "erro");
      return;
    }
    if (!isFinite(valor) || valor <= 0) {
      VB.avisar("Informe um valor de aposta maior que zero.", "erro");
      return;
    }
    if (valor > saldo) {
      VB.avisar("Saldo insuficiente para essa aposta.", "erro");
      return;
    }

    VB.gravarSaldo(saldo - valor);
    girando = true;
    btnGirar.disabled = true;
    elValor.disabled = true;
    botoesCor.forEach((b) => (b.disabled = true));
    elStatus.textContent = "Girando...";

    const vencedor = Math.floor(Math.random() * 37);

    // Uma sequência comprida só de enfeite pra faixa parecer girando de
    // verdade — o número que decide é sempre o último, sorteado acima.
    const sequencia = [];
    for (let i = 0; i < 24; i++) sequencia.push(Math.floor(Math.random() * 37));
    sequencia.push(vencedor);

    elFaixa.innerHTML = "";
    sequencia.forEach(function (numero) {
      const item = document.createElement("li");
      item.textContent = String(numero);
      item.className = corDoNumero(numero);
      elFaixa.appendChild(item);
    });

    const indiceFinal = sequencia.length - 1;
    const larguraJanela = elJanela.clientWidth;

    // Posiciona a primeira célula sob o marcador, sem transição...
    elFaixa.style.transition = "none";
    elFaixa.style.left = (larguraJanela / 2 - LARGURA_CELULA / 2) + "px";
    void elFaixa.offsetWidth; // força o navegador a aplicar antes de reativar

    requestAnimationFrame(function () {
      elFaixa.style.transition = "";
      const alvoPx = larguraJanela / 2 - (indiceFinal * LARGURA_CELULA + LARGURA_CELULA / 2);
      elFaixa.style.left = alvoPx + "px";
    });

    setTimeout(function () {
      finalizar(vencedor, valor);
    }, 1900);
  }

  function finalizar(vencedor, valor) {
    const cor = corDoNumero(vencedor);
    const ganhou = cor === corEscolhida;

    if (ganhou) {
      const ganho = valor * PAGA[cor];
      VB.gravarSaldo(VB.lerSaldo() + ganho);
      elStatus.textContent = "Saiu " + vencedor + " (" + cor + ") — você ganhou " + VB.emReais(ganho) + "!";
      VB.avisar(VB.emReais(ganho) + " creditados — saiu " + vencedor + "!");
    } else {
      elStatus.textContent = "Saiu " + vencedor + " (" + cor + "). Você perdeu " + VB.emReais(valor) + ".";
      VB.avisar("Saiu " + vencedor + " (" + cor + ") — aposta perdida.", "erro");
    }

    girando = false;
    btnGirar.disabled = false;
    elValor.disabled = false;
    botoesCor.forEach((b) => (b.disabled = false));
  }

  btnGirar.addEventListener("click", girar);
})();
