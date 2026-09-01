/* ==========================================================================
   VOLTBET — Slot jogável (demonstração)

   Um único motor de caça-níquel de 3 rolos, reaproveitado pelos quatro jogos
   de slot do cassino (Fortune Tiger, Fortune Ox, Fortune Rabbit e Sweet
   Bonanza) — só troca o tema (emoji do título e símbolos dos rolos)
   conforme o card em que se clicou "Jogar".
   ========================================================================== */

(function () {
  "use strict";

  const VB = window.VOLTBET;
  const modal = document.getElementById("modal-slot");
  const fundo = document.getElementById("fundo-slot");

  if (!modal || !VB) return;

  const fechar = document.getElementById("btn-fechar-slot");
  const elTituloEmoji = document.getElementById("slot-titulo-emoji");
  const elTituloNome = document.getElementById("slot-titulo-nome");
  const elRolos = Array.from(document.querySelectorAll("#slot-rolos .slot-jogo__rolo"));
  const elStatus = document.getElementById("slot-status");
  const elValor = document.getElementById("slot-valor");
  const btnGirar = document.getElementById("slot-girar");
  const botoesAtalho = modal.querySelectorAll(".atalho");

  /* ---------- Temas: cada jogo de slot do cassino tem seus símbolos ---------- */

  const TEMAS = {
    "Fortune Tiger": {
      emoji: "🐯",
      simbolos: [
        { icone: "7️⃣", peso: 1, mult: 12 },
        { icone: "🐯", peso: 3, mult: 5 },
        { icone: "🧧", peso: 5, mult: 2.5 },
        { icone: "🪙", peso: 7, mult: 1.5 },
        { icone: "🍀", peso: 8, mult: 1 }
      ]
    },
    "Fortune Ox": {
      emoji: "🐂",
      simbolos: [
        { icone: "7️⃣", peso: 1, mult: 12 },
        { icone: "🐂", peso: 3, mult: 5 },
        { icone: "🧧", peso: 5, mult: 2.5 },
        { icone: "🪙", peso: 7, mult: 1.5 },
        { icone: "🎇", peso: 8, mult: 1 }
      ]
    },
    "Fortune Rabbit": {
      emoji: "🐰",
      simbolos: [
        { icone: "7️⃣", peso: 1, mult: 12 },
        { icone: "🐰", peso: 3, mult: 5 },
        { icone: "🥕", peso: 5, mult: 2.5 },
        { icone: "🧧", peso: 7, mult: 1.5 },
        { icone: "🍀", peso: 8, mult: 1 }
      ]
    },
    "Sweet Bonanza": {
      emoji: "🍬",
      simbolos: [
        { icone: "💎", peso: 1, mult: 12 },
        { icone: "🍬", peso: 3, mult: 5 },
        { icone: "🍭", peso: 5, mult: 2.5 },
        { icone: "🍇", peso: 7, mult: 1.5 },
        { icone: "🍉", peso: 8, mult: 1 }
      ]
    }
  };

  let temaAtual = TEMAS["Fortune Tiger"];
  let girando = false;

  /* ---------- Abrir e fechar ---------- */

  let focoAnterior = null;

  function abrirJogo(nomeJogo) {
    temaAtual = TEMAS[nomeJogo] || TEMAS["Fortune Tiger"];

    elTituloEmoji.textContent = temaAtual.emoji;
    elTituloNome.textContent = nomeJogo;
    elRolos.forEach(function (rolo) {
      rolo.textContent = "❔";
      rolo.classList.remove("ganhou");
    });
    elStatus.textContent = "Aposte e gire os rolos.";
    girando = false;
    btnGirar.disabled = false;
    elValor.disabled = false;

    focoAnterior = document.activeElement;
    modal.hidden = false;
    if (fundo) fundo.classList.add("visivel");
    document.body.classList.add("sem-rolagem");
    if (fechar) fechar.focus();
  }

  function fecharJogo() {
    if (girando) {
      VB.avisar("Espere os rolos pararem antes de fechar.", "erro");
      return;
    }
    modal.hidden = true;
    if (fundo) fundo.classList.remove("visivel");
    document.body.classList.remove("sem-rolagem");
    if (focoAnterior && focoAnterior.focus) focoAnterior.focus();
  }

  // O clique em "Jogar" de cada card de slot é interceptado aqui — os outros
  // jogos do cassino (Mines, Plinko, Roleta) têm seus próprios arquivos.
  document.addEventListener("click", function (evento) {
    const botao = evento.target.closest(".jogo-cassino__jogar");
    if (!botao || !TEMAS[botao.dataset.jogo]) return;
    abrirJogo(botao.dataset.jogo);
  });

  if (fechar) fechar.addEventListener("click", fecharJogo);
  if (fundo) fundo.addEventListener("click", fecharJogo);

  document.addEventListener("keydown", function (evento) {
    if (evento.key === "Escape" && !modal.hidden) fecharJogo();
  });

  /* ---------- Valores rápidos (+10, +25, +50) ---------- */

  botoesAtalho.forEach(function (botao) {
    botao.addEventListener("click", function () {
      if (girando) return;
      const atual = parseFloat(elValor.value) || 0;
      elValor.value = String(atual + Number(botao.dataset.valor));
    });
  });

  /* ---------- Sorteio ponderado de símbolo ---------- */

  function sortearSimbolo() {
    const total = temaAtual.simbolos.reduce((soma, s) => soma + s.peso, 0);
    let r = Math.random() * total;
    for (const s of temaAtual.simbolos) {
      if (r < s.peso) return s;
      r -= s.peso;
    }
    return temaAtual.simbolos[temaAtual.simbolos.length - 1];
  }

  function iconeAleatorioParaAnimacao() {
    const s = temaAtual.simbolos[Math.floor(Math.random() * temaAtual.simbolos.length)];
    return s.icone;
  }

  /* ---------- Girar ---------- */

  function girar() {
    if (girando) return;

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
    girando = true;
    btnGirar.disabled = true;
    elValor.disabled = true;
    elStatus.textContent = "Girando...";
    elRolos.forEach(function (rolo) {
      rolo.classList.remove("ganhou");
      rolo.classList.add("girando");
    });

    const resultado = [sortearSimbolo(), sortearSimbolo(), sortearSimbolo()];

    // Cada rolo mostra ícones aleatórios rapidamente até "travar" no seu
    // resultado, um de cada vez — é o que dá a sensação de giro.
    const intervalos = elRolos.map(function (rolo) {
      return setInterval(function () {
        rolo.textContent = iconeAleatorioParaAnimacao();
      }, 70);
    });

    [350, 550, 750].forEach(function (atraso, indice) {
      setTimeout(function () {
        clearInterval(intervalos[indice]);
        elRolos[indice].classList.remove("girando");
        elRolos[indice].textContent = resultado[indice].icone;

        if (indice === 2) finalizarGiro(resultado, valor);
      }, atraso);
    });
  }

  function finalizarGiro(resultado, valor) {
    girando = false;
    btnGirar.disabled = false;
    elValor.disabled = false;

    const [a, b, c] = resultado;
    let ganho = 0;
    let vencedores = [];

    if (a.icone === b.icone && b.icone === c.icone) {
      ganho = valor * a.mult;
      vencedores = [0, 1, 2];
    } else if (a.icone === b.icone) {
      ganho = valor * 0.3;
      vencedores = [0, 1];
    } else if (b.icone === c.icone) {
      ganho = valor * 0.3;
      vencedores = [1, 2];
    } else if (a.icone === c.icone) {
      ganho = valor * 0.3;
      vencedores = [0, 2];
    }

    vencedores.forEach((i) => elRolos[i].classList.add("ganhou"));

    if (ganho > 0) {
      VB.gravarSaldo(VB.lerSaldo() + ganho);
      const cheio = vencedores.length === 3;
      elStatus.textContent = cheio
        ? "Combinação completa! Você ganhou " + VB.emReais(ganho) + "."
        : "Dois símbolos iguais — você recebeu " + VB.emReais(ganho) + " de volta.";
      VB.avisar((cheio ? "🎉 " : "") + VB.emReais(ganho) + " creditados!");
    } else {
      elStatus.textContent = "Não formou combinação. Tente de novo.";
    }
  }

  btnGirar.addEventListener("click", girar);
})();
