/* ==========================================================================
   VOLTBET — fundo animado
   Partículas verdes que se conectam por linhas quando ficam próximas.

   Cuidados de desempenho (o site precisa rodar liso em notebook sem placa
   de vídeo dedicada):
     - número de partículas proporcional à área, com teto baixo;
     - densidade de pixels limitada a 1.5x mesmo em telas Retina;
     - a animação PARA quando a aba não está visível;
     - respeita prefers-reduced-motion (nem inicia).
   ========================================================================== */

(function () {
  "use strict";

  const canvas = document.getElementById("fundo-animado");
  if (!canvas) return;

  // Quem pediu menos movimento no sistema não recebe animação nenhuma.
  const querMenosMovimento = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (querMenosMovimento.matches) {
    canvas.style.display = "none";
    return;
  }

  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  /* ---------- Configuração ---------- */
  const COR = "0, 255, 136";        // verde neon, em RGB para montar rgba()
  const DISTANCIA_LINHA = 130;      // distância máxima para ligar duas partículas
  const MAX_PARTICULAS = 70;        // teto absoluto, para não pesar
  const AREA_POR_PARTICULA = 18000; // quanto maior, menos partículas

  let particulas = [];
  let largura = 0;
  let altura = 0;
  let escala = 1;
  let animacao = null;

  /* ---------- Ajusta o canvas ao tamanho da janela ---------- */
  function redimensionar() {
    const novaLargura = window.innerWidth;
    const novaAltura = window.innerHeight;

    // Se a janela ainda não tem tamanho (acontece quando a aba é aberta em
    // segundo plano), tenta de novo no próximo quadro em vez de criar um
    // canvas de 0x0 — que ficaria invisível para sempre.
    if (novaLargura === 0 || novaAltura === 0) {
      requestAnimationFrame(redimensionar);
      return;
    }

    // Limita a 1.5 para não desenhar 4x pixels à toa em telas de alta densidade
    escala = Math.min(window.devicePixelRatio || 1, 1.5);
    largura = novaLargura;
    altura = novaAltura;

    canvas.width = Math.floor(largura * escala);
    canvas.height = Math.floor(altura * escala);
    canvas.style.width = largura + "px";
    canvas.style.height = altura + "px";

    ctx.setTransform(escala, 0, 0, escala, 0, 0);

    criarParticulas();
  }

  /* ---------- Cria as partículas ---------- */
  function criarParticulas() {
    const quantidade = Math.min(
      MAX_PARTICULAS,
      Math.floor((largura * altura) / AREA_POR_PARTICULA)
    );

    particulas = [];
    for (let i = 0; i < quantidade; i++) {
      particulas.push({
        x: Math.random() * largura,
        y: Math.random() * altura,
        // Velocidade bem baixa: o fundo deve ser quase imperceptível
        vx: (Math.random() - 0.5) * 0.32,
        vy: (Math.random() - 0.5) * 0.32,
        raio: Math.random() * 1.6 + 0.7,
        brilho: Math.random() * 0.35 + 0.25
      });
    }
  }

  /* ---------- Desenha um quadro ---------- */
  function desenhar() {
    ctx.clearRect(0, 0, largura, altura);

    // 1) Move e desenha cada partícula
    for (let i = 0; i < particulas.length; i++) {
      const p = particulas[i];

      p.x += p.vx;
      p.y += p.vy;

      // Ao sair de um lado, reaparece do outro (efeito de campo infinito)
      if (p.x < -10) p.x = largura + 10;
      if (p.x > largura + 10) p.x = -10;
      if (p.y < -10) p.y = altura + 10;
      if (p.y > altura + 10) p.y = -10;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.raio, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(" + COR + ", " + p.brilho + ")";
      ctx.fill();
    }

    // 2) Liga as que estiverem perto umas das outras
    for (let i = 0; i < particulas.length; i++) {
      for (let j = i + 1; j < particulas.length; j++) {
        const a = particulas[i];
        const b = particulas[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distancia = Math.sqrt(dx * dx + dy * dy);

        if (distancia < DISTANCIA_LINHA) {
          // Quanto mais perto, mais visível a linha
          const opacidade = (1 - distancia / DISTANCIA_LINHA) * 0.14;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = "rgba(" + COR + ", " + opacidade + ")";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    animacao = requestAnimationFrame(desenhar);
  }

  /* ---------- Liga e desliga ---------- */
  function iniciar() {
    if (animacao === null) {
      animacao = requestAnimationFrame(desenhar);
    }
  }

  function parar() {
    if (animacao !== null) {
      cancelAnimationFrame(animacao);
      animacao = null;
    }
  }

  // Economiza bateria e processador quando a aba está em segundo plano
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) parar();
    else iniciar();
  });

  // Redimensionar com "debounce": só recalcula quando o usuário para de arrastar
  let temporizador = null;
  window.addEventListener("resize", function () {
    clearTimeout(temporizador);
    temporizador = setTimeout(redimensionar, 180);
  });

  // Se o usuário mudar a preferência de movimento durante a visita
  querMenosMovimento.addEventListener("change", function (evento) {
    if (evento.matches) {
      parar();
      canvas.style.display = "none";
    } else {
      canvas.style.display = "";
      redimensionar();
      iniciar();
    }
  });

  redimensionar();
  iniciar();
})();
