# Avião VR: plano de implementação do protótipo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página WebXR que abre no navegador do Meta Quest 3 com uma cabine de avião, 5 fases de voo,
turbulência em 3 níveis e aviso de cinto, controlada pela terapeuta com um controle do Quest.

**Architecture:** Página estática sem compilação (módulos ES + importmap). Lógica pura e testável em Node
(`flight.js`, `tremor.js`, `input.js`, `recentrar.js`) separada das partes que usam Three.js e APIs do
navegador (`cabin.js`, `outside.js`, `audio.js`, `main.js`). A cada quadro, `main.js` lê entradas,
aplica ações no voo, calcula os parâmetros e repassa para cabine, paisagem e som.

**Tech Stack:** Three.js 0.186.1 (cópia local), WebXR, Web Audio, Node 22 (`node --test`), Playwright
(já instalado globalmente; usar `require('playwright')` em arquivo `.cjs`).

**Spec:** `docs/superpowers/specs/2026-10-31-aviao-vr-design.md`

## Global Constraints

- Three.js **0.186.1**, copiado para `vendor/three/` (`three.module.js` e `three.core.js` de `build/`); nenhuma outra dependência em tempo de execução; sem etapa de compilação.
- `index.html` usa importmap: `"three": "./vendor/three/three.module.js"`.
- Módulos puros (`flight.js`, `tremor.js`, `input.js`, `recentrar.js`) não importam Three.js nem usam APIs do navegador.
- Todo texto visível em **português do Brasil**.
- O app não coleta, salva nem envia dados (sem localStorage, sem analytics, sem requisições além dos próprios arquivos).
- Modelos dos controles **nunca** são desenhados na cena.
- Limites do tremor da cabine: leve 0,5 cm / 0,2°, moderada 1,5 cm / 0,6°, forte 3 cm / 1,2°.
- Decolagem ~60 s e pouso ~75 s, automáticos; demais fases livres.
- Alvo: 72 quadros por segundo no Quest 3.
- Trabalho no ramo `prototipo`; `main` recebe o resultado no final (Tarefa 9).

## Review Focus

- Controle que reaparece (religado, acordado) com botão já apertado: não deve disparar ação. Teste na Tarefa 3.
- Quadro muito longo (paciente tira o óculos e a sessão pausa; travada do navegador): o voo não pula eventos nem os repete, e a fase automática termina certa. Teste com `dt` enorme na Tarefa 1; `main.js` limita `dt` a 0,1 s (Tarefa 5).
- Terapeuta aperta A no meio da decolagem ou do pouso: a fase avança na hora e os parâmetros saltam de forma coerente para a nova fase. Teste na Tarefa 1.
- Tecla ou botão segurado: dispara uma vez só (repetição do teclado ignorada). Testes na Tarefa 3.
- Recentralizar com o paciente olhando para trás ou com o óculos ligado em pé (cabeça a 1,7 m): a cabeça vai para o ponto dos olhos no assento, olhando para a frente. Teste na Tarefa 4.

---

### Task 1: Lógica do voo (`flight.js`)

**Files:**
- Create: `package.json`, `.gitignore`, `src/flight.js`
- Test: `tests/flight.test.js`

**Interfaces:**
- Produces:
  - `FASES = ['portao','taxi','decolagem','cruzeiro','pouso']`
  - `NOMES_FASES = ['Parado no portão','Taxiamento','Decolagem','Cruzeiro','Descida e pouso']`
  - `PERFIL` (constantes da tabela abaixo, ex. `PERFIL.pouso.distanciaToque === 6600`)
  - `criarVoo() -> Voo` com propriedades de leitura `fase`, `numeroFase` (1–5), `turbulencia` (0–3), `cinto` (bool) e métodos:
    `proximaFase() -> number`, `ciclarTurbulencia() -> number`, `desligarTurbulencia() -> 0`,
    `alternarCinto() -> boolean`, `atualizar(dt: number) -> Parametros`
  - `Parametros = { fase, numeroFase, velocidade (m/s), altitude (m), inclinacao (graus, + = nariz para cima), motor (0–1), noChao (bool), turbulencia (0–3, alvo), intensidadeTurbulencia (0–3, suavizada), tremor (0–3), cinto (bool), distanciaNaFase (m), odometro (m), eventos: string[] }`

Perfil (t = segundos na fase; entre os pontos, interpolação linear):

