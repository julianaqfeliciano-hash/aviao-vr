# Avião VR

Protótipo de cena de avião em realidade virtual para **terapia de exposição em fobia de voar**,
desenvolvido para pesquisa acadêmica. Roda no navegador do **Meta Quest 3**, sem instalar nada.

**Endereço:** https://julianaqfeliciano-hash.github.io/aviao-vr/

O app não coleta, salva nem envia nenhum dado. As notas de ansiedade (SUDS) e os tempos são anotados
pela terapeuta.

## Como usar numa sessão

1. Ligue o Quest e abra o endereço acima no navegador (salve nos favoritos).
2. Toque em **"Entrar no avião"**. A cena abre na fase 1, parado no portão.
3. Coloque o óculos no paciente, já sentado, e **clique no direcional** do controle para recentralizar.
4. Conduza a sessão com os botões abaixo, segurando um dos controles.
5. Para encerrar ou interromper: retire o óculos do paciente.

## Botões do controle

Os dois controles funcionam igual: no esquerdo, **X** faz o mesmo que **A** e **Y** o mesmo que **B**.

| Botão | O que faz | Vibração de confirmação |
|---|---|---|
| **A** (ou X) | Próxima fase. Depois do pouso, volta para a fase 1 | 1 vibração por fase (3 vibrações = fase 3) |
| **B** (ou Y) | Turbulência: desligada → leve → moderada → forte → desligada | 1, 2 ou 3 vibrações conforme o nível; 1 longa ao desligar |
| **Botão lateral** (sob o dedo médio) | Desliga a turbulência na hora | 1 vibração longa |
| **Gatilho** (sob o indicador) | Liga/desliga a luz de "apertar cintos", com "ding" | 1 vibração curta |
| **Clique no direcional** | Recentraliza: põe o paciente na poltrona, olhando para a frente | 1 vibração curta |

Evite o **botão Meta** (símbolo da Meta) durante a sessão: ele abre o menu do Quest.

### As fases

| # | Fase | Duração |
|---|---|---|
| 1 | Parado no portão | até você avançar |
| 2 | Taxiamento | até você avançar |
| 3 | Decolagem | ~60 s, passa sozinha para o cruzeiro |
| 4 | Cruzeiro | até você avançar |
| 5 | Descida e pouso | ~75 s, termina com o avião parado |

## Modo notebook (sem óculos)

Abrindo o endereço no computador, a cena aparece na tela, útil para demonstrar ao orientador ou para
conferir algo rapidamente:

- arraste o mouse para olhar em volta;
- `Espaço` = próxima fase · `T` = turbulência · `0` = desliga turbulência · `C` = luz de cinto;
- um painel no canto mostra a fase e o nível de turbulência (o paciente nunca vê esse painel).

## Ajustes únicos no Quest

Os nomes dos menus podem variar um pouco conforme a versão do sistema do Quest.

1. **Desligar a troca automática entre mãos e controles.** Em *Configurações → Movimento / Rastreamento
   de mãos e corpo*, desative a opção de alternar automaticamente entre mãos e controles. Assim o óculos
   não passa a seguir as mãos do paciente.
2. **Limite estacionário.** Ao configurar o limite (guardian), escolha **Estacionário**, para a grade de
   segurança não aparecer com o paciente sentado.
3. **(Opcional) Ver o que o paciente vê.** No app **Meta Horizon** do celular, use **Transmitir** para
   espelhar a imagem do óculos no seu celular.

## Lista de verificação no Quest

Marque cada item no primeiro teste e me conte o que não funcionou ou incomodou:

- [ ] O endereço abre no navegador do Quest
- [ ] "Entrar no avião" entra na realidade virtual
- [ ] Clicar no direcional coloca a vista na poltrona da janela, olhando para a frente
- [ ] **A** avança a fase e o controle vibra o número da fase
- [ ] **B** muda a turbulência e o controle vibra conforme o nível
- [ ] O **botão lateral** desliga a turbulência com uma vibração longa
- [ ] Segurar o controle normalmente **não** aperta o botão lateral sem querer (a turbulência não desliga sozinha)
- [ ] O **gatilho** acende a luz de cinto com "ding"
- [ ] Os controles **não** aparecem na cena
- [ ] As 5 fases funcionam (portão, taxiamento, decolagem, cruzeiro, pouso)
- [ ] Os 3 níveis de turbulência são perceptíveis e diferentes entre si
- [ ] Há som em todas as fases (motores, "ding", trem de pouso, toque na pista)
- [ ] A turbulência leve não causa enjoo perceptível
- [ ] Os trancos da turbulência forte são intensos, mas toleráveis para o protocolo
- [ ] A imagem é fluida, sem travamentos

## Versões

Cada versão usada em pesquisa recebe uma etiqueta no GitHub (`v0.1`, `v0.2`, …), para poder ser citada
no artigo e reproduzida exatamente.

## Para desenvolvedores

- Página estática sem compilação; Three.js 0.186.1 copiado em `vendor/three/`.
- Testes de lógica: `npm test` (Node 22).
- Teste de fumaça no navegador, com fotos de cada fase: `node tests/smoke.cjs [pasta-das-fotos]`
  (precisa de Playwright e Python 3).
- `?acelerar=N` na URL acelera o tempo (só para testes).
- Especificação: `docs/superpowers/specs/2026-10-31-aviao-vr-design.md`.
