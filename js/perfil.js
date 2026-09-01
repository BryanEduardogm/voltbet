/* ==========================================================================
   VOLTBET — painel de perfil

   Gaveta que desliza pela direita ao clicar no avatar do cabeçalho.
   Mostra saldo, estatísticas calculadas a partir do histórico de apostas e
   o limite de depósito do mês (jogo responsável).

   Funciona igual nas duas páginas, por isso vive num arquivo separado.
   ========================================================================== */

(function () {
  "use strict";

  const VB = window.VOLTBET;

  const painel = document.getElementById("painel-perfil");
  const abrir = document.getElementById("btn-perfil");
  const fechar = document.getElementById("btn-fechar-perfil");
  const fundo = document.getElementById("fundo-perfil");

  if (!painel || !abrir) return;

  /* ---------- Abrir e fechar ---------- */

  let focoAnterior = null;

  function abrirPainel() {
    focoAnterior = document.activeElement;
    painel.classList.add("aberto");
    if (fundo) fundo.classList.add("visivel");
    abrir.setAttribute("aria-expanded", "true");
    document.body.classList.add("sem-rolagem");

    atualizar();

    // Leva o foco para dentro do painel, senão quem usa teclado fica preso atrás
    if (fechar) fechar.focus();
  }

  function fecharPainel() {
    painel.classList.remove("aberto");
    if (fundo) fundo.classList.remove("visivel");
    abrir.setAttribute("aria-expanded", "false");
    document.body.classList.remove("sem-rolagem");

    if (focoAnterior && focoAnterior.focus) focoAnterior.focus();
  }

  abrir.addEventListener("click", function () {
    if (painel.classList.contains("aberto")) fecharPainel();
    else abrirPainel();
  });

  if (fechar) fechar.addEventListener("click", fecharPainel);
  if (fundo) fundo.addEventListener("click", fecharPainel);

  // Esc fecha — comportamento esperado em qualquer gaveta ou modal
  document.addEventListener("keydown", function (evento) {
    if (evento.key === "Escape" && painel.classList.contains("aberto")) {
      fecharPainel();
    }
  });

  /* ---------- Preencher os dados ---------- */

  function definir(id, texto) {
    const campo = document.getElementById(id);
    if (campo) campo.textContent = texto;
  }

  function atualizar() {
    const saldo = VB.lerSaldo();
    const resumo = VB.resumoDoPerfil();
    const depositado = VB.depositadoNoMes();
    const restante = VB.limiteRestante();

    definir("perfil-saldo", VB.emReais(saldo));
    definir("perfil-apostas", String(resumo.quantidade));
    definir("perfil-total-apostado", VB.emReais(resumo.totalApostado));
    definir("perfil-retorno", VB.emReais(resumo.retornoPotencial));
    definir("perfil-maior-odd", resumo.maiorOdd > 0 ? resumo.maiorOdd.toFixed(2) : "—");
    definir("perfil-multiplas", String(resumo.multiplas));

    // Limite mensal de depósito
    definir("perfil-depositado", VB.emReais(depositado));
    definir("perfil-limite", VB.emReais(VB.LIMITE_MES));
    definir("perfil-restante", VB.emReais(restante));

    const barra = document.getElementById("perfil-barra");
    if (barra) {
      const porcento = Math.min(100, (depositado / VB.LIMITE_MES) * 100);
      barra.style.width = porcento.toFixed(1) + "%";
      barra.classList.toggle("barra__preenchimento--cheia", porcento >= 100);

      const medidor = barra.parentElement;
      if (medidor) {
        medidor.setAttribute("aria-valuenow", depositado.toFixed(2));
        medidor.setAttribute("aria-valuemax", String(VB.LIMITE_MES));
      }
    }
  }

  // Se o saldo mudar com o painel aberto, os números acompanham
  document.addEventListener("voltbet:saldo", function () {
    if (painel.classList.contains("aberto")) atualizar();
  });

  /* ---------- Zerar a demonstração ---------- */

  const btnZerar = document.getElementById("btn-zerar");
  if (btnZerar) {
    btnZerar.addEventListener("click", function () {
      // Duplo clique proposital: o primeiro pede confirmação
      if (btnZerar.dataset.confirmando !== "sim") {
        btnZerar.dataset.confirmando = "sim";
        btnZerar.textContent = "Tem certeza? Clique de novo";
        btnZerar.classList.add("btn--perigo");

        setTimeout(function () {
          btnZerar.dataset.confirmando = "nao";
          btnZerar.textContent = "Zerar demonstração";
          btnZerar.classList.remove("btn--perigo");
        }, 4000);
        return;
      }

      VB.gravar(VB.CHAVES.historico, []);
      VB.gravar(VB.CHAVES.depositos, []);
      VB.gravarSaldo(VB.SALDO_INICIAL);

      btnZerar.dataset.confirmando = "nao";
      btnZerar.textContent = "Zerar demonstração";
      btnZerar.classList.remove("btn--perigo");

      atualizar();
      VB.avisar("Demonstração zerada: saldo de volta a " + VB.emReais(VB.SALDO_INICIAL) + ".");

      // A página inicial precisa redesenhar o histórico, que agora está vazio
      document.dispatchEvent(new CustomEvent("voltbet:zerado"));
    });
  }

  atualizar();
})();