| Fase | velocidade | altitude | inclinação | motor | noChao | eventos |
|---|---|---|---|---|---|---|
| portao | 0 | 0 | 0 | 0.1 | sim | — |
| taxi | `min(8, 2·t)` | 0 | 0 | 0.3 | sim | — |
| decolagem (60 s) | 8 + 2,5·t até t=28 (78); depois 78→150 em t=28→60 | 0 até t=28; depois 0→700 em t=28→60 | 0→12 em t=26→29; 12 até t=50; 12→0 em t=50→60 | 0.3→1.0 em t=0→5; 1.0 até t=45; 1.0→0.6 em t=45→60 | t < 28 | `trem-recolhido` em t=36 |
| cruzeiro | 150 | 700 | 0 | 0.6 | não | — |
| pouso (75 s) | 150→70 em t=0→60; 70→0 em t=60→75; 0 depois | 700→0 em t=0→60 | 0→−3 em t=0→5; −3 até t=55; −3→4 em t=55→60; 4→0 em t=60→63 | 0.6→0.35 em t=0→5; 0.35 até t=60; 0.35→0.9 em t=60→61; 0.9 até t=69; 0.9→0.15 em t=69→72; 0.15 depois | t ≥ 60 | `trem-baixado` em t=30, `toque-na-pista` em t=60 |

- Decolagem: ao atingir t ≥ 60, muda para `cruzeiro` (tempo excedente vira tempo de cruzeiro). Pouso: fica em `pouso`, parado, para sempre.
- `proximaFase()` zera `tempoNaFase` e `distanciaNaFase`; após `pouso` volta a `portao`.
- Turbulência: alvo cicla 0→1→2→3→0. `intensidadeTurbulencia` anda até o alvo a 1 nível/s; quando o alvo é 0, anda a 10 níveis/s (zera em ≤ 0,3 s).
- `tremor = max(intensidadeTurbulencia, fase === 'taxi' ? 1 : 0)`.
- Eventos: cada um emitido uma única vez por passagem pela fase, inclusive quando um único `dt` grande cruza o instante.

- [ ] **Step 1: Criar `package.json`** com `{"name":"aviao-vr","private":true,"type":"module","scripts":{"test":"node --test tests/*.test.js"}}` e `.gitignore` com `node_modules/` e `tests/fotos/`.

- [ ] **Step 2: Escrever os testes que falham** em `tests/flight.test.js` (`node:test` + `node:assert/strict`):

```js
test('começa no portão parado', () => { const v = criarVoo(); const p = v.atualizar(0.016);
  assert.equal(v.fase, 'portao'); assert.equal(v.numeroFase, 1); assert.equal(v.turbulencia, 0);
  assert.equal(v.cinto, false); assert.equal(p.velocidade, 0); assert.equal(p.altitude, 0); assert.equal(p.noChao, true); });
test('A avança as 5 fases e volta ao portão', () => { const v = criarVoo();
  assert.deepEqual([1,2,3,4,5].map(() => v.proximaFase()), [2,3,4,5,1]); });
test('decolagem vira cruzeiro sozinha após 60 s', () => { const v = criarVoo(); v.proximaFase(); v.proximaFase();
  v.atualizar(30); const p = v.atualizar(30.01); assert.equal(p.fase, 'cruzeiro'); assert.equal(p.altitude, 700); });
test('decolagem: no chão aos 20 s, 12° aos 40 s, trem recolhido uma vez', () => { /* passos de 0,1 s por 60 s,
  acumula eventos */ assert.equal(p20.noChao, true); assert.equal(p40.inclinacao, 12);
  assert.equal(eventos.filter(e => e === 'trem-recolhido').length, 1); });
test('pouso: eventos em ordem e termina parado', () => { /* fase pouso, passos de 0,1 s por 80 s */
  assert.deepEqual(eventos, ['trem-baixado', 'toque-na-pista']); assert.equal(p.fase, 'pouso');
  assert.equal(p.velocidade, 0); assert.equal(p.altitude, 0); assert.equal(p.noChao, true); });
test('distância no pouso até o toque ≈ PERFIL.pouso.distanciaToque', () => { /* passos de 0,01 s até t=60 */
  assert.ok(Math.abs(p.distanciaNaFase - 6600) < 5); });
test('dt enorme na decolagem: cruzeiro e trem recolhido uma vez', () => { /* fase decolagem */ const p = v.atualizar(100);
  assert.equal(p.fase, 'cruzeiro'); assert.equal(p.eventos.filter(e => e === 'trem-recolhido').length, 1); });
test('A no meio da decolagem vai direto ao cruzeiro', () => { /* decolagem, atualizar(10) */ v.proximaFase();
  const p = v.atualizar(0.016); assert.equal(p.fase, 'cruzeiro'); assert.equal(p.altitude, 700); assert.equal(p.velocidade, 150); });
test('turbulência cicla 0→1→2→3→0 e desligar zera', () => { const v = criarVoo();
  assert.deepEqual([1,2,3,4].map(() => v.ciclarTurbulencia()), [1,2,3,0]);
  v.ciclarTurbulencia(); v.ciclarTurbulencia(); assert.equal(v.desligarTurbulencia(), 0); assert.equal(v.turbulencia, 0); });
test('intensidade sobe 1 nível/s e zera em até 0,3 s', () => { const v = criarVoo(); v.ciclarTurbulencia();
  assert.ok(Math.abs(v.atualizar(0.5).intensidadeTurbulencia - 0.5) < 1e-9);
  v.ciclarTurbulencia(); v.ciclarTurbulencia(); assert.equal(v.atualizar(3).intensidadeTurbulencia, 3);
  v.desligarTurbulencia(); assert.equal(v.atualizar(0.3).intensidadeTurbulencia, 0); });
test('taxiamento tem tremor 1 sem turbulência; portão tem 0', ...);
test('cinto alterna e aparece nos parâmetros', ...);
```

