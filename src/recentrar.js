// Recentralização (lógica pura): calcula a transformação do suporte (rig) da câmera
// para que a cabeça atual fique no ponto dos olhos do assento, olhando para a frente (−z).
// Rotação em Y na convenção do Three.js: x' = x·cosθ + z·sinθ, z' = −x·sinθ + z·cosθ.

export function calcularRecentralizacao(cabeca, yawCabeca, olhos) {
  const rotacaoY = -yawCabeca;
  const c = Math.cos(rotacaoY);
  const s = Math.sin(rotacaoY);
  return {
    posicao: {
      x: olhos.x - (cabeca.x * c + cabeca.z * s),
      y: olhos.y - cabeca.y,
      z: olhos.z - (-cabeca.x * s + cabeca.z * c),
    },
    rotacaoY,
  };
}
