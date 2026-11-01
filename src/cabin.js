// Cabine do avião em 3D simplificado.
// Coordenadas: x direita, y cima, −z frente; piso em y = 0; corredor centrado em x = 0.
import * as THREE from 'three';

const OLHOS = new THREE.Vector3(-1.4, 1.2, 0.05);
const PASSO_FILEIRA = 0.8;
const FILEIRAS = { atras: 3, frente: 8 };
const X_POLTRONAS = [-1.45, -0.95, -0.45, 0.45, 0.95, 1.45];
const X_PAREDE = 1.8;
const Y_BAGAGEIRO = { baixo: 1.75, alto: 2.1 };
const Y_TETO = 2.25;
const Z_FRENTE = -(FILEIRAS.frente + 0.8) * PASSO_FILEIRA;
const Z_TRAS = (FILEIRAS.atras + 0.8) * PASSO_FILEIRA;
const JANELA = { largura: 0.28, altura: 0.38, raio: 0.09, centroY: 1.15, deslocamentoZ: -0.1 };

const CORES = {
  parede: 0xe9e7e2,
  bagageiro: 0xf3f2ef,
  teto: 0xf1f0ec,
  piso: 0x4b505b,
  corredor: 0x7a5a45,
  poltrona: 0x1f3a5f,
  capa: 0xf4f4f4,
  bracos: 0x2b2f36,
  divisoria: 0xd9d6cf,
  luz: 0xfff4dd,
};

function material(cor) {
  // fog: false — a neblina das nuvens não deve "embranquecer" o interior.
  return new THREE.MeshLambertMaterial({ color: cor, fog: false });
}

function retanguloArredondado(alvo, cx, cy, largura, altura, raio) {
  const x = cx - largura / 2;
  const y = cy - altura / 2;
  alvo.moveTo(x + raio, y);
  alvo.lineTo(x + largura - raio, y);
  alvo.quadraticCurveTo(x + largura, y, x + largura, y + raio);
  alvo.lineTo(x + largura, y + altura - raio);
  alvo.quadraticCurveTo(x + largura, y + altura, x + largura - raio, y + altura);
  alvo.lineTo(x + raio, y + altura);
  alvo.quadraticCurveTo(x, y + altura, x, y + altura - raio);
  alvo.lineTo(x, y + raio);
  alvo.quadraticCurveTo(x, y, x + raio, y);
}

// Parede lateral plana com uma janela por fileira. lado: −1 esquerda, +1 direita.
function criarParede(lado) {
  // Desenhada no plano (u, y) com u = −z na esquerda e u = z na direita.
  const sinal = lado < 0 ? -1 : 1;
  const uMin = Math.min(sinal * Z_FRENTE, sinal * Z_TRAS);
  const uMax = Math.max(sinal * Z_FRENTE, sinal * Z_TRAS);
  const forma = new THREE.Shape();
  forma.moveTo(uMin, 0);
  forma.lineTo(uMax, 0);
  forma.lineTo(uMax, Y_BAGAGEIRO.baixo);
  forma.lineTo(uMin, Y_BAGAGEIRO.baixo);
  forma.lineTo(uMin, 0);
  for (let k = -FILEIRAS.atras; k <= FILEIRAS.frente; k++) {
    const z = -k * PASSO_FILEIRA + JANELA.deslocamentoZ;
    const furo = new THREE.Path();
    retanguloArredondado(furo, sinal * z, JANELA.centroY, JANELA.largura, JANELA.altura, JANELA.raio);
    forma.holes.push(furo);
  }
  const geometria = new THREE.ShapeGeometry(forma, 6);
  geometria.rotateY(lado < 0 ? Math.PI / 2 : -Math.PI / 2);
  const malha = new THREE.Mesh(geometria, material(CORES.parede));
  malha.material.side = THREE.DoubleSide;
  malha.position.x = lado * X_PAREDE;
  return malha;
}

function caixa(largura, altura, profundidade, cor, x, y, z) {
  const malha = new THREE.Mesh(new THREE.BoxGeometry(largura, altura, profundidade), material(cor));
  malha.position.set(x, y, z);
  return malha;
}

function criarPoltronas() {
  const zs = [];
  for (let k = -FILEIRAS.atras; k <= FILEIRAS.frente; k++) zs.push(-k * PASSO_FILEIRA);
  const total = zs.length * X_POLTRONAS.length;
  const partes = [
    // [geometria, cor, deslocamento (x, y, z), inclinação do encosto]
    [new THREE.BoxGeometry(0.44, 0.12, 0.48), CORES.poltrona, [0, 0.45, 0.05], 0],
    [new THREE.BoxGeometry(0.44, 0.62, 0.1), CORES.poltrona, [0, 0.82, 0.33], 0.12],
    [new THREE.BoxGeometry(0.4, 0.1, 0.115), CORES.capa, [0, 1.09, 0.345], 0.12],
    [new THREE.BoxGeometry(0.05, 0.05, 0.42), CORES.bracos, [-0.235, 0.66, 0.08], 0],
  ];
  const grupo = new THREE.Group();
  const matriz = new THREE.Matrix4();
  const rotacao = new THREE.Quaternion();
  const escala = new THREE.Vector3(1, 1, 1);
  for (const [geometria, cor, [dx, dy, dz], inclinacao] of partes) {
    const malha = new THREE.InstancedMesh(geometria, material(cor), total);
    rotacao.setFromEuler(new THREE.Euler(inclinacao, 0, 0));
    let i = 0;
    for (const z of zs) {
      for (const x of X_POLTRONAS) {
        matriz.compose(new THREE.Vector3(x + dx, dy, z + dz), rotacao, escala);
        malha.setMatrixAt(i++, matriz);
      }
    }
    grupo.add(malha);
  }
  // Mesinha fechada no encosto à frente do paciente.
  grupo.add(caixa(0.38, 0.28, 0.02, CORES.divisoria, -1.45, 0.84, -PASSO_FILEIRA + 0.27));
  return grupo;
}

