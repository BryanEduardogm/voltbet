/* ==========================================================================
   VOLTBET — script principal

   Responsabilidades:
     1. Saldo fictício (guardado no localStorage)
     2. Cupom de aposta: adicionar/remover seleções e calcular o retorno
     3. Odds dos jogos ao vivo mudando sozinhas
     4. Histórico de apostas da sessão
     5. Detalhes de interface (chip ativo, cupom no celular, avisos)

   Nada aqui conversa com servidor: é tudo local, no navegador.
   ========================================================================== */

(function () {
  "use strict";

  /* ======================================================================
     CONSTANTES E ESTADO
     ====================================================================== */

  // Formatação, localStorage, saldo e toast vivem em js/comum.js, porque a
  // página de recarga precisa exatamente das mesmas funções.
  const VB = window.VOLTBET;
  const emReais = VB.emReais;
  const lerArmazenado = VB.lerArmazenado;
  const gravar = VB.gravar;
  const avisar = VB.avisar;

  const CHAVE_HISTORICO = VB.CHAVES.historico;
  const SALDO_INICIAL = VB.SALDO_INICIAL;

  // Limites das odds ao vivo. São mais largos que os de um jogo que ainda não
  // começou: com o placar aberto e pouco tempo restante, uma casa de apostas
  // real chega a pagar 1.05 no favorito e 20.00 no time que está perdendo.
  const ODD_PISO = 1.05;
  const ODD_TETO = 20.0;

  // Margem da casa: faz a soma de (1/odd) dar ~1.03 em vez de 1.00.
  // Mais baixa que uma casa de apostas real pagaria — de propósito, pra
  // deixar as odds mais generosas nesta demonstração.
  const MARGEM = 1.03;

  // A cada 3 segundos reais passa 1 minuto de jogo
  const TICK_MS = 3000;

  const estado = {
    selecoes: [],   // [{ evento, jogo, selecao, odd }]
    saldo: SALDO_INICIAL,
    historico: [],  // [{ tipo, selecoes, valor, oddTotal, retorno, data }]

    /*
      Como o cupom calcula quando há 2 ou mais seleções:

      "simples"  — cada seleção é uma aposta INDEPENDENTE com o mesmo valor.
                   Total apostado = valor x quantidade
                   Retorno total  = soma de (valor x odd) de cada uma
                   Se uma errar, as outras continuam valendo.

      "multipla" — todas viram uma aposta só, com as odds MULTIPLICADAS.
                   Total apostado = valor
                   Retorno        = valor x (odd1 x odd2 x ...)
                   Basta uma errar para perder tudo.

      Com uma seleção só os dois modos dão no mesmo, e o seletor fica escondido.
    */
    modo: "simples"
  };

  /* ======================================================================
     ATALHOS DE ELEMENTOS
     ====================================================================== */

  const $ = (seletor) => document.querySelector(seletor);
  const $$ = (seletor) => Array.from(document.querySelectorAll(seletor));

  const el = {
    cupom:            $("#cupom"),
    cupomAlternar:    $("#cupom-alternar"),
    cupomContador:    $("#cupom-contador"),
    cupomLista:       $("#cupom-lista"),
    cupomVazio:       $("#cupom-vazio"),
    cupomRodape:      $("#cupom-rodape"),
    cupomTipo:        $("#cupom-tipo"),
    cupomErro:        $("#cupom-erro"),

    cupomModo:        $("#cupom-modo"),
    modoExplicacao:   $("#modo-explicacao"),
    rotuloValor:      $("#rotulo-valor"),

    valorAposta:      $("#valor-aposta"),
    linhaOdd:         $("#linha-odd"),
    linhaTotal:       $("#linha-total"),
    oddTotal:         $("#odd-total"),
    totalApostado:    $("#total-apostado"),
    rotuloRetorno:    $("#rotulo-retorno"),
    retornoPossivel:  $("#retorno-possivel"),
    resumoRetorno:    $("#resumo-retorno"),

    btnApostar:       $("#btn-apostar"),
    btnLimparCupom:   $("#btn-limpar-cupom"),

    historico:        $("#lista-historico"),
    historicoVazio:   $("#historico-vazio"),
    btnLimparHist:    $("#btn-limpar-historico")
  };

  /* ======================================================================
     1. SALDO
     ====================================================================== */

  function carregarSaldo() {
    estado.saldo = VB.lerSaldo();
    VB.pintarSaldoNoCabecalho(false);
  }

  function alterarSaldo(diferenca) {
    estado.saldo = VB.gravarSaldo(estado.saldo + diferenca);
    // pintarSaldoNoCabecalho é chamado sozinho pelo evento "voltbet:saldo"
  }

  /*
    O saldo pode mudar fora daqui — na página de recarga, ou no painel de
    perfil. Quando isso acontece, este estado precisa acompanhar, senão a
    validação do cupom usaria um saldo velho.
  */
  document.addEventListener("voltbet:saldo", function (evento) {
    estado.saldo = evento.detail;
    calcular();
  });

  /* ======================================================================
     2. CUPOM DE APOSTA
     ====================================================================== */

  /** Procura o índice de uma seleção pelo evento */
  function indicePorEvento(evento) {
    return estado.selecoes.findIndex((s) => s.evento === evento);
  }

  /**
   * Clique numa odd.
   * Regras:
   *   - mesma seleção clicada de novo  -> remove do cupom
   *   - outra seleção do MESMO jogo    -> substitui (não dá para apostar
   *                                       em dois resultados do mesmo jogo)
   *   - jogo novo                      -> adiciona
   */
  function alternarSelecao(botao) {
    const dados = {
      evento:  botao.dataset.evento,
      jogo:    botao.dataset.jogo,
      selecao: botao.dataset.selecao,
      odd:     parseFloat(botao.dataset.odd)
    };

    const indice = indicePorEvento(dados.evento);

    if (indice === -1) {
      estado.selecoes.push(dados);
    } else if (estado.selecoes[indice].selecao === dados.selecao) {
      estado.selecoes.splice(indice, 1);          // clicou na mesma: remove
    } else {
      estado.selecoes[indice] = dados;            // trocou de lado: substitui
    }

    desenharCupom();
  }

  /** Remove uma seleção pelo identificador do evento */
  function removerSelecao(evento) {
    const indice = indicePorEvento(evento);
    if (indice !== -1) {
      estado.selecoes.splice(indice, 1);
      desenharCupom();
    }
  }

  /** Marca visualmente, na lista de jogos, quais odds estão no cupom */
  function marcarOddsSelecionadas() {
    $$(".odd").forEach(function (botao) {
      const noCupom = estado.selecoes.some(
        (s) => s.evento === botao.dataset.evento && s.selecao === botao.dataset.selecao
      );
      botao.classList.toggle("selecionada", noCupom);
      botao.setAttribute("aria-pressed", noCupom ? "true" : "false");
    });
  }

  /** Redesenha o cupom inteiro a partir do estado */
  function desenharCupom() {
    const quantidade = estado.selecoes.length;

    if (el.cupomContador) el.cupomContador.textContent = String(quantidade);

    // Lista de seleções
    if (el.cupomLista) {
      el.cupomLista.innerHTML = "";

      estado.selecoes.forEach(function (s) {
        const item = document.createElement("li");
        item.className = "selecao";
        item.innerHTML =
          '<span class="selecao__jogo"></span>' +
          '<span class="selecao__linha">' +
            '<span class="selecao__nome"></span>' +
            '<span class="selecao__odd"></span>' +
          "</span>" +
          '<span class="selecao__retorno" hidden></span>' +
          '<button class="selecao__remover" type="button" aria-label="Remover seleção">&times;</button>';

        // textContent (e não innerHTML) para os dados: evita injeção de HTML
        item.querySelector(".selecao__jogo").textContent = s.jogo;
        item.querySelector(".selecao__nome").textContent = s.selecao;
        item.querySelector(".selecao__odd").textContent = s.odd.toFixed(2);

        item.querySelector(".selecao__remover").addEventListener("click", function () {
          removerSelecao(s.evento);
        });

        el.cupomLista.appendChild(item);
      });
    }

    // Alterna entre "cupom vazio" e o rodapé com os cálculos
    const vazio = quantidade === 0;
    if (el.cupomVazio) el.cupomVazio.hidden = !vazio;
    if (el.cupomRodape) el.cupomRodape.hidden = vazio;

    // Com 2+ seleções aparece o seletor de modo; com 1 só, um rótulo simples
    const varias = quantidade > 1;

    if (el.cupomTipo) {
      el.cupomTipo.hidden = varias;
      el.cupomTipo.textContent = "Aposta simples";
    }
    if (el.cupomModo) el.cupomModo.hidden = !varias;
    if (el.modoExplicacao) el.modoExplicacao.hidden = !varias;

    atualizarBotoesModo();
    marcarOddsSelecionadas();
    calcular();
  }

  /** Deixa o botão do modo atual destacado e explica o que ele faz */
  function atualizarBotoesModo() {
    const modo = modoEfetivo();

    $$(".modo__botao").forEach(function (botao) {
      const ativo = botao.dataset.modo === modo;
      botao.classList.toggle("ativo", ativo);
      botao.setAttribute("aria-pressed", ativo ? "true" : "false");
    });

    if (el.modoExplicacao) {
      el.modoExplicacao.textContent = modo === "multipla"
        ? "As odds se multiplicam e o prêmio é bem maior — mas basta uma seleção errar para perder tudo."
        : "Cada seleção é uma aposta separada, com o mesmo valor. Se uma errar, as outras continuam valendo.";
    }
  }

  /** Com uma seleção só, os dois modos são idênticos — trata como simples. */
  function modoEfetivo() {
    return estado.selecoes.length > 1 ? estado.modo : "simples";
  }

  /**
   * Faz todas as contas do cupom de uma vez, conforme o modo.
   * @returns {{valor:number, oddTotal:number, totalApostado:number, retorno:number}}
   */
  function numeros() {
    const valor = parseFloat(el.valorAposta ? el.valorAposta.value : "0") || 0;
    const quantidade = estado.selecoes.length;

    if (quantidade === 0) {
      return { valor: valor, oddTotal: 1, totalApostado: 0, retorno: 0 };
    }

    if (modoEfetivo() === "multipla") {
      // Uma aposta só, odds multiplicadas
      const oddTotal = estado.selecoes.reduce((total, s) => total * s.odd, 1);
      return {
        valor: valor,
        oddTotal: oddTotal,
        totalApostado: valor,
        retorno: valor * oddTotal
      };
    }

    // Apostas separadas: o mesmo valor é apostado em cada seleção
    const retorno = estado.selecoes.reduce((soma, s) => soma + valor * s.odd, 0);
    return {
      valor: valor,
      oddTotal: 0, // não se aplica: cada aposta tem a sua própria odd
      totalApostado: valor * quantidade,
      retorno: retorno
    };
  }

  /** Recalcula tudo e atualiza os números na tela */
  function calcular() {
    const n = numeros();
    const simples = modoEfetivo() === "simples";
    const varias = estado.selecoes.length > 1;

    // Rótulo do campo de valor
    if (el.rotuloValor) {
      el.rotuloValor.textContent = (simples && varias)
        ? "Valor por aposta (R$)"
        : "Valor da aposta (R$)";
    }

    // Linha "Odd total" só faz sentido na múltipla
    if (el.linhaOdd) el.linhaOdd.hidden = simples;
    if (el.oddTotal) el.oddTotal.textContent = n.oddTotal.toFixed(2);

    // Linha "Total apostado" só faz sentido quando há várias apostas simples
    if (el.linhaTotal) el.linhaTotal.hidden = !(simples && varias);
    if (el.totalApostado) el.totalApostado.textContent = emReais(n.totalApostado);

    if (el.rotuloRetorno) {
      el.rotuloRetorno.textContent = (simples && varias)
        ? "Retorno total"
        : "Retorno possível";
    }

    if (el.retornoPossivel) el.retornoPossivel.textContent = emReais(n.retorno);
    if (el.resumoRetorno) el.resumoRetorno.textContent = emReais(n.retorno);

    // No modo simples, cada seleção mostra o próprio retorno
    atualizarRetornosIndividuais(n.valor, simples && varias);

    validar(n, true);
  }

  /** Escreve "R$ 10 → R$ 23,50" embaixo de cada seleção (modo simples) */
  function atualizarRetornosIndividuais(valor, mostrar) {
    $$("#cupom-lista .selecao").forEach(function (item, indice) {
      const campo = item.querySelector(".selecao__retorno");
      if (!campo) return;

      const s = estado.selecoes[indice];
      if (!mostrar || !s) {
        campo.hidden = true;
        return;
      }

      campo.hidden = false;
      campo.innerHTML = "";
      campo.appendChild(document.createTextNode(emReais(valor) + " → "));
      const forte = document.createElement("strong");
      forte.textContent = emReais(valor * s.odd);
      campo.appendChild(forte);
    });
  }

  /**
   * Valida a aposta.
   * @param {object}  n - resultado de numeros()
   * @param {boolean} silencioso - true enquanto o usuário digita (não mostra erro
   *                               antes da hora); false ao clicar em apostar.
   * @returns {boolean} se pode apostar
   */
  function validar(n, silencioso) {
    let erro = "";

    if (estado.selecoes.length === 0) {
      erro = "Escolha pelo menos uma seleção para apostar.";
    } else if (!isFinite(n.valor) || n.valor <= 0) {
      erro = "Digite um valor maior que zero.";
    } else if (n.totalApostado > estado.saldo) {
      // No modo simples o que conta é a soma, não o valor de cada aposta
      erro = estado.selecoes.length > 1 && modoEfetivo() === "simples"
        ? "Saldo insuficiente: " + estado.selecoes.length + " apostas de " +
          emReais(n.valor) + " somam " + emReais(n.totalApostado) +
          " e você tem " + emReais(estado.saldo) + "."
        : "Saldo insuficiente. Você tem " + emReais(estado.saldo) + ".";
    }

    const podeApostar = erro === "";

    if (el.btnApostar) el.btnApostar.disabled = !podeApostar;

    if (el.cupomErro) {
      // Enquanto digita, só mostramos o erro de saldo (que é útil na hora).
      const mostrar = erro !== "" && (!silencioso || erro.indexOf("Saldo") === 0);
      el.cupomErro.textContent = erro;
      el.cupomErro.hidden = !mostrar;
    }

    return podeApostar;
  }

  /** Confirma a aposta: desconta o saldo, guarda no histórico e limpa o cupom */
  function confirmarAposta() {
    const n = numeros();

    if (!validar(n, false)) {
      const mensagem = el.cupomErro ? el.cupomErro.textContent : "Aposta inválida.";
      avisar(mensagem, "erro");
      return;
    }

    const agora = new Date().toISOString();
    // Guardados agora porque o cupom será esvaziado logo abaixo
    const modo = modoEfetivo();
    const quantidade = estado.selecoes.length;

    if (modo === "multipla") {
      // Uma única entrada no histórico, com todas as seleções juntas
      estado.historico.unshift({
        tipo: "Múltipla (" + estado.selecoes.length + ")",
        selecoes: estado.selecoes.map((s) => ({
          jogo: s.jogo, selecao: s.selecao, odd: s.odd,
          evento: s.evento, resultado: "pendente"
        })),
        valor: n.valor,
        oddTotal: n.oddTotal,
        retorno: n.retorno,
        status: "pendente",
        data: agora
      });
    } else {
      // Uma entrada separada por seleção — são apostas independentes de verdade.
      // O reverse() mantém a ordem do cupom no topo do histórico.
      estado.selecoes.slice().reverse().forEach(function (s) {
        estado.historico.unshift({
          tipo: "Simples",
          selecoes: [{ jogo: s.jogo, selecao: s.selecao, odd: s.odd, evento: s.evento, resultado: "pendente" }],
          valor: n.valor,
          oddTotal: s.odd,
          retorno: n.valor * s.odd,
          status: "pendente",
          data: agora
        });
      });
    }

    gravar(CHAVE_HISTORICO, estado.historico);
    alterarSaldo(-n.totalApostado);

    estado.selecoes = [];
    desenharCupom();
    desenharHistorico();

    const oQue = (modo === "multipla" || quantidade === 1)
      ? "Aposta de " + emReais(n.totalApostado)
      : quantidade + " apostas de " + emReais(n.valor) + " (" + emReais(n.totalApostado) + ")";

    avisar(oQue + " registrada. Retorno possível: " + emReais(n.retorno) + ".");
  }

  /* ---------- Eventos do cupom ---------- */

  // Um único ouvinte no documento cobre todas as odds (inclusive futuras)
  document.addEventListener("click", function (evento) {
    const botaoOdd = evento.target.closest(".odd");
    if (botaoOdd) alternarSelecao(botaoOdd);
  });

  // Cada jogo do cassino agora abre um mini-jogo de verdade, cuidado pelo
  // próprio arquivo dele: js/aviator.js, js/slot.js, js/mines.js,
  // js/plinko.js e js/roleta.js.

  if (el.valorAposta) {
    el.valorAposta.addEventListener("input", calcular);
  }

  // Seletor Simples / Múltipla
  $$(".modo__botao").forEach(function (botao) {
    botao.addEventListener("click", function () {
      estado.modo = botao.dataset.modo;
      atualizarBotoesModo();
      calcular();
    });
  });

  // Botões de valor rápido (+10, +25, +50, Tudo).
  // Restrito ao cupom: o jogo do Aviator tem os mesmos botões, mas com seu
  // próprio dono (js/aviator.js) — não pode pegar os dois juntos aqui.
  $$("#cupom-rodape .atalho").forEach(function (botao) {
    botao.addEventListener("click", function () {
      const alvo = botao.dataset.valor;
      const atual = parseFloat(el.valorAposta.value) || 0;

      if (alvo === "tudo") {
        // No modo simples o saldo se divide entre as apostas, para que a
        // SOMA dê o saldo — e não cada aposta individualmente.
        const divisor = (modoEfetivo() === "simples" && estado.selecoes.length > 1)
          ? estado.selecoes.length
          : 1;
        // Arredonda para baixo, senão a soma passaria do saldo por centavos
        el.valorAposta.value = String(Math.floor((estado.saldo / divisor) * 100) / 100);
      } else {
        el.valorAposta.value = String(atual + Number(alvo));
      }

      calcular();
    });
  });

  if (el.btnApostar) el.btnApostar.addEventListener("click", confirmarAposta);

  if (el.btnLimparCupom) {
    el.btnLimparCupom.addEventListener("click", function () {
      estado.selecoes = [];
      desenharCupom();
    });
  }

  /* ======================================================================
     3. HISTÓRICO
     ====================================================================== */

  function carregarHistorico() {
    estado.historico = VB.lerHistorico();
    desenharHistorico();
  }

  // O painel de perfil tem um botão "Zerar demonstração" que apaga tudo
  document.addEventListener("voltbet:zerado", function () {
    estado.selecoes = [];
    carregarHistorico();
    desenharCupom();
  });

  function desenharHistorico() {
    if (!el.historico) return;

    // Limpa tudo, menos o parágrafo de "nenhuma aposta ainda"
    Array.from(el.historico.children).forEach(function (filho) {
      if (filho !== el.historicoVazio) filho.remove();
    });

    const vazio = estado.historico.length === 0;
    if (el.historicoVazio) el.historicoVazio.hidden = !vazio;
    if (el.btnLimparHist) el.btnLimparHist.hidden = vazio;

    estado.historico.forEach(function (aposta) {
      const data = new Date(aposta.data);
      const quando = data.toLocaleString("pt-BR", {
        day: "2-digit", month: "2-digit",
        hour: "2-digit", minute: "2-digit"
      });

      // Apostas gravadas antes desta liquidação existir não têm status: são
      // tratadas como pendentes, e nunca vão resolver (não guardaram o evento).
      const status = aposta.status || "pendente";
      const rotuloStatus = { pendente: "Pendente", ganhou: "Ganhou", perdeu: "Perdeu" }[status];
      const rotuloRetorno = status === "ganhou" ? "Retorno" : "Retorno possível";

      const cartao = document.createElement("article");
      cartao.className = "aposta aposta--" + status;
      cartao.innerHTML =
        '<div class="aposta__topo">' +
          '<span class="aposta__tipo"></span>' +
          '<span class="aposta__status"></span>' +
          '<span class="aposta__data"></span>' +
        "</div>" +
        '<ul class="aposta__selecoes"></ul>' +
        '<div class="aposta__numeros">' +
          "<span>Valor<strong></strong></span>" +
          "<span>Odd total<strong></strong></span>" +
          '<span class="destaque"><em class="aposta__rotulo-retorno"></em><strong></strong></span>' +
        "</div>";

      cartao.querySelector(".aposta__tipo").textContent = aposta.tipo;
      cartao.querySelector(".aposta__status").textContent = rotuloStatus;
      cartao.querySelector(".aposta__data").textContent = quando;
      cartao.querySelector(".aposta__rotulo-retorno").textContent = rotuloRetorno;

      const lista = cartao.querySelector(".aposta__selecoes");
      aposta.selecoes.forEach(function (s) {
        const item = document.createElement("li");
        item.className = s.resultado && s.resultado !== "pendente" ? "resultado--" + s.resultado : "";
        item.textContent = s.selecao + " — " + s.jogo + " (" + s.odd.toFixed(2) + ")";
        lista.appendChild(item);
      });

      const numeros = cartao.querySelectorAll(".aposta__numeros strong");
      numeros[0].textContent = emReais(aposta.valor);
      numeros[1].textContent = aposta.oddTotal.toFixed(2);
      numeros[2].textContent = emReais(aposta.retorno);

      el.historico.appendChild(cartao);
    });
  }

  if (el.btnLimparHist) {
    el.btnLimparHist.addEventListener("click", function () {
      estado.historico = [];
      gravar(CHAVE_HISTORICO, estado.historico);
      desenharHistorico();
      avisar("Histórico apagado.");
    });
  }

  /* ======================================================================
     4. SIMULAÇÃO DOS JOGOS AO VIVO

     O relógio de cada jogo anda e o placar pode mudar. As odds NÃO são
     sorteadas: elas são CALCULADAS a partir do placar e do tempo que falta.

     A consequência é a que se vê numa casa de apostas de verdade:
       - quem está perdendo tem a odd SUBINDO (fica menos provável vencer)
       - quem está ganhando tem a odd CAINDO
       - quanto menos tempo resta, mais extremo fica o desequilíbrio
     ====================================================================== */

  const MAPAS_CS = ["Nuke", "Ancient", "Mirage", "Inferno", "Dust2", "Anubis"];

  // Estado vivo de cada jogo, ligado ao HTML pelo data-evento
  const jogosAoVivo = {
    "san-vas":         { tipo: "futebol",  minuto: 67, placar: [1, 0] },
    "bah-for":         { tipo: "futebol",  minuto: 34, placar: [0, 0] },
    "cap-bra":         { tipo: "futebol",  minuto: 78, placar: [1, 2] },
    "gre-cru":         { tipo: "futebol",  minuto: 55, placar: [2, 1] },
    "mia-chi":         { tipo: "basquete", quarto: 3, segundos: 252, placar: [88, 84] },
    "lal-gsw-live":    { tipo: "basquete", quarto: 2, segundos: 340, placar: [50, 54] },
    "loud-furia-live": { tipo: "esports",  mapa: 3, mapaNome: "Nuke",    rounds: [9, 7], placar: [1, 1] },
    "pain-imp-live":   { tipo: "esports",  mapa: 2, mapaNome: "Ancient", rounds: [5, 9], placar: [0, 1] }
  };

  /* ---------- Probabilidades ----------
     Cada função devolve as probabilidades NA MESMA ORDEM dos botões de odd
     do cartão: [casa, empate, fora] no futebol, [casa, fora] nos outros. */

  function probFutebol(j) {
    const restante = Math.max(0, 90 - j.minuto) / 90;
    const d = j.placar[0] - j.placar[1];

    // Chance de empate: cresce muito no fim se o jogo está empatado,
    // e encolhe se alguém está na frente.
    const pEmpate = d === 0
      ? 0.26 + 0.48 * Math.pow(1 - restante, 2)
      : 0.05 + 0.25 * Math.pow(restante, 0.6);

    // Cada gol de vantagem pesa mais conforme o tempo passa.
    // O 0.18 é a vantagem de jogar em casa.
    const forca = 0.18 + d * (0.75 + (1 - restante) * 1.7);
    const rel = 1 / (1 + Math.exp(-forca));

    return [(1 - pEmpate) * rel, pEmpate, (1 - pEmpate) * (1 - rel)];
  }

  function probBasquete(j) {
    const totalSegundos = 4 * 720;
    const faltam = Math.max(0, j.segundos + (4 - j.quarto) * 720);
    const restante = faltam / totalSegundos;
    const d = j.placar[0] - j.placar[1];

    // No basquete cada ponto vale menos que um gol: a diferença precisa ser
    // grande para virar favoritismo, e só decide mesmo perto do fim.
    const forca = d * (0.055 + (1 - restante) * 0.13);
    const rel = 1 / (1 + Math.exp(-forca));

    return [rel, 1 - rel];
  }

  function probEsports(j) {
    const dMapas = j.placar[0] - j.placar[1];
    const dRounds = j.rounds[0] - j.rounds[1];
    const forca = dMapas * 1.1 + dRounds * 0.12;
    const rel = 1 / (1 + Math.exp(-forca));

    return [rel, 1 - rel];
  }

  function probabilidades(j) {
    if (j.tipo === "futebol") return probFutebol(j);
    if (j.tipo === "basquete") return probBasquete(j);
    return probEsports(j);
  }

  /** Converte probabilidade em odd, já com a margem da casa e os limites */
  function oddDe(p) {
    if (!isFinite(p) || p <= 0) return ODD_TETO;
    const bruta = 1 / (p * MARGEM);
    return Math.min(ODD_TETO, Math.max(ODD_PISO, Math.round(bruta * 100) / 100));
  }

  /* ---------- Passagem do tempo ---------- */

  function avancarFutebol(j) {
    j.minuto += 1;
    // ~1,2% de chance de gol por minuto para cada lado (~1 gol por time/jogo)
    if (Math.random() < 0.013) j.placar[0] += 1;
    if (Math.random() < 0.011) j.placar[1] += 1;
    if (j.minuto >= 90) {
      j.minuto = 90;
      j.encerrado = true;
    }
  }

  function avancarBasquete(j) {
    j.segundos -= 24; // uma posse de bola
    if (Math.random() < 0.46) j.placar[0] += Math.random() < 0.32 ? 3 : 2;
    if (Math.random() < 0.45) j.placar[1] += Math.random() < 0.30 ? 3 : 2;

    if (j.segundos <= 0) {
      if (j.quarto >= 4) {
        j.segundos = 0;
        j.encerrado = true;
      } else {
        j.quarto += 1;
        j.segundos = 720;
      }
    }
  }

  function avancarEsports(j) {
    // Quem está melhor tem uma vantagem leve para levar o round
    const chanceCasa = 0.42 + probEsports(j)[0] * 0.16;
    j.rounds[Math.random() < chanceCasa ? 0 : 1] += 1;

    // Mapa termina em 13 rounds
    if (Math.max(j.rounds[0], j.rounds[1]) >= 13) {
      j.placar[j.rounds[0] > j.rounds[1] ? 0 : 1] += 1;
      j.rounds = [0, 0];
      j.mapa += 1;
      j.mapaNome = MAPAS_CS[Math.floor(Math.random() * MAPAS_CS.length)];

      // Melhor de 3: quem chegar a 2 mapas leva a série
      if (Math.max(j.placar[0], j.placar[1]) >= 2) j.encerrado = true;
    }
  }

  function avancar(j) {
    if (j.tipo === "futebol") avancarFutebol(j);
    else if (j.tipo === "basquete") avancarBasquete(j);
    else avancarEsports(j);
  }

  /**
   * Recomeça um jogo que terminou, do zero.
   * É o que mantém a seção "ao vivo" viva numa demonstração — sem isso, em
   * poucos minutos todos os jogos estariam encerrados e a tela ficaria parada.
   */
  function reiniciar(j) {
    j.encerrado = false;
    j.pausa = 0;
    j.limpouCupom = false;
    j.placar = [0, 0];

    if (j.tipo === "futebol") {
      j.minuto = 1;
    } else if (j.tipo === "basquete") {
      j.quarto = 1;
      j.segundos = 720;
    } else {
      j.mapa = 1;
      j.rounds = [0, 0];
      j.mapaNome = MAPAS_CS[Math.floor(Math.random() * MAPAS_CS.length)];
    }
  }

  /* ---------- Texto do relógio ---------- */

  function textoRelogio(j) {
    if (j.encerrado) return "Encerrado";

    if (j.tipo === "futebol") {
      return (j.minuto <= 45 ? "1º tempo" : "2º tempo") + " · " + j.minuto + "'";
    }

    if (j.tipo === "basquete") {
      const minutos = Math.floor(j.segundos / 60);
      const segundos = j.segundos % 60;
      return j.quarto + "º quarto · " + minutos + ":" + String(segundos).padStart(2, "0");
    }

    return "Mapa " + j.mapa + " · " + j.mapaNome + " · " + j.rounds[0] + "–" + j.rounds[1];
  }

  /* ---------- Liquidação: paga (ou não) as apostas quando um jogo acaba ----------
     Sem isto, apostar era uma via de mão única: o valor saía do saldo e nunca
     mais voltava, nem quando a seleção "vencia" a partida ao vivo. */

  /** Índice do botão de odd (casa/empate/fora) que corresponde ao resultado final */
  function indiceVencedor(j) {
    const d = j.placar[0] - j.placar[1];

    if (j.tipo === "futebol") {
      if (d > 0) return 0; // casa
      if (d < 0) return 2; // fora
      return 1;            // empate
    }

    // Basquete e e-sports não têm empate: só dois botões
    return d >= 0 ? 0 : 1;
  }

  /**
   * Decide se uma aposta já pode ser dada como ganha ou perdida, agora que
   * (pelo menos) uma das suas seleções acabou de ser resolvida.
   * @returns {number} quanto creditar no saldo (0 se ainda não decidiu, ou se perdeu)
   */
  function reavaliarAposta(aposta) {
    if (aposta.status !== "pendente") return 0; // já foi liquidada antes

    if (aposta.selecoes.some((s) => s.resultado === "perdeu")) {
      aposta.status = "perdeu";
      return 0;
    }
    if (aposta.selecoes.every((s) => s.resultado === "ganhou")) {
      aposta.status = "ganhou";
      return aposta.retorno;
    }
    return 0; // múltipla com pernas em outros jogos que ainda não terminaram
  }

  /** Chamado uma única vez, no instante em que um jogo ao vivo encerra */
  function liquidarEvento(id, j) {
    const cartao = document.querySelector('.evento[data-evento="' + id + '"]');
    const botoes = cartao ? cartao.querySelectorAll(".odd") : [];
    const botaoVencedor = botoes[indiceVencedor(j)];
    if (!botaoVencedor) return;

    const selecaoVencedora = botaoVencedor.dataset.selecao;
    let credito = 0;
    let apostasPerdidas = 0;
    let mudouAlgo = false;

    estado.historico.forEach(function (aposta) {
      const perna = aposta.selecoes.find((s) => s.evento === id && s.resultado === "pendente");
      if (!perna) return;

      perna.resultado = (perna.selecao === selecaoVencedora) ? "ganhou" : "perdeu";
      mudouAlgo = true;

      const antes = aposta.status;
      const ganho = reavaliarAposta(aposta);
      credito += ganho;
      if (antes === "pendente" && aposta.status === "perdeu") apostasPerdidas += 1;
    });

    if (!mudouAlgo) return;

    gravar(CHAVE_HISTORICO, estado.historico);
    desenharHistorico();

    if (credito > 0) {
      alterarSaldo(credito);
      avisar(emReais(credito) + " creditados — sua aposta em " + selecaoVencedora + " venceu!");
    } else if (apostasPerdidas > 0) {
      avisar(
        (apostasPerdidas === 1 ? "Uma aposta foi perdida" : apostasPerdidas + " apostas foram perdidas") +
        " — o resultado saiu " + selecaoVencedora + ".",
        "erro"
      );
    }
  }

  /* ---------- Aplica o estado no cartão da tela ---------- */

  /** @returns {boolean} se alguma odd do cupom mudou */
  function aplicarNoCartao(id, j) {
    const cartao = document.querySelector('.evento[data-evento="' + id + '"]');
    if (!cartao) return false;

    const campoPlacar = cartao.querySelector(".evento__placar");
    if (campoPlacar) campoPlacar.textContent = j.placar[0] + " – " + j.placar[1];

    const campoRelogio = cartao.querySelector(".evento__relogio");
    if (campoRelogio) campoRelogio.textContent = textoRelogio(j);

    cartao.classList.toggle("evento--encerrado", j.encerrado === true);

    // Jogo encerrado: as odds congelam
    if (j.encerrado) return false;

    const probs = probabilidades(j);
    const botoes = Array.from(cartao.querySelectorAll(".odd"));
    let mexeuNoCupom = false;

    botoes.forEach(function (botao, indice) {
      if (probs[indice] === undefined) return;

      const novaOdd = oddDe(probs[indice]);
      const oddAtual = parseFloat(botao.dataset.odd);
      if (novaOdd === oddAtual) return;

      botao.dataset.odd = novaOdd.toFixed(2);
      const campoValor = botao.querySelector(".odd__valor");
      if (campoValor) campoValor.textContent = novaOdd.toFixed(2);

      // Destaque temporário: verde se subiu, vermelho se caiu
      botao.classList.remove("subiu", "caiu");
      void botao.offsetWidth;
      botao.classList.add(novaOdd > oddAtual ? "subiu" : "caiu");
      setTimeout(function () {
        botao.classList.remove("subiu", "caiu");
      }, 1400);

      // Se essa odd está no cupom, o cupom precisa acompanhar
      const noCupom = estado.selecoes.find(
        (s) => s.evento === id && s.selecao === botao.dataset.selecao
      );
      if (noCupom) {
        noCupom.odd = novaOdd;
        mexeuNoCupom = true;
      }
    });

    return mexeuNoCupom;
  }

  /** Um "minuto" de jogo em todos os cartões ao vivo */
  function variarOddsAoVivo() {
    let redesenharCupom = false;

    Object.keys(jogosAoVivo).forEach(function (id) {
      const j = jogosAoVivo[id];

      if (j.encerrado) {
        /*
          Quando a partida acaba, a aposta ao vivo deixa de existir. Se o
          jogo continuasse no cupom, ele voltaria com odds de um jogo novo
          quando reiniciasse — e o retorno mudaria sozinho, do nada.
          Por isso a seleção sai do cupom assim que o jogo encerra.
        */
        if (!j.limpouCupom) {
          j.limpouCupom = true;

          // Paga (ou não) quem já tinha apostado nesse jogo antes dele acabar
          liquidarEvento(id, j);

          const antes = estado.selecoes.length;
          estado.selecoes = estado.selecoes.filter((s) => s.evento !== id);
          if (estado.selecoes.length !== antes) {
            redesenharCupom = true;
            avisar("Um jogo do seu cupom encerrou — a seleção foi removida.");
          }
        }

        // Fica alguns segundos mostrando "Encerrado" e então recomeça
        j.pausa = (j.pausa || 0) + 1;
        if (j.pausa > 8) reiniciar(j);
      } else {
        avancar(j);
      }

      if (aplicarNoCartao(id, j)) redesenharCupom = true;
    });

    if (redesenharCupom) desenharCupom();
  }

  /** Desenha o estado inicial sem adiantar o relógio */
  function iniciarAoVivo() {
    Object.keys(jogosAoVivo).forEach(function (id) {
      aplicarNoCartao(id, jogosAoVivo[id]);
    });
  }

  // Só roda enquanto a aba estiver visível
  let intervaloOdds = null;
  function ligarOddsAoVivo() {
    if (intervaloOdds === null) {
      intervaloOdds = setInterval(variarOddsAoVivo, TICK_MS);
    }
  }
  function desligarOddsAoVivo() {
    if (intervaloOdds !== null) {
      clearInterval(intervaloOdds);
      intervaloOdds = null;
    }
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) desligarOddsAoVivo();
    else ligarOddsAoVivo();
  });

  /* ======================================================================
     5. DETALHES DE INTERFACE
     ====================================================================== */

  /* ---------- Cupom no celular: abre e fecha ---------- */
  if (el.cupomAlternar && el.cupom) {
    el.cupomAlternar.addEventListener("click", function () {
      // No desktop o cupom é uma coluna fixa: não faz sentido recolher
      if (window.matchMedia("(min-width: 1024px)").matches) return;

      const aberto = el.cupom.classList.toggle("aberto");
      el.cupomAlternar.setAttribute("aria-expanded", aberto ? "true" : "false");
    });
  }

  /* ---------- Chip da categoria em destaque conforme a rolagem ---------- */
  function acompanharSecoes() {
    const chips = $$(".barra-esportes .chip");
    if (chips.length === 0 || !("IntersectionObserver" in window)) return;

    const secoes = chips
      .map(function (chip) {
        const id = chip.getAttribute("href").slice(1);
        return { chip: chip, elemento: document.getElementById(id) };
      })
      .filter((par) => par.elemento !== null);

    const observador = new IntersectionObserver(
      function (entradas) {
        entradas.forEach(function (entrada) {
          if (!entrada.isIntersecting) return;
          const par = secoes.find((p) => p.elemento === entrada.target);
          if (!par) return;
          chips.forEach((c) => c.classList.remove("ativo"));
          par.chip.classList.add("ativo");
        });
      },
      // Considera "ativa" a seção que estiver na faixa central da tela
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
    );

    secoes.forEach((par) => observador.observe(par.elemento));
  }

  /* ---------- Multiplicador do card do Aviator, só de enfeite ---------- */
  function iniciarAviator() {
    const elMultiplicador = document.getElementById("aviator-multiplicador");
    if (!elMultiplicador) return;

    let multiplicador = 1.0;
    let alvoQueda = sortearAlvoQueda();
    let caiu = false;
    let ticksDePausa = 0;

    function sortearAlvoQueda() {
      // A maioria das rodadas cai cedo (entre 1.2x e ~3x); voos longos são raros
      return 1.2 + Math.random() * Math.random() * 7;
    }

    setInterval(function () {
      if (document.hidden) return;

      if (ticksDePausa > 0) {
        ticksDePausa -= 1;
        return;
      }

      if (caiu) {
        caiu = false;
        multiplicador = 1.0;
        alvoQueda = sortearAlvoQueda();
        elMultiplicador.textContent = "1.00x";
        elMultiplicador.classList.remove("jogo-cassino__multiplicador--caiu");
        return;
      }

      multiplicador += multiplicador * 0.018 + 0.01;

      if (multiplicador >= alvoQueda) {
        elMultiplicador.textContent = "💥 " + alvoQueda.toFixed(2) + "x";
        elMultiplicador.classList.add("jogo-cassino__multiplicador--caiu");
        caiu = true;
        ticksDePausa = 10;
        return;
      }

      elMultiplicador.textContent = multiplicador.toFixed(2) + "x";
    }, 120);
  }

  /* ======================================================================
     INICIALIZAÇÃO
     ====================================================================== */

  carregarSaldo();
  carregarHistorico();
  desenharCupom();
  iniciarAoVivo();
  ligarOddsAoVivo();
  acompanharSecoes();
  iniciarAviator();
})();
