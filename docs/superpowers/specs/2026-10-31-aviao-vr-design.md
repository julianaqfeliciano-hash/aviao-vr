# Avião VR: especificação do protótipo

Data: 31/10/2026
Status: aguardando revisão

## 1. Objetivo

Protótipo de cena de avião em realidade virtual para **terapia de exposição em fobia de voar**,
usado em **pesquisa acadêmica**. Roda no **Meta Quest 3**, no navegador do próprio óculos (WebXR),
sem passar pela Meta Store.

Princípio do protótipo: **o mais simples possível**. Otimizações e melhorias de realismo vêm
depois dos testes no óculos.

**Critério de sucesso:** a cena gera presença suficiente para ativar a ansiedade (SUDS sobe) de forma
controlável, e a terapeuta consegue avançar, intensificar e reduzir os estímulos na hora, sem atraso,
usando um controle do Quest.

## 2. Como é usado

- O paciente fica **sentado** no consultório, usando só o óculos.
- A terapeuta segura **um** controle do Quest (qualquer um dos dois) e conduz a sessão.
- O app **não registra nada**: SUDS e tempos são anotados pela terapeuta em papel ou planilha.
- Nenhum dado de paciente é coletado, salvo ou enviado.
- Interface e textos em português.

## 3. Experiência do paciente

### Posição e cena
- Poltrona da janela (lado esquerdo), no meio de uma cabine **vazia** (sem outros passageiros).
- Visíveis: poltronas à frente, corredor à direita, compartimentos de bagagem, luz de "apertar cintos"
  acima da cabeça e janela à esquerda com a paisagem externa.
- Visual 3D simplificado (aparência de maquete), gerado por código.

### Fases do voo

A terapeuta avança uma fase por vez. Fases com duração "livre" ficam ativas até ela avançar.

| # | Fase | Duração | O que acontece |
|---|---|---|---|
| 1 | Parado no portão | livre | Avião parado. Ruído baixo de cabine (ar-condicionado). Pela janela: pátio, prédio do terminal |
| 2 | Taxiamento | livre | Motores em marcha lenta, avião andando devagar, pequenos balanços contínuos |
| 3 | Decolagem | ~60 s, automática | Motores aceleram até ronco forte, pista passa cada vez mais rápido, avião inclina para cima e sobe, som do trem de pouso recolhendo, atravessa as nuvens. Ao terminar, passa sozinha para a fase 4 |
| 4 | Cruzeiro | livre | Acima das nuvens, ruído constante |
| 5 | Descida e pouso | ~75 s, automática | Motores reduzem, atravessa as nuvens, som do trem de pouso descendo, pista se aproxima, solavanco do toque, freada com ronco dos reversores. Termina com o avião parado na pista |

Ao avançar depois do pouso, a cena volta para a fase 1 (recomeça).

### Extras (acionados a qualquer momento)
- **Turbulência em 3 níveis** (leve, moderada, forte): a cabine treme levemente, a paisagem balança mais
  e há sons de coisas chacoalhando e trancos. Os movimentos da cabine têm limite máximo para reduzir enjoo
  (ver seção 6).
- **Aviso de cinto**: liga ou desliga a luz de "apertar cintos", com um "ding" a cada mudança.

### Conforto
- Na decolagem e no pouso a **cabine fica parada em relação ao paciente**; quem inclina é a paisagem
  vista pela janela (como num avião real).
- Sem movimento brusco da cabine fora da turbulência.

### Fora do escopo do protótipo
- Voz do piloto (no futuro: gravações feitas pela terapeuta).
- Sons gravados (no protótipo os sons são sintetizados pelo próprio app).
- Outros passageiros, comissários, modelo 3D realista.
- Funcionamento sem internet, registro de dados, tela de controle separada.

## 4. Controles

Os dois controles funcionam igual (X = A, Y = B), para destros e canhotos.
Cada comando é disparado no **momento em que o botão é apertado** (segurar não repete).

| Botão | Ação | Confirmação por vibração no controle |
|---|---|---|
| A / X | Próxima fase (após o pouso, volta à fase 1) | N vibrações curtas = fase N |
| B / Y | Turbulência: desligada → leve → moderada → forte → desligada | 1, 2 ou 3 vibrações curtas conforme o nível; 1 vibração longa ao desligar |
| Botão lateral (grip) | Desliga a turbulência imediatamente | 1 vibração longa |
| Gatilho | Liga/desliga a luz de cinto + "ding" | 1 vibração curta |
| Clique no direcional | Recentralizar: põe a cabeça do paciente na posição do assento, olhando para a frente | 1 vibração curta |

A ação "desligar turbulência" (botão lateral) também confirma com vibração longa mesmo se a turbulência
já estava desligada, para a terapeuta ter certeza do estado.

### Modo notebook (sem óculos)
A mesma página abre na tela do computador, com:
- mouse arrastando para olhar em volta;
- teclado: `Espaço` = próxima fase, `T` = turbulência (cicla níveis), `0` = desliga turbulência,
  `C` = luz de cinto + ding;
- um pequeno painel no canto mostrando fase atual e nível de turbulência (só no modo notebook; o
  paciente nunca vê esse painel).

### Fluxo da sessão
1. Abrir o endereço do app no navegador do Quest.
2. Tocar em **"Entrar no avião"** (inicia o som e a RV; começa na fase 1).
3. Colocar o óculos no paciente sentado e clicar no direcional para recentralizar.
4. Conduzir com A, B, botão lateral e gatilho.
5. Para encerrar ou interromper: retirar o óculos do paciente.

Ao entrar no modo RV o app recentraliza uma vez automaticamente.

## 5. Arquitetura

