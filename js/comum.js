/* ==========================================================================
   VOLTBET — código compartilhado entre as páginas

   Tudo que a página inicial e a de recarga precisam usar em comum:
   formatação de dinheiro, leitura/escrita no localStorage, saldo, histórico,
   limite de depósito e o aviso flutuante (toast).

   Publica um único objeto global: window.VOLTBET
   ========================================================================== */

window.VOLTBET = (function () {
  "use strict";

  /* ---------- Constantes ---------- */

  const CHAVES = {
    saldo: "voltbet:saldo",
    historico: "voltbet:historico",
    depositos: "voltbet:depositos"
  };

  const SALDO_INICIAL = 1000000000;

  // Jogo responsável: teto de quanto pode ser depositado no mês.
  // Casas de apostas de verdade são obrigadas a oferecer um limite assim.
  const LIMITE_MES = 2000;

  /* ---------- Dinheiro ---------- */

  const formatadorReal = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

  /** Converte 1234.5 em "R$ 1.234,50" */
  function emReais(valor) {
    return formatadorReal.format(isFinite(valor) ? valor : 0);
  }

  /* ---------- Armazenamento ---------- */

  /** Lê do localStorage sem quebrar se estiver indisponível ou corrompido */
  function lerArmazenado(chave, padrao) {
    try {
      const bruto = localStorage.getItem(chave);
      if (bruto === null) return padrao;
      return JSON.parse(bruto);
    } catch (erro) {
      return padrao;
    }
  }

  /** Grava no localStorage ignorando erros (aba anônima, cota cheia, etc.) */
  function gravar(chave, valor) {
    try {
      localStorage.setItem(chave, JSON.stringify(valor));
    } catch (erro) {
      /* Sem armazenamento: o site continua funcionando só nesta sessão. */
    }
  }

  /* ---------- Saldo ---------- */

  function lerSaldo() {
    const guardado = lerArmazenado(CHAVES.saldo, SALDO_INICIAL);
    return (typeof guardado === "number" && isFinite(guardado) && guardado >= 0)
      ? guardado
      : SALDO_INICIAL;
  }

  /**
   * Grava o saldo e avisa a página inteira que ele mudou.
   * O painel de perfil escuta esse evento para se atualizar sozinho.
   */
  function gravarSaldo(valor) {
    const seguro = Math.max(0, valor);
    gravar(CHAVES.saldo, seguro);
    document.dispatchEvent(new CustomEvent("voltbet:saldo", { detail: seguro }));
    return seguro;
  }

  /* ---------- Histórico de apostas ---------- */

  function lerHistorico() {
    const guardado = lerArmazenado(CHAVES.historico, []);
    return Array.isArray(guardado) ? guardado : [];
  }

  /** Números do perfil, calculados a partir do histórico */
  function resumoDoPerfil() {
    const apostas = lerHistorico();

    const totalApostado = apostas.reduce((soma, a) => soma + (a.valor || 0), 0);
    const retornoPotencial = apostas.reduce((soma, a) => soma + (a.retorno || 0), 0);
    const maiorOdd = apostas.reduce((maior, a) => Math.max(maior, a.oddTotal || 0), 0);

    return {
      quantidade: apostas.length,
      totalApostado: totalApostado,
      retornoPotencial: retornoPotencial,
      maiorOdd: maiorOdd,
      multiplas: apostas.filter((a) => (a.selecoes || []).length > 1).length
    };
  }

  /* ---------- Depósitos e limite mensal ---------- */

  /** Chave do mês atual, no formato "2026-08" */
  function mesAtual() {
    const hoje = new Date();
    return hoje.getFullYear() + "-" + String(hoje.getMonth() + 1).padStart(2, "0");
  }

  function lerDepositos() {
    const guardado = lerArmazenado(CHAVES.depositos, []);
    return Array.isArray(guardado) ? guardado : [];
  }

  /** Quanto já foi depositado no mês corrente */
  function depositadoNoMes() {
    const mes = mesAtual();
    return lerDepositos()
      .filter((d) => (d.data || "").slice(0, 7) === mes)
      .reduce((soma, d) => soma + (d.valor || 0), 0);
  }

  /** Quanto ainda cabe no limite deste mês */
  function limiteRestante() {
    return Math.max(0, LIMITE_MES - depositadoNoMes());
  }

  /**
   * Registra um depósito fictício e credita o saldo.
   * @returns {{ok:boolean, mensagem:string, saldo:number}}
   */
  function depositar(valor, metodo) {
    if (!isFinite(valor) || valor <= 0) {
      return { ok: false, mensagem: "Informe um valor maior que zero.", saldo: lerSaldo() };
    }

    if (valor > limiteRestante()) {
      return {
        ok: false,
        mensagem: "Limite mensal atingido. Ainda cabem " + emReais(limiteRestante()) +
                  " neste mês (teto de " + emReais(LIMITE_MES) + ").",
        saldo: lerSaldo()
      };
    }

    const depositos = lerDepositos();
    depositos.unshift({
      valor: valor,
      metodo: metodo,
      data: new Date().toISOString()
    });
    gravar(CHAVES.depositos, depositos);

    const novoSaldo = gravarSaldo(lerSaldo() + valor);

    return {
      ok: true,
      mensagem: emReais(valor) + " creditados via " + metodo + ".",
      saldo: novoSaldo
    };
  }

  /* ---------- Aviso flutuante (toast) ---------- */

  let temporizadorToast = null;

  function avisar(mensagem, tipo) {
    const toast = document.getElementById("toast");
    if (!toast) return;

    toast.textContent = mensagem;
    toast.classList.toggle("toast--erro", tipo === "erro");
    toast.classList.add("visivel");

    clearTimeout(temporizadorToast);
    temporizadorToast = setTimeout(function () {
      toast.classList.remove("visivel");
    }, 3600);
  }

  /* ---------- Saldo no cabeçalho (existe nas duas páginas) ---------- */

  function pintarSaldoNoCabecalho(comAnimacao) {
    const campo = document.getElementById("saldo-valor");
    if (!campo) return;

    campo.textContent = emReais(lerSaldo());

    if (comAnimacao) {
      campo.classList.remove("piscou");
      void campo.offsetWidth; // força o navegador a reiniciar a animação
      campo.classList.add("piscou");
    }
  }

  // Qualquer mudança de saldo repinta o cabeçalho, venha de onde vier
  document.addEventListener("voltbet:saldo", function () {
    pintarSaldoNoCabecalho(true);
  });

  return {
    CHAVES: CHAVES,
    SALDO_INICIAL: SALDO_INICIAL,
    LIMITE_MES: LIMITE_MES,
    emReais: emReais,
    lerArmazenado: lerArmazenado,
    gravar: gravar,
    lerSaldo: lerSaldo,
    gravarSaldo: gravarSaldo,
    lerHistorico: lerHistorico,
    resumoDoPerfil: resumoDoPerfil,
    lerDepositos: lerDepositos,
    depositadoNoMes: depositadoNoMes,
    limiteRestante: limiteRestante,
    depositar: depositar,
    avisar: avisar,
    pintarSaldoNoCabecalho: pintarSaldoNoCabecalho
  };
})();
