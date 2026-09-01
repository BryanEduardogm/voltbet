/* ==========================================================================
   VOLTBET — Aviator jogável (demonstração)

   Um mini-jogo de verdade, só que com dinheiro fictício: aposta desconta do
   saldo guardado no localStorage, "Retirar" credita aposta × multiplicador,
   e cair antes de retirar perde a aposta. Mesmas funções de saldo/toast que
   o resto do site usa (js/comum.js), então o cabeçalho atualiza sozinho.
   ========================================================================== */

(function () {
  "use strict";

  const VB = window.VOLTBET;
  const modal = document.getElementById("modal-aviator");
  const fundo = document.getElementById("fundo-aviator");
  const botaoAbrir = document.querySelector('.jogo-cassino__jogar[data-jogo="Aviator"]');

  if (!modal || !VB || !botaoAbrir) return;

  const fechar = document.getElementById("btn-fechar-aviator");
  const elMultiplicador = document.getElementById("av-multiplicador");
  const elStatus = document.getElementById("av-status");
  const elHistorico = document.getElementById("av-historico");
  const elCurva = document.getElementById("av-curva");
  const elAviao = document.getElementById("av-aviao");
  const elValor = document.getElementById("av-valor");
  const btnApostar = document.getElementById("av-apostar");
  const btnRetirar = document.getElementById("av-retirar");
  const elRetirarValor = document.getElementById("av-retirar-valor");
  const botoesAtalho = modal.querySelectorAll(".atalho");

  /* ---------- Estado da rodada ---------- */
  // "parado" — esperando aposta | "voando" — multiplicador subindo | "caiu"/"retirado" — rodada acabou, tela mostrando o resultado

  let estado = "parado";
  let apostaAtual = 0;
  let multiplicador = 1;
  let alvoQueda = 1;
  let intervaloVoo = null;
  const historico = []; // [{ valor: 2.31, ganhou: true }]

  function sortearAlvoQueda() {
    // Mesma ideia do card decorativo: a maioria cai cedo, voos longos são raros
    return 1.15 + Math.random() * Math.random() * 6;
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
    if (estado === "voando") {
      VB.avisar("Espere o voo terminar antes de fechar.", "erro");
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

  /* ---------- Valores rápidos (+10, +25, +50) ---------- */

  botoesAtalho.forEach(function (botao) {
    botao.addEventListener("click", function () {
      if (estado !== "parado") return;
      const atual = parseFloat(elValor.value) || 0;
      elValor.value = String(atual + Number(botao.dataset.valor));
    });
  });

  /* ---------- Histórico de rodadas (só nesta sessão, na tela do jogo) ---------- */

  function registrarHistorico(valor, ganhou) {
    historico.unshift({ valor: valor, ganhou: ganhou });
    historico.length = Math.min(historico.length, 8);

    elHistorico.innerHTML = "";
    historico.forEach(function (rodada) {
      const item = document.createElement("li");
      item.className = rodada.ganhou ? "subiu" : "caiu";
      item.textContent = rodada.valor.toFixed(2) + "x";
      elHistorico.appendChild(item);
    });
  }

  /* ---------- Gráfico da curva + avião ----------
     x e y crescem com o multiplicador, mas achatando (assíntota) pra nunca
     estourar a tela, mesmo num voo bem alto. */

  function atualizarGrafico() {
    const t = multiplicador - 1;
    const x = 92 * (1 - 1 / (1 + t * 0.35));
    const yDoChao = 88 * (1 - 1 / (1 + t * 0.55)); // altura subida, a partir do chão
    const yNoSvg = 100 - yDoChao;                  // eixo do SVG cresce pra baixo

    elCurva.setAttribute("d", "M0,100 Q" + x.toFixed(1) + ",100 " + x.toFixed(1) + "," + yNoSvg.toFixed(1));
    elAviao.style.left = x.toFixed(1) + "%";
    elAviao.style.bottom = yDoChao.toFixed(1) + "%";
  }

  function reiniciarGrafico() {
    elCurva.classList.remove("aviator-jogo__curva--caiu");
    elCurva.setAttribute("d", "M0,100 L0,100");
    elAviao.classList.remove("aviator-jogo__aviao--caiu");
    elAviao.style.left = "0%";
    elAviao.style.bottom = "0%";
  }

  /* ---------- Preparar a tela para uma nova rodada ---------- */

  function prepararNovaRodada() {
    estado = "parado";
    multiplicador = 1;

    elMultiplicador.textContent = "1.00x";
    elMultiplicador.classList.remove("aviator-jogo__multiplicador--subindo", "aviator-jogo__multiplicador--caiu");
    elStatus.textContent = "Faça sua aposta para decolar";

    btnApostar.hidden = false;
    btnRetirar.hidden = true;
    elValor.disabled = false;

    reiniciarGrafico();
  }

  /* ---------- Apostar ---------- */

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

    multiplicador = 1;
    alvoQueda = sortearAlvoQueda();
    estado = "voando";

    elMultiplicador.textContent = "1.00x";
    elMultiplicador.classList.add("aviator-jogo__multiplicador--subindo");
    elMultiplicador.classList.remove("aviator-jogo__multiplicador--caiu");
    elStatus.textContent = "Voando... retire antes de cair!";

    btnApostar.hidden = true;
    btnRetirar.hidden = false;
    elValor.disabled = true;
    atualizarValorRetirar();
    reiniciarGrafico();

    intervaloVoo = setInterval(function () {
      multiplicador += multiplicador * 0.03 + 0.015;

      if (multiplicador >= alvoQueda) {
        cair();
        return;
      }

      elMultiplicador.textContent = multiplicador.toFixed(2) + "x";
      atualizarValorRetirar();
      atualizarGrafico();
    }, 80);
  }

  function atualizarValorRetirar() {
    elRetirarValor.textContent = "(" + VB.emReais(apostaAtual * multiplicador) + ")";
  }

  /* ---------- Cair (perder) ---------- */

  function cair() {
    clearInterval(intervaloVoo);
    estado = "caiu";
    multiplicador = alvoQueda;

    elMultiplicador.textContent = "💥 " + alvoQueda.toFixed(2) + "x";
    elMultiplicador.classList.remove("aviator-jogo__multiplicador--subindo");
    elMultiplicador.classList.add("aviator-jogo__multiplicador--caiu");
    elStatus.textContent = "Caiu em " + alvoQueda.toFixed(2) + "x. Você perdeu " + VB.emReais(apostaAtual) + ".";

    atualizarGrafico();
    elCurva.classList.add("aviator-jogo__curva--caiu");
    elAviao.classList.add("aviator-jogo__aviao--caiu");

    btnRetirar.hidden = true;

    registrarHistorico(alvoQueda, false);
    VB.avisar("O avião caiu em " + alvoQueda.toFixed(2) + "x — aposta perdida.", "erro");

    setTimeout(prepararNovaRodada, 1300);
  }

  /* ---------- Retirar (ganhar) ---------- */

  function retirar() {
    if (estado !== "voando") return;

    clearInterval(intervaloVoo);
    estado = "retirado";

    const ganho = apostaAtual * multiplicador;
    VB.gravarSaldo(VB.lerSaldo() + ganho);

    elStatus.textContent = "Você retirou em " + multiplicador.toFixed(2) + "x e ganhou " + VB.emReais(ganho) + "!";
    btnRetirar.hidden = true;

    registrarHistorico(multiplicador, true);
    VB.avisar("Retirou em " + multiplicador.toFixed(2) + "x — ganhou " + VB.emReais(ganho) + "!");

    setTimeout(prepararNovaRodada, 1000);
  }

  btnApostar.addEventListener("click", apostar);
  btnRetirar.addEventListener("click", retirar);
})();
