# VoltBet

Site de apostas esportivas e cassino feito como **demonstração de portfólio**.
Não é uma casa de apostas: não existe dinheiro de verdade, cadastro, pagamento
nem servidor. Todo o saldo é fictício e fica só no seu navegador.

**Site no ar:** https://voltbet3.netlify.app

## O que o site faz

- **Apostas esportivas** — jogos com odds, cupom que soma as seleções e
  calcula o retorno possível
- **Sete jogos de cassino**, cada um escrito do zero em JavaScript:
  Aviator, Mines, Plinko, Roleta e três slots
- **Saldo e histórico** — cada aposta entra no extrato, com saldo guardado
  entre visitas
- **Página de recarga** com limite mensal de depósito
- **Perfil** com o resumo da conta

## Jogo responsável

O projeto leva a sério a parte que os sites de aposta costumam esconder:

- aviso de **+18** e de conteúdo apenas demonstrativo
- **teto de depósito mensal** (R$ 2.000), como a lei exige das casas reais
- botão para **zerar a conta** a qualquer momento

## Como foi feito

| Parte | Ferramenta |
|---|---|
| Estrutura | HTML |
| Estilo | CSS |
| Comportamento | JavaScript (sem biblioteca) |
| Dados | localStorage do navegador |

Sem framework, sem back-end e sem etapa de build: são arquivos que o navegador
abre direto.

## Organização

```
index.html          esportes, cassino e os jogos
recarregar.html     recarga de saldo
css/style.css
css/paginas.css
js/comum.js         saldo, histórico, limite e avisos (window.VOLTBET)
js/script.js        cupom de apostas e navegação
js/aviator.js  js/mines.js  js/plinko.js
js/roleta.js   js/slot.js                  um arquivo por jogo
js/perfil.js   js/recarregar.js
js/fundo.js         animação do fundo
```

`comum.js` publica um único objeto, `window.VOLTBET`, com o que todas as
páginas compartilham — dinheiro, saldo, histórico e limite. Cada jogo só
precisa pedir e devolver valores por ali, sem mexer no armazenamento direto.

## Rodando na sua máquina

Baixe a pasta e abra o `index.html`. Não precisa instalar nada.

---

Feito por **Bryan Eduardo Gouvea** — [github.com/BryanEduardogm](https://github.com/BryanEduardogm)