- [ ] **Step 3: Rodar e ver falhar.** Run: `npm test` — Expected: FAIL (`Cannot find module '../src/flight.js'`).
- [ ] **Step 4: Implementar `src/flight.js`** conforme a tabela. Para não perder eventos com `dt` grande: avançar o tempo e checar se cada instante de evento ficou em `(tAnterior, tNovo]`; para a virada decolagem→cruzeiro, emitir os eventos pendentes da decolagem antes de trocar. `distanciaNaFase` e `odometro` integram a velocidade (trapézio por quadro basta).
- [ ] **Step 5: Rodar e ver passar.** Run: `npm test` — Expected: todos PASS.
- [ ] **Step 6: Commit.** `git add -A && git commit -m "Lógica das fases do voo e turbulência"`

---

### Task 2: Tremor da turbulência (`tremor.js`)

**Files:**
- Create: `src/tremor.js`
- Test: `tests/tremor.test.js`

**Interfaces:**
- Produces:
  - `LIMITES_TREMOR = { posicao: [0, 0.005, 0.015, 0.03], rotacaoGraus: [0, 0.2, 0.6, 1.2] }` (índice = nível)
  - `limiteTremor(nivel: number) -> { posicao: number (m), rotacao: number (rad) }`, interpolação linear entre níveis inteiros, `nivel` limitado a [0, 3]
  - `calcularTremor(tempo: number, nivel: number) -> { x, y, rotX, rotZ }` (m e rad), determinístico

- [ ] **Step 1: Testes que falham:**

```js
test('nível 0 não mexe', () => { for (let t = 0; t < 30; t += 0.37) assert.deepEqual(calcularTremor(t, 0), { x: 0, y: 0, rotX: 0, rotZ: 0 }); });
test('nunca passa do limite em nenhum nível', () => { for (const n of [0.5, 1, 1.5, 2, 2.5, 3, 4]) { const L = limiteTremor(n);
  for (let t = 0; t < 120; t += 0.01) { const s = calcularTremor(t, n);
    assert.ok(Math.abs(s.x) <= L.posicao + 1e-9 && Math.abs(s.y) <= L.posicao + 1e-9);
    assert.ok(Math.abs(s.rotX) <= L.rotacao + 1e-9 && Math.abs(s.rotZ) <= L.rotacao + 1e-9); } } });
test('limite interpolado: nível 1,5 = 1 cm', () => assert.ok(Math.abs(limiteTremor(1.5).posicao - 0.010) < 1e-12));
test('nível 3 de fato se mexe (≥ 50% do limite em y)', () => { /* max |y| em 0..60 s */ assert.ok(maxY >= 0.015); });
test('determinístico', () => assert.deepEqual(calcularTremor(12.3, 2), calcularTremor(12.3, 2)));
```

- [ ] **Step 2: Rodar e ver falhar.** `npm test` — FAIL (módulo inexistente).
- [ ] **Step 3: Implementar.** Sinal normalizado em [−1, 1] = soma de senos de frequências incomensuráveis (2–7 Hz, fases diferentes por eixo) e, a partir do nível 2, "trancos": a cada intervalo pseudoaleatório de 4–7 s (derivado de `Math.floor(tempo / periodo)` com hash fixo), um pulso amortecido de ~0,4 s. Peso dos trancos cresce de 0 (nível ≤ 1) a 0,5 (nível 3); limitar o sinal a [−1, 1] e multiplicar pelo `limiteTremor(nivel)`.
- [ ] **Step 4: Rodar e ver passar.** `npm test` — PASS.
- [ ] **Step 5: Commit.** `git add src/tremor.js tests/tremor.test.js && git commit -m "Tremor da turbulência com limites"`

