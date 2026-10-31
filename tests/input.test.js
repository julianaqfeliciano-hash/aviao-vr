import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOTOES,
  ACAO,
  criarLeitorControles,
  acaoDaTecla,
  padraoVibracao,
  CURTO,
  LONGO,
  INTERVALO_MS,
} from '../src/input.js';

const solto = [false, false, false, false, false, false];
const com = (i) => solto.map((_, j) => j === i);

test('constantes', () => {
  assert.deepEqual(BOTOES, { GATILHO: 0, LATERAL: 1, DIRECIONAL: 3, A_X: 4, B_Y: 5 });
  assert.deepEqual(ACAO, {
    PROXIMA_FASE: 'proxima-fase',
    TURBULENCIA: 'turbulencia',
    DESLIGAR_TURBULENCIA: 'desligar-turbulencia',
    CINTO: 'cinto',
    RECENTRALIZAR: 'recentralizar',
  });
  assert.deepEqual(CURTO, { duracaoMs: 80, intensidade: 0.8 });
  assert.deepEqual(LONGO, { duracaoMs: 500, intensidade: 1 });
  assert.equal(INTERVALO_MS, 150);
});

test('aperto de A dispara uma vez, segurar não repete', () => {
  const l = criarLeitorControles();
  l.ler([{ mao: 'right', botoes: solto }]);
  assert.deepEqual(l.ler([{ mao: 'right', botoes: com(4) }]), [{ acao: 'proxima-fase', mao: 'right' }]);
  assert.deepEqual(l.ler([{ mao: 'right', botoes: com(4) }]), []);
  l.ler([{ mao: 'right', botoes: solto }]);
  assert.deepEqual(l.ler([{ mao: 'right', botoes: com(4) }]), [{ acao: 'proxima-fase', mao: 'right' }]);
});

test('mapeamento dos botões, nos dois controles', () => {
  const esperado = { 4: 'proxima-fase', 5: 'turbulencia', 1: 'desligar-turbulencia', 0: 'cinto', 3: 'recentralizar' };
  for (const mao of ['left', 'right']) {
    for (const [indice, acao] of Object.entries(esperado)) {
      const l = criarLeitorControles();
      l.ler([{ mao, botoes: solto }]);
      assert.deepEqual(l.ler([{ mao, botoes: com(Number(indice)) }]), [{ acao, mao }], `${mao} ${indice}`);
    }
  }
});

test('botão 2 (sem função) não dispara nada', () => {
  const l = criarLeitorControles();
  l.ler([{ mao: 'right', botoes: solto }]);
  assert.deepEqual(l.ler([{ mao: 'right', botoes: com(2) }]), []);
});

test('dois controles no mesmo quadro', () => {
  const l = criarLeitorControles();
  l.ler([
    { mao: 'left', botoes: solto },
    { mao: 'right', botoes: solto },
  ]);
  assert.deepEqual(
    l.ler([
      { mao: 'left', botoes: com(5) },
      { mao: 'right', botoes: com(0) },
    ]),
    [
      { acao: 'turbulencia', mao: 'left' },
      { acao: 'cinto', mao: 'right' },
    ],
  );
});

test('controle que aparece já com botão apertado não dispara', () => {
  const l = criarLeitorControles();
  assert.deepEqual(l.ler([{ mao: 'left', botoes: com(5) }]), []);
});

test('controle que some e volta apertado não dispara', () => {
  const l = criarLeitorControles();
  l.ler([{ mao: 'left', botoes: solto }]);
  l.ler([]);
  assert.deepEqual(l.ler([{ mao: 'left', botoes: com(4) }]), []);
});

test('controle com poucos botões não quebra', () => {
  const l = criarLeitorControles();
  l.ler([{ mao: 'right', botoes: [false, false] }]);
  assert.deepEqual(l.ler([{ mao: 'right', botoes: [true, false] }]), [{ acao: 'cinto', mao: 'right' }]);
});

test('teclas', () => {
  assert.equal(acaoDaTecla({ code: 'Space', repeat: false }), 'proxima-fase');
  assert.equal(acaoDaTecla({ code: 'KeyT', repeat: false }), 'turbulencia');
  assert.equal(acaoDaTecla({ code: 'Digit0', repeat: false }), 'desligar-turbulencia');
  assert.equal(acaoDaTecla({ code: 'Numpad0', repeat: false }), 'desligar-turbulencia');
  assert.equal(acaoDaTecla({ code: 'KeyC', repeat: false }), 'cinto');
  assert.equal(acaoDaTecla({ code: 'Space', repeat: true }), null);
  assert.equal(acaoDaTecla({ code: 'KeyX', repeat: false }), null);
});

test('vibrações', () => {
  assert.deepEqual(padraoVibracao('proxima-fase', { numeroFase: 3, turbulencia: 0 }), [CURTO, CURTO, CURTO]);
  assert.deepEqual(padraoVibracao('proxima-fase', { numeroFase: 1, turbulencia: 0 }), [CURTO]);
  assert.deepEqual(padraoVibracao('turbulencia', { numeroFase: 1, turbulencia: 2 }), [CURTO, CURTO]);
  assert.deepEqual(padraoVibracao('turbulencia', { numeroFase: 1, turbulencia: 0 }), [LONGO]);
  assert.deepEqual(padraoVibracao('desligar-turbulencia', { numeroFase: 1, turbulencia: 0 }), [LONGO]);
  assert.deepEqual(padraoVibracao('cinto', { numeroFase: 1, turbulencia: 0 }), [CURTO]);
  assert.deepEqual(padraoVibracao('recentralizar', { numeroFase: 1, turbulencia: 0 }), [CURTO]);
});
