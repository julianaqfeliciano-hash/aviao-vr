// Sinal de tremor da turbulência, com limites máximos por nível (lógica pura).

export const LIMITES_TREMOR = {
  posicao: [0, 0.005, 0.015, 0.03], // metros: desligada, leve, moderada, forte
  rotacaoGraus: [0, 0.2, 0.6, 1.2],
};

const GRAU = Math.PI / 180;
const DOIS_PI = Math.PI * 2;

function interpolarNivel(valores, nivel) {
  const n = Math.min(3, Math.max(0, nivel));
  const i = Math.floor(n);
  if (i >= 3) return valores[3];
  const f = n - i;
  return valores[i] + (valores[i + 1] - valores[i]) * f;
}

export function limiteTremor(nivel) {
  return {
    posicao: interpolarNivel(LIMITES_TREMOR.posicao, nivel),
    rotacao: interpolarNivel(LIMITES_TREMOR.rotacaoGraus, nivel) * GRAU,
  };
}

function hash(k, semente) {
  const v = Math.sin(k * 12.9898 + semente * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

// Soma de senos em frequências incomensuráveis, normalizada para [-1, 1].
// Frequências acima de 0,5 Hz: a faixa abaixo disso é a que mais provoca enjoo.
function ondas(t, semente) {
  return (
    (Math.sin(DOIS_PI * 0.9 * t + semente * 1.7) +
      0.6 * Math.sin(DOIS_PI * 2.3 * t + semente * 3.1) +
      0.3 * Math.sin(DOIS_PI * 5.1 * t + semente * 0.4)) /
    1.9
  );
}

// "Tranco": pulso amortecido de ~0,4 s em intervalos de 4 a 7 s.
const JANELA_TRANCO = 5.5;
function tranco(t, semente) {
  const k = Math.floor(t / JANELA_TRANCO);
  for (const janela of [k, k - 1]) {
    const inicio = janela * JANELA_TRANCO + hash(janela, semente) * 1.5;
    const tau = t - inicio;
    if (tau >= 0 && tau < 0.4) {
      const sinal = hash(janela, semente + 7) < 0.5 ? -1 : 1;
      return sinal * Math.sin(DOIS_PI * 5 * tau) * Math.exp(-tau / 0.12) * 1.6;
    }
  }
  return 0;
}

function canal(t, nivel, semente) {
  const pesoTranco = Math.min(1, Math.max(0, (nivel - 1) / 2)) * 0.5;
  const s = ondas(t, semente) * (1 - pesoTranco) + tranco(t, semente) * 2 * pesoTranco;
  return Math.min(1, Math.max(-1, s));
}

// Reduz o par (a, b) para que o módulo combinado não passe do limite.
function limitarPar(a, b, limite) {
  const modulo = Math.hypot(a, b);
  const fator = modulo > limite ? limite / modulo : 1;
  return [a * fator, b * fator];
}

export function calcularTremor(tempo, nivel) {
  if (nivel <= 0) return { x: 0, y: 0, rotX: 0, rotZ: 0 };
  const L = limiteTremor(nivel);
  // Os limites valem para o deslocamento e a inclinação combinados (dois eixos juntos).
  const [x, y] = limitarPar(canal(tempo, nivel, 1) * L.posicao * 0.6, canal(tempo, nivel, 2) * L.posicao, L.posicao);
  const [rotX, rotZ] = limitarPar(canal(tempo, nivel, 3) * L.rotacao, canal(tempo, nivel, 4) * L.rotacao, L.rotacao);
  return { x, y, rotX, rotZ };
}