---

### Task 3: Controles e teclado (`input.js`)

**Files:**
- Create: `src/input.js`
- Test: `tests/input.test.js`

**Interfaces:**
- Produces:
  - `BOTOES = { GATILHO: 0, LATERAL: 1, DIRECIONAL: 3, A_X: 4, B_Y: 5 }` (layout padrão WebXR `xr-standard`)
  - `ACAO = { PROXIMA_FASE: 'proxima-fase', TURBULENCIA: 'turbulencia', DESLIGAR_TURBULENCIA: 'desligar-turbulencia', CINTO: 'cinto', RECENTRALIZAR: 'recentralizar' }`
  - `criarLeitorControles() -> { ler(controles: Array<{ mao: 'left'|'right', botoes: boolean[] }>) -> Array<{ acao: string, mao: string }> }`
  - `acaoDaTecla(evento: { code: string, repeat: boolean }) -> string | null`
  - `CURTO = { duracaoMs: 80, intensidade: 0.8 }`, `LONGO = { duracaoMs: 500, intensidade: 1 }`, `INTERVALO_MS = 150`
  - `padraoVibracao(acao: string, estado: { numeroFase: number, turbulencia: number }) -> Array<CURTO|LONGO>` (estado **depois** da ação)

- [ ] **Step 1: Testes que falham:**

```js
const solto = [false, false, false, false, false, false];
const com = i => solto.map((_, j) => j === i);
test('aperto de A dispara uma vez, segurar não repete', () => { const l = criarLeitorControles();
  l.ler([{ mao: 'right', botoes: solto }]);
  assert.deepEqual(l.ler([{ mao: 'right', botoes: com(4) }]), [{ acao: 'proxima-fase', mao: 'right' }]);
  assert.deepEqual(l.ler([{ mao: 'right', botoes: com(4) }]), []); });
test('mapeamento dos botões, nos dois controles', () => { /* para mao em ['left','right']:
  4→proxima-fase, 5→turbulencia, 1→desligar-turbulencia, 0→cinto, 3→recentralizar */ });
test('controle que aparece já com botão apertado não dispara', () => { const l = criarLeitorControles();
  assert.deepEqual(l.ler([{ mao: 'left', botoes: com(5) }]), []); });
test('controle que some e volta apertado não dispara', () => { const l = criarLeitorControles();
  l.ler([{ mao: 'left', botoes: solto }]); l.ler([]); assert.deepEqual(l.ler([{ mao: 'left', botoes: com(4) }]), []); });
test('controle com poucos botões não quebra', () => { const l = criarLeitorControles();
  l.ler([{ mao: 'right', botoes: [false, false] }]); assert.deepEqual(l.ler([{ mao: 'right', botoes: [true, false] }]), [{ acao: 'cinto', mao: 'right' }]); });
test('teclas', () => { assert.equal(acaoDaTecla({ code: 'Space', repeat: false }), 'proxima-fase');
  assert.equal(acaoDaTecla({ code: 'KeyT', repeat: false }), 'turbulencia');
  assert.equal(acaoDaTecla({ code: 'Digit0', repeat: false }), 'desligar-turbulencia');
  assert.equal(acaoDaTecla({ code: 'Numpad0', repeat: false }), 'desligar-turbulencia');
  assert.equal(acaoDaTecla({ code: 'KeyC', repeat: false }), 'cinto');
  assert.equal(acaoDaTecla({ code: 'Space', repeat: true }), null); assert.equal(acaoDaTecla({ code: 'KeyX', repeat: false }), null); });
test('vibrações', () => { assert.deepEqual(padraoVibracao('proxima-fase', { numeroFase: 3, turbulencia: 0 }), [CURTO, CURTO, CURTO]);
  assert.deepEqual(padraoVibracao('turbulencia', { numeroFase: 1, turbulencia: 2 }), [CURTO, CURTO]);
  assert.deepEqual(padraoVibracao('turbulencia', { numeroFase: 1, turbulencia: 0 }), [LONGO]);
  assert.deepEqual(padraoVibracao('desligar-turbulencia', { numeroFase: 1, turbulencia: 0 }), [LONGO]);
  assert.deepEqual(padraoVibracao('cinto', { numeroFase: 1, turbulencia: 0 }), [CURTO]);
  assert.deepEqual(padraoVibracao('recentralizar', { numeroFase: 1, turbulencia: 0 }), [CURTO]); });
```

