/* ==========================================================================
   VOLTBET — página de recarga

   IMPORTANTE — o que este arquivo NÃO faz:
     - não envia nada para servidor nenhum (não existe fetch aqui);
     - não guarda número de cartão, CVV, nome ou validade em lugar algum:
       os campos são lidos, validados no formato e descartados;
     - o que fica salvo é apenas { valor, método, data } do depósito.

   A validação do cartão é só de FORMATO (algoritmo de Luhn), para demonstrar
   validação de formulário. Nenhuma cobrança acontece.
   ========================================================================== */

(function () {
  "use strict";

  const VB = window.VOLTBET;
  if (!VB) return;

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const DEPOSITO_MINIMO = 10;
  const CARTAO_TESTE = "4111 1111 1111 1111";

  let metodo = "pix"; // pix | cartão | boleto

  /* ======================================================================
     VALOR
     ====================================================================== */

  const campoValor = $("#valor-deposito");

  function valorAtual() {
    return parseFloat(campoValor.value) || 0;
  }

  // Chips de valor rápido
  $$(".valor-chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      campoValor.value = chip.dataset.valor;
      marcarChipAtivo();
      atualizarTudo();
    });
  });

  /** Deixa aceso o chip que corresponde ao valor digitado (se houver) */
  function marcarChipAtivo() {
    const valor = valorAtual();
    $$(".valor-chip").forEach(function (chip) {
      chip.classList.toggle("ativo", Number(chip.dataset.valor) === valor);
    });
  }

  campoValor.addEventListener("input", function () {
    marcarChipAtivo();
    atualizarTudo();
  });

  /* ======================================================================
     ABAS DE MÉTODO
     ====================================================================== */

  $$(".aba").forEach(function (aba) {
    aba.addEventListener("click", function () {
      metodo = aba.dataset.metodo;

      $$(".aba").forEach(function (outra) {
        const ativa = outra === aba;
        outra.classList.toggle("ativa", ativa);
        outra.setAttribute("aria-selected", ativa ? "true" : "false");
      });

      $$(".painel-aba").forEach(function (painel) {
        painel.hidden = painel.getAttribute("aria-labelledby") !== aba.id;
      });

      atualizarTudo();
    });
  });

  /* ======================================================================
     PIX — código copia e cola (fictício)
     ====================================================================== */

  /**
   * Monta algo com a cara de um payload PIX real, mas que não é reconhecido
   * por banco nenhum. É só para a tela não ficar vazia.
   */
  function gerarCodigoPix(valor) {
    const centavos = valor.toFixed(2);
    const bloco = "00020126580014BR.GOV.BCB.PIX0136" +
      "demo-voltbet-0000-0000-portfolio" +
      "5204000053039865802BR5913VOLTBET DEMO6009SAO PAULO62070503***" +
      "54" + String(centavos.length).padStart(2, "0") + centavos +
      "6304DEMO";
    return bloco;
  }

  function atualizarPix() {
    const campo = $("#codigo-pix");
    if (campo) campo.value = gerarCodigoPix(valorAtual());
  }

  /** Copia um texto para a área de transferência, com plano B */
  function copiar(texto, mensagemOk) {
    function fallback() {
      const temp = document.createElement("textarea");
      temp.value = texto;
      temp.setAttribute("readonly", "");
      temp.style.position = "fixed";
      temp.style.opacity = "0";
      document.body.appendChild(temp);
      temp.select();
      try {
        document.execCommand("copy");
        VB.avisar(mensagemOk);
      } catch (erro) {
        VB.avisar("Não foi possível copiar. Selecione o texto manualmente.", "erro");
      }
      document.body.removeChild(temp);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto)
        .then(function () { VB.avisar(mensagemOk); })
        .catch(fallback);
    } else {
      fallback();
    }
  }

  const btnCopiarPix = $("#btn-copiar-pix");
  if (btnCopiarPix) {
    btnCopiarPix.addEventListener("click", function () {
      copiar($("#codigo-pix").value, "Código PIX copiado (fictício).");
    });
  }

  /* ======================================================================
     BOLETO — vencimento e linha digitável (fictícios)
     ====================================================================== */

  function atualizarBoleto() {
    const valor = valorAtual();

    // Vence em 3 dias
    const vencimento = new Date();
    vencimento.setDate(vencimento.getDate() + 3);

    const campoVenc = $("#boleto-vencimento");
    if (campoVenc) {
      campoVenc.textContent = vencimento.toLocaleDateString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric"
      });
    }

    const campoValor = $("#boleto-valor");
    if (campoValor) campoValor.textContent = VB.emReais(valor);

    // Linha digitável de mentira, mas no formato certo (47 dígitos)
    const centavos = String(Math.round(valor * 100)).padStart(10, "0");
    const campoLinha = $("#linha-digitavel");
    if (campoLinha) {
      campoLinha.value =
        "34191.79001 01043.510047 91020.150008 8 " +
        vencimento.getFullYear() + centavos;
    }
  }

  const btnCopiarBoleto = $("#btn-copiar-boleto");
  if (btnCopiarBoleto) {
    btnCopiarBoleto.addEventListener("click", function () {
      copiar($("#linha-digitavel").value, "Linha digitável copiada (fictícia).");
    });
  }

  /* ======================================================================
     CARTÃO — só validação de formato

     Nada daqui é guardado nem enviado. Depois de confirmar, os campos são
     limpos na hora.
     ====================================================================== */

  const cartaoNumero = $("#cartao-numero");
  const cartaoNome = $("#cartao-nome");
  const cartaoValidade = $("#cartao-validade");
  const cartaoCvv = $("#cartao-cvv");
  const cartaoParcelas = $("#cartao-parcelas");

  /** Algoritmo de Luhn: confere se a sequência de dígitos é possível */
  function passaNoLuhn(digitos) {
    let soma = 0;
    let dobra = false;

    for (let i = digitos.length - 1; i >= 0; i--) {
      let n = Number(digitos[i]);
      if (dobra) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      soma += n;
      dobra = !dobra;
    }

    return digitos.length >= 13 && soma % 10 === 0;
  }

  // Formata em grupos de 4 enquanto digita
  if (cartaoNumero) {
    cartaoNumero.addEventListener("input", function () {
      const so = cartaoNumero.value.replace(/\D/g, "").slice(0, 16);
      cartaoNumero.value = so.replace(/(\d{4})(?=\d)/g, "$1 ");
      atualizarResumo();
    });
  }

  // Formata MM/AA enquanto digita
  if (cartaoValidade) {
    cartaoValidade.addEventListener("input", function () {
      const so = cartaoValidade.value.replace(/\D/g, "").slice(0, 4);
      cartaoValidade.value = so.length > 2 ? so.slice(0, 2) + "/" + so.slice(2) : so;
      atualizarResumo();
    });
  }

  if (cartaoCvv) {
    cartaoCvv.addEventListener("input", function () {
      cartaoCvv.value = cartaoCvv.value.replace(/\D/g, "").slice(0, 4);
      atualizarResumo();
    });
  }

  if (cartaoNome) cartaoNome.addEventListener("input", atualizarResumo);
  if (cartaoParcelas) cartaoParcelas.addEventListener("change", atualizarTudo);

  const btnCartaoTeste = $("#btn-cartao-teste");
  if (btnCartaoTeste) {
    btnCartaoTeste.addEventListener("click", function () {
      cartaoNumero.value = CARTAO_TESTE;
      cartaoNome.value = "BRYAN E GOUVEA";
      cartaoValidade.value = "12/30";
      cartaoCvv.value = "123";
      atualizarTudo();
      VB.avisar("Cartão de teste preenchido. Nenhum dado real envolvido.");
    });
  }

  /** @returns {string} mensagem de erro, ou "" se estiver tudo certo */
  function validarCartao() {
    const digitos = cartaoNumero.value.replace(/\D/g, "");

    if (digitos.length < 13) return "Número do cartão incompleto.";
    if (!passaNoLuhn(digitos)) return "Número de cartão inválido. Use o cartão de teste.";
    if (cartaoNome.value.trim().length < 3) return "Informe o nome impresso no cartão.";

    const validade = cartaoValidade.value.split("/");
    const mes = Number(validade[0]);
    const ano = Number(validade[1]);

    if (!(mes >= 1 && mes <= 12) || !(ano >= 0)) return "Validade inválida (use MM/AA).";
    if (cartaoValidade.value.replace(/\D/g, "").length !== 4) return "Validade incompleta.";

    // Compara com o mês atual
    const hoje = new Date();
    const anoCompleto = 2000 + ano;
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth() + 1;
    if (anoCompleto < anoAtual || (anoCompleto === anoAtual && mes < mesAtual)) {
      return "Cartão vencido.";
    }

    if (cartaoCvv.value.length < 3) return "CVV incompleto.";

    return "";
  }

  /** Limpa os campos do cartão — chamado assim que o depósito é confirmado */
  function limparCartao() {
    if (cartaoNumero) cartaoNumero.value = "";
    if (cartaoNome) cartaoNome.value = "";
    if (cartaoValidade) cartaoValidade.value = "";
    if (cartaoCvv) cartaoCvv.value = "";
  }

  function atualizarParcelas() {
    const campo = $("#cartao-parcela-texto");
    if (!campo || !cartaoParcelas) return;

    const vezes = Number(cartaoParcelas.value);
    const valor = valorAtual();

    campo.textContent = vezes === 1
      ? "Cobrança única de " + VB.emReais(valor) + "."
      : vezes + " parcelas de " + VB.emReais(valor / vezes) + " — total " + VB.emReais(valor) + ".";
  }

  /* ======================================================================
     RESUMO E CONFIRMAÇÃO
     ====================================================================== */

  const btnConfirmar = $("#btn-confirmar");
  const campoErro = $("#recarga-erro");

  const NOME_METODO = { pix: "PIX", "cartão": "Cartão de crédito", boleto: "Boleto" };

  /** @returns {string} erro que impede o depósito, ou "" */
  function validarDeposito() {
    const valor = valorAtual();

    if (!isFinite(valor) || valor <= 0) return "Informe um valor.";
    if (valor < DEPOSITO_MINIMO) return "O depósito mínimo é " + VB.emReais(DEPOSITO_MINIMO) + ".";

    if (valor > VB.limiteRestante()) {
      return "Limite mensal atingido. Ainda cabem " + VB.emReais(VB.limiteRestante()) + " neste mês.";
    }

    if (metodo === "cartão") return validarCartao();

    return "";
  }

  function atualizarResumo() {
    const valor = valorAtual();
    const saldo = VB.lerSaldo();

    const def = (id, texto) => {
      const campo = document.getElementById(id);
      if (campo) campo.textContent = texto;
    };

    def("resumo-saldo-atual", VB.emReais(saldo));
    def("resumo-deposito", VB.emReais(valor));
    def("resumo-metodo", NOME_METODO[metodo] || metodo);
    def("resumo-saldo-final", VB.emReais(saldo + valor));
    def("texto-limite", VB.emReais(VB.limiteRestante()));

    const erro = validarDeposito();
    if (btnConfirmar) btnConfirmar.disabled = erro !== "";
    if (campoErro) {
      campoErro.textContent = erro;

      // Enquanto o cartão está sendo preenchido, não fica acusando erro a cada
      // tecla digitada — o aviso só aparece quando o foco sai do formulário
      // ou quando o usuário clica em confirmar.
      const digitandoCartao =
        metodo === "cartão" &&
        document.activeElement !== null &&
        document.activeElement.closest(".form-cartao") !== null;

      campoErro.hidden = erro === "" || digitandoCartao;
    }
  }

  function atualizarTudo() {
    atualizarPix();
    atualizarBoleto();
    atualizarParcelas();
    atualizarResumo();
  }

  if (btnConfirmar) {
    btnConfirmar.addEventListener("click", function () {
      const erro = validarDeposito();
      if (erro) {
        if (campoErro) {
          campoErro.textContent = erro;
          campoErro.hidden = false;
        }
        VB.avisar(erro, "erro");
        return;
      }

      const resultado = VB.depositar(valorAtual(), NOME_METODO[metodo] || metodo);

      if (!resultado.ok) {
        VB.avisar(resultado.mensagem, "erro");
        return;
      }

      // Os dados do cartão somem no instante em que o depósito é confirmado
      limparCartao();

      VB.avisar(
        metodo === "boleto"
          ? "Boleto compensado (simulação). " + resultado.mensagem
          : resultado.mensagem
      );

      desenharDepositos();
      atualizarTudo();
    });
  }

  /* ======================================================================
     LISTA DE DEPÓSITOS
     ====================================================================== */

  function desenharDepositos() {
    const lista = $("#lista-depositos");
    const vazio = $("#depositos-vazio");
    if (!lista) return;

    Array.from(lista.children).forEach(function (filho) {
      if (filho !== vazio) filho.remove();
    });

    const depositos = VB.lerDepositos();
    if (vazio) vazio.hidden = depositos.length > 0;

    depositos.slice(0, 10).forEach(function (d) {
      const quando = new Date(d.data).toLocaleString("pt-BR", {
        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
      });

      const item = document.createElement("article");
      item.className = "aposta";
      item.innerHTML =
        '<div class="aposta__topo">' +
          '<span class="aposta__tipo"></span>' +
          '<span class="aposta__data"></span>' +
        "</div>" +
        '<div class="aposta__numeros"><span class="destaque">Valor<strong></strong></span></div>';

      item.querySelector(".aposta__tipo").textContent = d.metodo || "Depósito";
      item.querySelector(".aposta__data").textContent = quando;
      item.querySelector(".aposta__numeros strong").textContent = VB.emReais(d.valor);

      lista.appendChild(item);
    });
  }

  /* ======================================================================
     INICIALIZAÇÃO
     ====================================================================== */

  VB.pintarSaldoNoCabecalho(false);
  marcarChipAtivo();
  atualizarTudo();
  desenharDepositos();

  // Zerar a demonstração pelo painel de perfil também limpa esta tela
  document.addEventListener("voltbet:zerado", function () {
    desenharDepositos();
    atualizarTudo();
  });
})();
