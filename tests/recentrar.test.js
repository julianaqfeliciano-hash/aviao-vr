import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularRecentralizacao } from '../src/recentrar.js';

// Rotação em torno de Y na convenção do Three.js.
function aplicar({ posicao, rotacaoY }, p) {
  const c = Math.cos(rotacaoY);
  const s = Math.sin(rotacaoY);
  return {
    x: p.x * c + p.z * s + posicao.x,
    y: p.y + posicao.y,
    z: -p.x * s + p.z * c + posicao.z,
  };
}

function perto(a, b, msg) {
  for (const k of ['x', 'y', 'z']) assert.ok(Math.abs(a[k] - b[k]) < 1e-9, `${msg} ${k}: ${a[k]} vs ${b[k]}`);
}

const olhos = { x: -1.4, y: 1.15, z: 0 };

test('olhando para a frente: só desloca', () => {
  const r = calcularRecentralizacao({ x: 0, y: 1.6, z: 0 }, 0, olhos);
  perto(aplicar(r, { x: 0, y: 1.6, z: 0 }), olhos, 'cabeça');
  assert.ok(Math.abs(r.rotacaoY) < 1e-12);
});

test('cabeça virada 90°', () => {
  const cabeca = { x: 0.3, y: 1.2, z: -0.5 };
  const r = calcularRecentralizacao(cabeca, Math.PI / 2, olhos);
  perto(aplicar(r, cabeca), olhos, 'cabeça');
  assert.ok(Math.abs(r.rotacaoY + Math.PI / 2) < 1e-9);
});

test('olhando para trás e em pé', () => {
  const cabeca = { x: 0.2, y: 1.7, z: 0.4 };
  const yaw = Math.PI;
  const r = calcularRecentralizacao(cabeca, yaw, olhos);
  perto(aplicar(r, cabeca), olhos, 'cabeça');
  assert.ok(Math.abs(Math.cos(yaw + r.rotacaoY) - 1) < 1e-9);
});