- [ ] **Step 2: Rodar e ver falhar.** `npm test` — FAIL.
- [ ] **Step 3: Implementar** guardando o último estado por `mao` num `Map`; controle ausente na leitura é removido do mapa; controle novo só registra estado.
- [ ] **Step 4: Rodar e ver passar.** `npm test` — PASS.
- [ ] **Step 5: Commit.** `git add src/input.js tests/input.test.js && git commit -m "Leitura de controles, teclado e padrões de vibração"`

---

### Task 4: Recentralizar (`recentrar.js`)

**Files:**
- Create: `src/recentrar.js`
- Test: `tests/recentrar.test.js`

**Interfaces:**
- Produces: `calcularRecentralizacao(cabeca: {x,y,z}, yawCabeca: number (rad), olhos: {x,y,z}) -> { posicao: {x,y,z}, rotacaoY: number (rad) }`
  — transformação do suporte (rig) tal que `Ry(rotacaoY)·cabeca + posicao = olhos` e `yawCabeca + rotacaoY ≡ 0`. Convenção Three.js para `Ry`: `x' = x·cosθ + z·sinθ`, `z' = −x·sinθ + z·cosθ`.

- [ ] **Step 1: Testes que falham** (helper `aplicar(r, p)` no próprio teste com a convenção acima; tolerância 1e-9):
  - yaw 0, cabeça `(0, 1.6, 0)`, olhos `(-1.4, 1.15, 0)` → `aplicar` = olhos e `rotacaoY` = 0;
  - yaw π/2, cabeça `(0.3, 1.2, -0.5)` → `aplicar` = olhos e `rotacaoY` ≈ −π/2;
  - yaw π (olhando para trás), cabeça em pé `(0.2, 1.7, 0.4)` → `aplicar` = olhos e `cos(yaw + rotacaoY)` ≈ 1.
- [ ] **Step 2: Rodar e ver falhar.** `npm test` — FAIL.
- [ ] **Step 3: Implementar** (`rotacaoY = −yaw`; `posicao = olhos − Ry(rotacaoY)·cabeca`).
- [ ] **Step 4: Rodar e ver passar.** `npm test` — PASS.
- [ ] **Step 5: Commit.** `git add src/recentrar.js tests/recentrar.test.js && git commit -m "Cálculo de recentralização"`

---

### Task 5: Página, cabine e modo notebook

**Files:**
- Create: `index.html`, `src/main.js`, `src/cabin.js`, `vendor/three/three.module.js`, `vendor/three/three.core.js`, `.nojekyll`
- Test: `tests/smoke.cjs`

**Interfaces:**
- Consumes: `criarVoo`, `NOMES_FASES` (T1); `calcularTremor` (T2); `acaoDaTecla` (T3).
- Produces:
  - `criarCabine() -> { grupo: THREE.Group, olhos: THREE.Vector3, definirCinto(ligado: boolean): void, atualizar(tremor: {x,y,rotX,rotZ}): void }`
  - `main.js` função `aplicarAcao(acao: string) -> void` (usada por teclado agora e controles na T8)
  - DOM: `#inicio` (tela inicial), `#entrar` (botão "Entrar no avião"), `#painel` (modo notebook), `#aviso`
  - Parâmetro de URL `?acelerar=N` (1–20, padrão 1) multiplica o tempo — só para testes e demonstração

Cabine (coordenadas: x direita, y cima, −z frente, piso em y = 0; corredor centrado em x = 0):
- `olhos = (-1.4, 1.15, 0)`; parede curva/alta com raio interno ~1,9 m; janelas 0,28 × 0,38 m com cantos arredondados (buracos na parede), uma por fileira a cada 0,8 m, centro em y = 1,15; janela do paciente em z ≈ −0,1.
- Poltronas 3 + 3 (esquerda x ≈ −1,45 / −0,95 / −0,45; direita espelhada), fileiras a cada 0,8 m: 8 à frente, 3 atrás, mais a do próprio paciente; usar `InstancedMesh`.
- Bagageiros dos dois lados (y ≈ 1,85–2,15), teto, piso com carpete do corredor, mesinha fechada no encosto da frente.
- Painel de cinto acima e um pouco à frente do paciente (≈ `(-1.2, 1.95, -0.35)`), com ícone de cinto desenhado em `CanvasTexture`; `definirCinto(true)` liga emissão (âmbar).
- `atualizar(tremor)`: posição base + `(x, y, 0)`, rotações `rotX`, `rotZ`.

