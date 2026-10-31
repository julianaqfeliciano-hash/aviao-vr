import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarVoo, FASES, NOMES_FASES, PERFIL } from '../src/flight.js';

// Avança o voo em passos fixos, acumulando eventos; devolve os últimos parâmetros.
function simular(voo, segundos, passo = 0.1) {
  const eventos = [];
  let p;
  const n = Math.round(segundos / passo);
  for (let i = 0; i < n; i++) {
    p = voo.atualizar(passo);
    eventos.push(...p.eventos);
  }
  return { p, eventos };
}

function irParaFase(voo, nome) {
  while (voo.fase !== nome) voo.proximaFase();
}

test('constantes de fases e nomes', () => {
  assert.deepEqual(FASES, ['portao', 'taxi', 'decolagem', 'cruzeiro', 'pouso']);
  assert.deepEqual(NOMES_FASES, ['Parado no portão', 'Taxiamento', 'Decolagem', 'Cruzeiro', 'Descida e pouso']);
  assert.equal(PERFIL.pouso.distanciaToque, 6600);
});

test('começa no portão parado', () => {
  const v = criarVoo();
  const p = v.atualizar(0.016);
  assert.equal(v.fase, 'portao');
  assert.equal(v.numeroFase, 1);
  assert.equal(v.turbulencia, 0);
  assert.equal(v.cinto, false);
  assert.equal(p.velocidade, 0);
  assert.equal(p.altitude, 0);
  assert.equal(p.noChao, true);
  assert.equal(p.motor, 0.1);
});

test('A avança as 5 fases e volta ao portão', () => {
  const v = criarVoo();
  assert.deepEqual([1, 2, 3, 4, 5].map(() => v.proximaFase()), [2, 3, 4, 5, 1]);
  assert.equal(v.fase, 'portao');
});

test('taxiamento acelera até 8 m/s', () => {
  const v = criarVoo();
  irParaFase(v, 'taxi');
  assert.equal(v.atualizar(1).velocidade, 2);
  assert.equal(v.atualizar(9).velocidade, 8);
});

test('decolagem vira cruzeiro sozinha após 60 s', () => {
  const v = criarVoo();
  irParaFase(v, 'decolagem');
  v.atualizar(30);
  const p = v.atualizar(30.01);
  assert.equal(p.fase, 'cruzeiro');
  assert.equal(p.numeroFase, 4);
  assert.equal(p.altitude, 700);
});

test('decolagem: no chão aos 20 s, 12° aos 40 s, trem recolhido uma vez', () => {
  const v = criarVoo();
  irParaFase(v, 'decolagem');
  const a = simular(v, 20);
  assert.equal(a.p.noChao, true);
  assert.equal(a.p.altitude, 0);
  const b = simular(v, 20);
  assert.equal(b.p.noChao, false);
  assert.equal(b.p.inclinacao, 12);
  const c = simular(v, 19.9);
  const todos = [...a.eventos, ...b.eventos, ...c.eventos];
  assert.equal(todos.filter((e) => e === 'trem-recolhido').length, 1);
  assert.equal(c.p.fase, 'decolagem');
});

test('pouso: eventos em ordem e termina parado', () => {
  const v = criarVoo();
  irParaFase(v, 'pouso');
  const { p, eventos } = simular(v, 80);
  assert.deepEqual(eventos, ['trem-baixado', 'toque-na-pista']);
  assert.equal(p.fase, 'pouso');
  assert.equal(p.velocidade, 0);
  assert.equal(p.altitude, 0);
  assert.equal(p.noChao, true);
  assert.equal(p.motor, 0.15);
});

test('distância no pouso até o toque ≈ PERFIL.pouso.distanciaToque', () => {
  const v = criarVoo();
  irParaFase(v, 'pouso');
  const { p } = simular(v, 60, 0.01);
  assert.ok(Math.abs(p.distanciaNaFase - 6600) < 5, `distância ${p.distanciaNaFase}`);
});

test('odômetro acumula entre fases e distância da fase zera ao avançar', () => {
  const v = criarVoo();
  irParaFase(v, 'cruzeiro');
  const a = simular(v, 10);
  assert.ok(Math.abs(a.p.distanciaNaFase - 1500) < 1e-6);
  v.proximaFase();
  const b = v.atualizar(0.1);
  assert.ok(b.distanciaNaFase < 20);
  assert.ok(b.odometro > 1500);
});

test('dt enorme na decolagem: cruzeiro e trem recolhido uma vez', () => {
  const v = criarVoo();
  irParaFase(v, 'decolagem');
  const p = v.atualizar(100);
  assert.equal(p.fase, 'cruzeiro');
  assert.equal(p.eventos.filter((e) => e === 'trem-recolhido').length, 1);
});

test('dt enorme no pouso: os dois eventos uma vez cada, em ordem', () => {
  const v = criarVoo();
  irParaFase(v, 'pouso');
  const p = v.atualizar(500);
  assert.deepEqual(p.eventos, ['trem-baixado', 'toque-na-pista']);
  assert.deepEqual(v.atualizar(10).eventos, []);
});

test('A no meio da decolagem vai direto ao cruzeiro', () => {
  const v = criarVoo();
  irParaFase(v, 'decolagem');
  v.atualizar(10);
  v.proximaFase();
  const p = v.atualizar(0.016);
  assert.equal(p.fase, 'cruzeiro');
  assert.equal(p.altitude, 700);
  assert.equal(p.velocidade, 150);
});

test('turbulência cicla 0→1→2→3→0 e desligar zera', () => {
  const v = criarVoo();
  assert.deepEqual([1, 2, 3, 4].map(() => v.ciclarTurbulencia()), [1, 2, 3, 0]);
  v.ciclarTurbulencia();
  v.ciclarTurbulencia();
  assert.equal(v.desligarTurbulencia(), 0);
  assert.equal(v.turbulencia, 0);
});

test('intensidade sobe 1 nível/s e zera em até 0,3 s', () => {
  const v = criarVoo();
  v.ciclarTurbulencia();
  assert.ok(Math.abs(v.atualizar(0.5).intensidadeTurbulencia - 0.5) < 1e-9);
  v.ciclarTurbulencia();
  v.ciclarTurbulencia();
  assert.equal(v.atualizar(3).intensidadeTurbulencia, 3);
  v.desligarTurbulencia();
  assert.equal(v.atualizar(0.3).intensidadeTurbulencia, 0);
});

test('taxiamento tem tremor 1 sem turbulência; portão tem 0', () => {
  const v = criarVoo();
  assert.equal(v.atualizar(0.1).tremor, 0);
  v.proximaFase();
  assert.equal(v.atualizar(0.1).tremor, 1);
  v.ciclarTurbulencia();
  v.ciclarTurbulencia();
  v.ciclarTurbulencia();
  assert.equal(v.atualizar(5).tremor, 3);
});

test('cinto alterna e aparece nos parâmetros', () => {
  const v = criarVoo();
  assert.equal(v.alternarCinto(), true);
  assert.equal(v.atualizar(0.1).cinto, true);
  assert.equal(v.alternarCinto(), false);
  assert.equal(v.atualizar(0.1).cinto, false);
});