function texturaCinto() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const c = canvas.getContext('2d');
  c.fillStyle = '#16181c';
  c.fillRect(0, 0, 128, 64);
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.arc(64, 16, 8, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.moveTo(50, 28);
  c.lineTo(78, 28);
  c.lineTo(84, 58);
  c.lineTo(44, 58);
  c.closePath();
  c.fill();
  c.fillStyle = '#f59e0b';
  c.fillRect(38, 41, 52, 7);
  c.fillRect(58, 38, 12, 13);
  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

// Avisos de cinto sob o bagageiro de cada fileira, dos dois lados.
function criarAvisosCinto() {
  const materialAviso = new THREE.MeshBasicMaterial({ map: texturaCinto(), fog: false, color: 0x3a3a3a });
  const geometria = new THREE.PlaneGeometry(0.16, 0.08);
  geometria.rotateX(Math.PI / 2 - 0.35); // virado para baixo, levemente para trás (para o passageiro)
  const posicoes = [];
  for (let k = -FILEIRAS.atras; k <= FILEIRAS.frente; k++) {
    for (const x of [-1.4, 1.4]) posicoes.push([x, Y_BAGAGEIRO.baixo - 0.005, -k * PASSO_FILEIRA - 0.35]);
  }
  const malha = new THREE.InstancedMesh(geometria, materialAviso, posicoes.length);
  const matriz = new THREE.Matrix4();
  posicoes.forEach(([x, y, z], i) => malha.setMatrixAt(i, matriz.makeTranslation(x, y, z)));
  return { malha, materialAviso };
}

export function criarCabine() {
  const conteudo = new THREE.Group();
  const comprimento = Z_TRAS - Z_FRENTE;
  const zMeio = (Z_TRAS + Z_FRENTE) / 2;

  conteudo.add(criarParede(-1), criarParede(1));
  conteudo.add(caixa(X_PAREDE * 2, 0.02, comprimento, CORES.piso, 0, -0.01, zMeio));
  conteudo.add(caixa(0.44, 0.022, comprimento, CORES.corredor, 0, -0.005, zMeio));
  conteudo.add(caixa(X_PAREDE * 2, 0.02, comprimento, CORES.teto, 0, Y_TETO + 0.01, zMeio));
  for (const lado of [-1, 1]) {
    const largura = X_PAREDE - 1.25;
    const x = lado * (1.25 + largura / 2);
    const altura = Y_BAGAGEIRO.alto - Y_BAGAGEIRO.baixo;
    conteudo.add(caixa(largura, altura, comprimento, CORES.bagageiro, x, Y_BAGAGEIRO.baixo + altura / 2, zMeio));
    // faixa entre bagageiro e teto
    conteudo.add(caixa(0.02, Y_TETO - Y_BAGAGEIRO.alto, comprimento, CORES.parede, lado * 1.25, (Y_TETO + Y_BAGAGEIRO.alto) / 2, zMeio));
    // luz de teto
    const luz = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.02, comprimento),
      new THREE.MeshBasicMaterial({ color: CORES.luz, fog: false }),
    );
    luz.position.set(lado * 1.1, Y_TETO - 0.01, zMeio);
    conteudo.add(luz);
  }
  conteudo.add(caixa(X_PAREDE * 2, Y_TETO, 0.05, CORES.divisoria, 0, Y_TETO / 2, Z_FRENTE));
  conteudo.add(caixa(X_PAREDE * 2, Y_TETO, 0.05, CORES.divisoria, 0, Y_TETO / 2, Z_TRAS));
  conteudo.add(criarPoltronas());
  const { malha: avisos, materialAviso } = criarAvisosCinto();
  conteudo.add(avisos);

  // Pivô no ponto dos olhos: o tremor gira a cabine em torno da cabeça do paciente,
  // então o deslocamento percebido respeita os limites do tremor.
  conteudo.position.copy(OLHOS).multiplyScalar(-1);
  const grupo = new THREE.Group();
  grupo.add(conteudo);
  grupo.position.copy(OLHOS);

  return {
    grupo,
    olhos: OLHOS.clone(),
    definirCinto(ligado) {
      materialAviso.color.set(ligado ? 0xffffff : 0x3a3a3a);
    },
    atualizar({ x, y, rotX, rotZ }) {
      grupo.position.set(OLHOS.x + x, OLHOS.y + y, OLHOS.z);
      grupo.rotation.set(rotX, 0, rotZ);
    },
  };
}