`main.js` (nesta tarefa, só modo notebook):
- Cena, `WebGLRenderer` (antialias, `xr.enabled = true`), `rig` (Group) contendo a câmera; no modo notebook a câmera fica em `olhos` e o mouse arrastando gira yaw/pitch (pitch limitado a ±80°).
- Laço via `renderer.setAnimationLoop`: `dt = min(delta, 0.1) * acelerar` → `voo.atualizar(dt)` → `cabine.atualizar(calcularTremor(tempo, p.tremor))` → render.
- Teclado: `keydown` → `acaoDaTecla` → `aplicarAcao`. `aplicarAcao`: `proxima-fase`→`voo.proximaFase()`, `turbulencia`→`voo.ciclarTurbulencia()`, `desligar-turbulencia`→`voo.desligarTurbulencia()`, `cinto`→`voo.alternarCinto()` + `cabine.definirCinto`, `recentralizar`→(T8).
- `#painel` exato: três linhas `Fase N – <NOMES_FASES>`, `Turbulência: desligada|leve|moderada|forte`, `Cinto: ligado|desligado`.
- Botão `#entrar`: nesta tarefa sempre inicia o modo notebook: esconde `#inicio`, mostra `#painel` e mostra `#aviso` com `RV indisponível neste aparelho`.

- [ ] **Step 1: Copiar Three.js:** `npm pack three@0.186.1` num diretório temporário, extrair `package/build/three.module.js` e `package/build/three.core.js` para `vendor/three/`. Verificar: `head -c 300 vendor/three/three.module.js` mostra o cabeçalho `three.js` e `grep -c "REVISION = '186'" vendor/three/three.core.js` ≥ 1.
- [ ] **Step 2: Escrever o teste de fumaça `tests/smoke.cjs`** (Node, `require('playwright')`): sobe `python3 -m http.server 8123` na raiz do projeto, abre `http://localhost:8123/?acelerar=10` no Chromium (args `--use-angle=swiftshader`, `--enable-unsafe-swiftshader`, `--autoplay-policy=no-user-gesture-required`), registra erros (`pageerror` e `console` tipo `error`), clica em `#entrar` e verifica:
  - `#painel` contém `Fase 1 – Parado no portão`, `Turbulência: desligada`, `Cinto: desligado`;
  - `#aviso` contém `RV indisponível neste aparelho`;
  - `Space` → `Fase 2 – Taxiamento`; `KeyT` → `Turbulência: leve`; `Digit0` → `Turbulência: desligada`; `KeyC` → `Cinto: ligado`;
  - zero erros; salva `cabine.png` no diretório passado como 1º argumento (padrão `tests/fotos/`).
  Termina com código 1 e mensagem clara em qualquer falha; sempre encerra o servidor.
- [ ] **Step 3: Rodar e ver falhar.** `node tests/smoke.cjs` — FAIL (página inexistente).
- [ ] **Step 4: Implementar** `index.html` (importmap, estilos inline, `#inicio` com título "Avião VR" e botão, `#painel`, `#aviso`), `src/cabin.js`, `src/main.js`, `.nojekyll` vazio.
- [ ] **Step 5: Rodar e ver passar.** `node tests/smoke.cjs <scratchpad>/fotos && npm test` — PASS. Abrir `cabine.png` e conferir: janela à esquerda, poltronas à frente, corredor à direita, bagageiros, painel de cinto aceso.
- [ ] **Step 6: Commit.** `git add -A && git commit -m "Página, cabine e modo notebook"`

---

### Task 6: Paisagem externa (`outside.js`)

**Files:**
- Create: `src/outside.js`
- Modify: `src/main.js` (criar e atualizar a paisagem), `tests/smoke.cjs` (fotos por fase)

**Interfaces:**
- Consumes: `Parametros`, `PERFIL` (T1); `calcularTremor` (T2).
- Produces: `criarPaisagem(cena: THREE.Scene) -> { grupo: THREE.Group, atualizar(p: Parametros, tempo: number): void }` e `NUVENS = { base: 400, topo: 550 }`.

