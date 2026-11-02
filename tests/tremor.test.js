import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularTremor, limiteTremor, LIMITES_TREMOR, fatorBalanco } from '../src/tremor.js';

const GRAU = Math.PI / 180;

test('limites do spec por nível', () => {
  assert.deepEqual(LIMITES_TREMOR, { posicao: [0, 0.005, 0.015, 0.03], rotacaoGraus: [0, 0.2, 0.6, 1.2] });
  assert.equal(limiteTremor(3).posicao, 0.03);
  assert.ok(Math.abs(limiteTremor(3).rotacao - 1.2 * GRAU) < 1e-12);
  assert.equal(limiteTremor(7).posicao, 0.03);
  assert.equal(limiteTremor(-1).posicao, 0);
});

test('nível 0 não mexe', () => {
  for (let t = 0; t < 30; t += 0.37) {
    assert.deepEqual(calcularTremor(t, 0), { x: 0, y: 0, rotX: 0, rotZ: 0 });
  }
});

test('nunca passa do limite em nenhum nível', () => {
  for (const n of [0.5, 1, 1.5, 2, 2.5, 3, 4]) {
    const L = limiteTremor(n);
    for (let t = 0; t < 120; t += 0.01) {
      const s = calcularTremor(t, n);
      assert.ok(Math.abs(s.x) <= L.posicao + 1e-9 && Math.abs(s.y) <= L.posicao + 1e-9, `pos n=${n} t=${t}`);
      assert.ok(Math.abs(s.rotX) <= L.rotacao + 1e-9 && Math.abs(s.rotZ) <= L.rotacao + 1e-9, `rot n=${n} t=${t}`);
    }
  }
});

test('deslocamento e inclinação combinados (dois eixos juntos) nunca passam do limite', () => {
  for (const n of [0.5, 1, 1.5, 2, 2.5, 3, 4]) {
    const L = limiteTremor(n);
    for (let t = 0; t < 300; t += 0.01) {
      const s = calcularTremor(t, n);
      assert.ok(Math.hypot(s.x, s.y) <= L.posicao + 1e-9, `pos n=${n} t=${t.toFixed(2)} ${Math.hypot(s.x, s.y)}`);
      assert.ok(Math.hypot(s.rotX, s.rotZ) <= L.rotacao + 1e-9, `rot n=${n} t=${t.toFixed(2)} ${Math.hypot(s.rotX, s.rotZ)}`);
    }
  }
});

test('limite interpolado: nível 1,5 = 1 cm', () => {
  assert.ok(Math.abs(limiteTremor(1.5).posicao - 0.01) < 1e-12);
});

test('nível 3 de fato se mexe (≥ 50% do limite em y)', () => {
  let maxY = 0;
  for (let t = 0; t < 60; t += 0.01) maxY = Math.max(maxY, Math.abs(calcularTremor(t, 3).y));
  assert.ok(maxY >= 0.015, `max y ${maxY}`);
});

test('nível 1 se mexe de forma perceptível', () => {
  let maxY = 0;
  for (let t = 0; t < 60; t += 0.01) maxY = Math.max(maxY, Math.abs(calcularTremor(t, 1).y));
  assert.ok(maxY >= 0.0025, `max y ${maxY}`);
});

test('determinístico', () => {
  assert.deepEqual(calcularTremor(12.3, 2), calcularTremor(12.3, 2));
});

test('balanço da paisagem cresce aos poucos com a altitude (sem salto na decolagem/toque)', () => {
  assert.equal(fatorBalanco(0), 1);
  assert.equal(fatorBalanco(30), 100);
  assert.equal(fatorBalanco(700), 100);
  assert.ok(Math.abs(fatorBalanco(15) - 50.5) < 1e-9);
  for (let h = 0; h < 30; h += 0.5) assert.ok(fatorBalanco(h + 0.5) - fatorBalanco(h) <= 1.65 + 1e-9);
});