Página web estática, sem etapa de compilação, usando módulos JavaScript nativos.
Biblioteca 3D: **Three.js 0.186.1**, com cópia local no repositório (versão congelada, sem depender de CDN).

```
aviao-vr/
  index.html          página, tela inicial com botão "Entrar no avião", painel do modo notebook
  src/main.js         inicialização, laço de renderização, sessão WebXR, liga as partes
  src/flight.js       lógica pura das fases e extras (sem Three.js, sem navegador)
  src/input.js        controle do Quest e teclado → ações; padrões de vibração (lógica pura)
  src/cabin.js        constrói a cabine, luz de cinto, aplica tremor da turbulência
  src/outside.js      céu, chão, pista, terminal, nuvens; posiciona conforme o estado do voo
  src/audio.js        sons sintetizados (Web Audio)
  vendor/three/       cópia do Three.js
  tests/              testes automáticos
  README.md           como usar + ajustes do Quest
```

### Responsabilidades e interfaces
- **flight.js**: guarda o estado (fase, tempo na fase, turbulência 0–3, luz de cinto) e, a cada quadro,
  calcula os parâmetros do voo: velocidade, altitude, inclinação, potência do motor, se está no chão e
  eventos pontuais (`trem-recolhido`, `trem-baixado`, `toque-na-pista`). Expõe funções:
  `criarVoo()`, `proximaFase()`, `ciclarTurbulencia()`, `desligarTurbulencia()`, `alternarCinto()`,
  `atualizar(dt)`. Não sabe nada de gráficos ou som.
- **input.js**: recebe o estado dos botões dos controles (formato padrão WebXR: 0 gatilho, 1 lateral,
  3 clique do direcional, 4 A/X, 5 B/Y) e do teclado, detecta o momento do aperto e devolve ações
  (`proxima-fase`, `turbulencia`, `desligar-turbulencia`, `cinto`, `recentralizar`). Também devolve
  o padrão de vibração de cada ação.
- **cabin.js / outside.js / audio.js**: só leem os parâmetros calculados por `flight.js` e os eventos;
  não alteram o estado.
- **main.js**: a cada quadro: lê entradas → aplica ações em `flight` → `atualizar(dt)` → passa
  parâmetros para cabine, paisagem e som → renderiza. Dispara vibrações.

## 6. Detalhes técnicos

- **WebXR**: sessão `immersive-vr` com espaço de referência `local` (sentado). A câmera fica dentro de
  um "suporte" (rig); recentralizar = mover e girar o suporte para que a cabeça atual coincida com o
  ponto dos olhos no assento, olhando para a frente (apenas giro horizontal).
- **Movimento**: a cabine e o paciente ficam fixos na origem; a paisagem externa se move e inclina ao
  redor. O chão usa textura que desliza (efeito de chão infinito); as nuvens se repetem em faixa.
- **Turbulência**: tremor suave (soma de ondas) com trancos ocasionais nos níveis 2 e 3.
  Limites máximos do deslocamento da cabine em relação ao paciente:
  leve 0,5 cm / 0,2°, moderada 1,5 cm / 0,6°, forte 3 cm / 1,2°.
  A paisagem externa balança com amplitude maior (alguns metros de altitude).
  Mudanças de nível são suavizadas (~1 s), exceto "desligar", que zera em ~0,3 s.
- **Taxiamento**: balanço contínuo de amplitude igual à turbulência leve.
- **Som** (Web Audio, sem arquivos): ruído de cabine (ruído filtrado conforme potência), tom dos
  motores (osciladores graves + assobio agudo discreto), ronco de rodagem no chão, chacoalhos e trancos
  da turbulência, "ding" de dois tons, baque do trem de pouso, baque do toque na pista. O som só pode
  começar após um toque do usuário, por isso inicia no botão "Entrar no avião".
- **Desempenho**: alvo de 72 quadros por segundo no Quest 3; geometria simples, poltronas e nuvens
  instanciadas, poucos materiais.
- **Controle invisível**: os modelos dos controles **não** são desenhados na cena.

### Erros e situações previstas
- Navegador sem WebXR (ex.: notebook): abre no modo notebook com aviso discreto "RV indisponível neste
  aparelho".
- Controle desconectado ou sem bateria: a cena continua rodando no estado atual; nada quebra.
- Som bloqueado pelo navegador: retomado no próximo toque/botão.

## 7. Hospedagem e versões

- Repositório **público** no GitHub da pesquisadora; publicação pelo **GitHub Pages** (endereço https).
- Nenhum dado de paciente no repositório.
- Cada versão usada em pesquisa recebe uma etiqueta (tag) no Git, ex. `v0.1`, para ser citada e
  reproduzida.

## 8. Testes

- **Automáticos (Node, `node --test`)**:
  - `flight.js`: ordem das fases e volta à fase 1; decolagem passa sozinha ao cruzeiro após a duração;
    pouso termina parado; ciclo e desligamento da turbulência; luz de cinto; eventos emitidos uma única
    vez.
  - `input.js`: aperto dispara ação uma vez (segurar não repete); mapeamento de cada botão nos dois
    controles; teclas; padrões de vibração.
- **Página no navegador (Playwright, aqui na nuvem)**: carrega sem erros no console; percorre todas as
  fases pelo teclado; fotos de cada fase para revisão visual.
- **No Quest 3 (pela pesquisadora)**: lista de verificação no README: entrar na RV, recentralizar,
  cada botão e sua vibração, as 5 fases, os 3 níveis de turbulência, som, conforto.

## 9. Ajustes únicos no Quest (documentados no README)

- Desligar a troca automática entre mãos e controles.
- Usar limite estacionário.
- (Opcional) Transmitir a visão para o celular pelo app Meta Horizon.