Regras:
- Avião e cabine fixos na origem; o `grupo` da paisagem se move: `position.y = −(p.altitude + 3.5) + bob`, rotação em x = `−p.inclinacao` (graus→rad) em torno do ponto dos olhos; `bob = calcularTremor(tempo, p.tremor).y × 100` (alguns metros).
- Céu: esfera grande com gradiente (azul em cima, claro no horizonte), acompanha a inclinação mas não a translação; sol como disco/brilho; neblina (`scene.fog`) na cor do horizonte.
- Chão: plano grande que acompanha o avião, textura de grama/asfalto em `CanvasTexture` com `repeat`; deslocamento da textura = `p.odometro` (chão infinito).
- Terminal (caixas com janelas) à esquerda, visível no `portao` e afastando-se no `taxi`.
- Pista 3 km × 45 m com faixas centrais e de borda: na `decolagem`, cabeceira 100 m atrás do avião no início da fase (posição relativa = `−(distanciaNaFase + 100)`); no `pouso`, cabeceira em `PERFIL.pouso.distanciaToque − 300` de `distanciaNaFase`; invisível em `portao`, `taxi` e `cruzeiro`.
- Nuvens: `InstancedMesh` de esferas achatadas brancas entre `NUVENS.base` e `NUVENS.topo`, numa área 6 × 6 km que se repete (posição módulo área) conforme `odometro`; quando a altitude está dentro da faixa, a neblina fica densa e branca (atravessar a nuvem).

- [ ] **Step 1: Ampliar `tests/smoke.cjs`:** após os testes de painel, `Space` até chegar a cada fase e salvar fotos: `portao.png`, `taxi.png` (após 1 s), `decolagem-chao.png` (≈1,5 s real = 15 s de voo), `decolagem-subida.png` (≈4 s real), `cruzeiro.png`, `pouso-aproximacao.png` (≈5 s real), `pouso-parado.png` (≈8 s real). Verifica que o painel mostra `Fase 4 – Cruzeiro` sozinho após a decolagem.
- [ ] **Step 2: Rodar e ver falhar.** `node tests/smoke.cjs <scratchpad>/fotos` — FAIL na verificação do cruzeiro **ou** fotos sem paisagem (verificar visualmente: janela vazia).
- [ ] **Step 3: Implementar `src/outside.js`** e ligar em `main.js`.
- [ ] **Step 4: Rodar e ver passar** e **conferir as 7 fotos**: terminal pela janela no portão; pista passando na decolagem; chão afastando e inclinado na subida; nuvens abaixo no cruzeiro; pista se aproximando no pouso.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "Paisagem externa: céu, chão, pista, terminal e nuvens"`

---

### Task 7: Som (`audio.js`)

**Files:**
- Create: `src/audio.js`
- Modify: `src/main.js`, `tests/smoke.cjs`

**Interfaces:**
- Consumes: `Parametros` (T1).
- Produces: `criarAudio() -> { iniciar(): Promise<void>, atualizar(p: Parametros): void, tocar(som: 'ding'|'trem-recolhido'|'trem-baixado'|'toque-na-pista'): void, readonly estado: string }` (`estado` = estado do `AudioContext` ou `'parado'` antes de iniciar).

Sons (Web Audio, sem arquivos; mudanças com `setTargetAtTime`, constante ~0,3 s):
- Ruído de cabine: ruído marrom em loop → passa-baixa 300–1200 Hz conforme `motor` → ganho cresce com `motor`.
- Motor: 2 osciladores dente-de-serra 60–140 Hz conforme `motor` → passa-baixa; assobio senoidal 1800–3200 Hz bem baixo.
- Rodagem: ruído → passa-baixa 120 Hz, ganho ∝ `velocidade` quando `noChao`.
- Turbulência: chacoalhos (rajadas curtas de ruído em passa-banda 2–4 kHz) e trancos (seno ~50 Hz decaindo) em intervalos aleatórios, com taxa e volume ∝ `tremor`.
- `ding`: dois tons senoidais com decaimento (agudo → grave, ~1,2 s); `trem-*`: baque grave + chacoalho; `toque-na-pista`: baque mais forte + ronco curto.
- `main.js`: `iniciar()` no clique de `#entrar` (antes de qualquer outra coisa); `tocar('ding')` em toda ação `cinto`; `tocar(e)` para cada `p.eventos`; `atualizar(p)` por quadro; `visibilitychange`/clique retoma contexto suspenso; expor `window.aviaoDebug = { audio }` só para o teste.

- [ ] **Step 1: Ampliar o smoke:** após clicar em `#entrar`, `await page.evaluate(() => window.aviaoDebug.audio.estado)` deve ser `'running'`; e nenhum erro ao percorrer as fases.
- [ ] **Step 2: Rodar e ver falhar.** `node tests/smoke.cjs <scratchpad>/fotos` — FAIL (`aviaoDebug` indefinido).
- [ ] **Step 3: Implementar** `src/audio.js` e ligar em `main.js`.
- [ ] **Step 4: Rodar e ver passar.** `node tests/smoke.cjs <scratchpad>/fotos && npm test` — PASS.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "Sons sintetizados da cabine, motores e turbulência"`

---

### Task 8: Realidade virtual e controles do Quest

**Files:**
- Modify: `src/main.js`, `index.html` (texto do botão/aviso), `tests/smoke.cjs`

**Interfaces:**
- Consumes: `criarLeitorControles`, `padraoVibracao`, `CURTO`, `LONGO`, `INTERVALO_MS` (T3); `calcularRecentralizacao` (T4); `cabine.olhos` (T5); `aplicarAcao` (T5).

Comportamento:
- Clique em `#entrar`: `await audio.iniciar()`; se `navigator.xr?.isSessionSupported('immersive-vr')` for verdadeiro → `requestSession('immersive-vr')`, `renderer.xr.setReferenceSpaceType('local')`, `renderer.xr.setFoveation(1)`, `renderer.xr.setSession(session)`, esconder `#inicio`; senão → modo notebook (T5).
- Por quadro em RV: montar `[{ mao: fonte.handedness, botoes: fonte.gamepad.buttons.map(b => b.pressed) }]` das `session.inputSources` com `gamepad` → `leitor.ler(...)` → para cada `{acao, mao}`: `aplicarAcao(acao)` e vibrar **o controle que apertou** com `padraoVibracao(acao, estadoDepois)`, pulso i agendado em `i × (duração anterior + INTERVALO_MS)`, via `gamepad.hapticActuators?.[0]?.pulse(intensidade, duracaoMs)` com alternativa `gamepad.vibrationActuator?.playEffect('dual-rumble', { duration, strongMagnitude: intensidade })`.
- `recentralizar`: ler `camera.position` e yaw de `camera.quaternion` (Euler ordem `'YXZ'`), aplicar `calcularRecentralizacao(..., cabine.olhos)` em `rig.position` e `rig.rotation.y`. Automático uma vez no 10º quadro após `sessionstart`.
- `sessionend`: mostrar `#inicio` de novo; o voo continua no estado em que estava.
- Não usar `XRControllerModelFactory` nem desenhar nada para os controles.

- [ ] **Step 1: Ampliar o smoke:** confirmar que no Chromium sem óculos o clique continua levando ao modo notebook com o aviso (caminho `isSessionSupported` falso) e sem erros.
- [ ] **Step 2: Implementar** o comportamento acima em `main.js`.
- [ ] **Step 3: Rodar.** `node tests/smoke.cjs <scratchpad>/fotos && npm test` — PASS. (O caminho RV só é verificável no Quest; fica na lista de verificação da Tarefa 9.)
- [ ] **Step 4: Commit.** `git add -A && git commit -m "Sessão de RV, controles, vibração e recentralização"`

---

### Task 9: README e publicação

**Files:**
- Create: `README.md`

**Conteúdo do README (português, para a pesquisadora, sem jargão):**
1. O que é (2 linhas) e endereço: `https://julianaqfeliciano-hash.github.io/aviao-vr/`.
2. Como usar numa sessão (fluxo da seção 4 da especificação).
3. Tabela de botões (seção 4 da especificação) + teclas do modo notebook.
4. Ajustes únicos no Quest: desligar a troca automática entre mãos e controles; limite estacionário; transmitir para o celular pelo app Meta Horizon (avisar que os nomes dos menus podem variar com a versão do sistema).
5. Lista de verificação no Quest: abre o endereço; "Entrar no avião" entra em RV; recentralizar coloca na poltrona olhando para a frente; A avança e vibra N vezes; B cicla turbulência e vibra; botão lateral desliga e vibra longo; gatilho acende a luz com "ding"; controles não aparecem na cena; as 5 fases; os 3 níveis; som em todas as fases; sem enjoo perceptível na turbulência leve; quadro fluido.
6. Versões: cada versão usada em pesquisa recebe uma etiqueta (`v0.1`, …).
7. Para desenvolvedores: `npm test` e `node tests/smoke.cjs`.

- [ ] **Step 1: Escrever `README.md`.**
- [ ] **Step 2: Verificação final:** `npm test && node tests/smoke.cjs <scratchpad>/fotos` — PASS; revisar as fotos.
- [ ] **Step 3: Commit e push do ramo:** `git add -A && git commit -m "README com uso e checklist do Quest" && git push -u origin prototipo`.
- [ ] **Step 4: Levar para `main` e publicar** (com o ok da pesquisadora, seguindo superpowers:finishing-a-development-branch): `main` recebe `prototipo`; ativar GitHub Pages (Settings → Pages → Deploy from a branch → `main` / root) — pela API se a credencial permitir, senão a pesquisadora faz o clique; conferir que o endereço responde 200.
- [ ] **Step 5:** A etiqueta `v0.1` é criada **só depois** do teste da pesquisadora no Quest.
