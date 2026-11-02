// Paisagem externa: céu, chão, aeroporto, pista e nuvens.
// O avião fica fixo na origem; a paisagem se move e inclina em volta dele.
import * as THREE from 'three';
import { PERFIL } from './flight.js';
import { calcularTremor, fatorBalanco } from './tremor.js';

export const NUVENS = { base: 400, topo: 550 };

const ALTURA_PISO_SOBRE_SOLO = 3.5; // m entre o piso da cabine e o chão
const LADO_CHAO = 30000;
const TAMANHO_LADRILHO = 400; // m por repetição da textura do chão
const AREA_NUVENS = 6000;
const QTD_NUVENS = 140;
const PISTA = { comprimento: 3000, largura: 45 };
const FAIXA_TAXI = { comprimento: 6000, centroZ: -2750, periodo: 60 }; // periodo = 1 repetição da textura
const CABECEIRA_DECOLAGEM = -100; // a cabeceira fica 100 m atrás no início da decolagem
const CABECEIRA_POUSO = PERFIL.pouso.distanciaToque - 300;

const COR_HORIZONTE = new THREE.Color(0xcfe3f5);
const COR_NUVEM = new THREE.Color(0xf2f4f7);
const NEVOA = { perto: 600, longe: 14000, pertoNuvem: 2, longeNuvem: 70 };

// Gerador pseudoaleatório determinístico (a paisagem é sempre a mesma).
function aleatorio(semente) {
  let s = semente >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function texturaCanvas(largura, altura, desenhar, repetirX, repetirY) {
  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  desenhar(canvas.getContext('2d'), largura, altura);
  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.wrapS = THREE.RepeatWrapping;
  textura.wrapT = THREE.RepeatWrapping;
  textura.repeat.set(repetirX, repetirY);
  textura.anisotropy = 8;
  return textura;
}

function criarCeu() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topo: { value: new THREE.Color(0x3d7cc9) },
      horizonte: { value: COR_HORIZONTE.clone() },
      branco: { value: COR_NUVEM.clone() },
      nuvem: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDirecao;
      void main() {
        vDirecao = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 topo;
      uniform vec3 horizonte;
      uniform vec3 branco;
      uniform float nuvem;
      varying vec3 vDirecao;
      void main() {
        vec3 cor = mix(horizonte, topo, smoothstep(0.0, 0.55, vDirecao.y));
        gl_FragColor = vec4(mix(cor, branco, nuvem), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const ceu = new THREE.Mesh(new THREE.SphereGeometry(20000, 32, 16), material);
  ceu.frustumCulled = false;
  const sol = new THREE.Mesh(
    new THREE.SphereGeometry(350, 16, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff6d5, fog: false }),
  );
  sol.position.set(-7000, 8000, -11000);
  const grupo = new THREE.Group();
  grupo.add(ceu, sol);
  return { grupo, material, sol };
}

function criarChao() {
  const textura = texturaCanvas(
    512,
    512,
    (c, l, a) => {
      const rnd = aleatorio(7);
      const verdes = ['#6f8f4e', '#7d9a55', '#5f7f44', '#8aa25f', '#9a9a62', '#6a8a52'];
      c.fillStyle = '#6f8f4e';
      c.fillRect(0, 0, l, a);
      for (let i = 0; i < 70; i++) {
        c.fillStyle = verdes[Math.floor(rnd() * verdes.length)];
        c.fillRect(rnd() * l, rnd() * a, 40 + rnd() * 140, 30 + rnd() * 120);
      }
      c.strokeStyle = 'rgba(70, 60, 40, 0.35)';
      c.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        c.beginPath();
        c.moveTo(rnd() * l, 0);
        c.lineTo(rnd() * l, a);
        c.stroke();
      }
    },
    LADO_CHAO / TAMANHO_LADRILHO,
    LADO_CHAO / TAMANHO_LADRILHO,
  );
  const geometria = new THREE.PlaneGeometry(LADO_CHAO, LADO_CHAO);
  geometria.rotateX(-Math.PI / 2);
  const malha = new THREE.Mesh(geometria, new THREE.MeshLambertMaterial({ map: textura }));
  return { malha, textura };
}

function plano(largura, comprimento, material, x, y, z) {
  const geometria = new THREE.PlaneGeometry(largura, comprimento);
  geometria.rotateX(-Math.PI / 2);
  const malha = new THREE.Mesh(geometria, material);
  malha.position.set(x, y, z);
  return malha;
}

function criarAeroporto() {
  const grupo = new THREE.Group();
  const asfalto = new THREE.MeshLambertMaterial({ color: 0x8b8e94 });
  grupo.add(plano(170, 500, asfalto, -15, 0.05, 0));

  const pistaTaxi = texturaCanvas(
    64,
    256,
    (c, l, a) => {
      c.fillStyle = '#7d8086';
      c.fillRect(0, 0, l, a);
      c.fillStyle = '#e6c229';
      c.fillRect(l / 2 - 2, 0, 4, a);
    },
    1,
    FAIXA_TAXI.comprimento / FAIXA_TAXI.periodo,
  );
  const faixaTaxi = plano(40, FAIXA_TAXI.comprimento, new THREE.MeshLambertMaterial({ map: pistaTaxi }), 0, 0.08, FAIXA_TAXI.centroZ);
  faixaTaxi.name = 'faixa-taxi';
  grupo.add(faixaTaxi);

  const fachada = texturaCanvas(
    256,
    64,
    (c, l, a) => {
      c.fillStyle = '#d7d3cb';
      c.fillRect(0, 0, l, a);
      c.fillStyle = '#5d7c99';
      c.fillRect(0, a * 0.3, l, a * 0.35);
      c.fillStyle = '#c4beb3';
      for (let x = 0; x < l; x += 16) c.fillRect(x, a * 0.3, 2, a * 0.35);
    },
    6,
    1,
  );
  const terminal = new THREE.Mesh(
    new THREE.BoxGeometry(25, 14, 300),
    [
      new THREE.MeshLambertMaterial({ map: fachada }), // +x: virada para o avião
      new THREE.MeshLambertMaterial({ color: 0xd7d3cb }),
      new THREE.MeshLambertMaterial({ color: 0xb9b5ad }),
      new THREE.MeshLambertMaterial({ color: 0xd7d3cb }),
      new THREE.MeshLambertMaterial({ color: 0xd7d3cb }),
      new THREE.MeshLambertMaterial({ color: 0xd7d3cb }),
    ],
  );
  terminal.position.set(-75, 7, 20);
  grupo.add(terminal);

  // Torre de controle
  const torre = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 40, 12), new THREE.MeshLambertMaterial({ color: 0xcfcac1 }));
  torre.position.set(-110, 20, -260);
  const cabine = new THREE.Mesh(new THREE.CylinderGeometry(7, 5, 6, 12), new THREE.MeshLambertMaterial({ color: 0x4f6d8a }));
  cabine.position.set(-110, 43, -260);
  grupo.add(torre, cabine);
  return grupo;
}

function criarPista() {
  const textura = texturaCanvas(
    128,
    512,
    (c, l, a) => {
      c.fillStyle = '#4a4c51';
      c.fillRect(0, 0, l, a);
      c.fillStyle = '#f2f2f2';
      c.fillRect(4, 0, 4, a); // bordas
      c.fillRect(l - 8, 0, 4, a);
      c.fillRect(l / 2 - 2, 0, 4, a * 0.5); // faixa central tracejada
    },
    1,
    PISTA.comprimento / 60,
  );
  const grupo = new THREE.Group();
  // Pista começa na cabeceira (z = 0) e segue para a frente (−z).
  grupo.add(
    plano(PISTA.largura, PISTA.comprimento, new THREE.MeshLambertMaterial({ map: textura }), 0, 0.1, -PISTA.comprimento / 2),
  );
  // Acostamentos de asfalto mais claro
  grupo.add(
    plano(PISTA.largura + 30, PISTA.comprimento + 200, new THREE.MeshLambertMaterial({ color: 0x8f9298 }), 0, 0.06, -PISTA.comprimento / 2),
  );
  return grupo;
}

function criarNuvens() {
  const rnd = aleatorio(42);
  const base = [];
  for (let i = 0; i < QTD_NUVENS; i++) {
    base.push({
      x: (rnd() - 0.5) * AREA_NUVENS,
      y: NUVENS.base + 20 + rnd() * (NUVENS.topo - NUVENS.base - 40),
      z: (rnd() - 0.5) * AREA_NUVENS,
      escala: new THREE.Vector3(90 + rnd() * 160, 25 + rnd() * 35, 70 + rnd() * 140),
    });
  }
  const malha = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 2),
    new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
    QTD_NUVENS,
  );
  malha.frustumCulled = false;
  return { malha, base };
}

function modulo(a, n) {
  return ((a % n) + n) % n;
}

export function criarPaisagem(cena) {
  cena.fog = new THREE.Fog(COR_HORIZONTE.clone(), NEVOA.perto, NEVOA.longe);

  const pivo = new THREE.Group(); // gira com a inclinação do avião
  const mundo = new THREE.Group(); // desce/sobe com a altitude
  const ceu = criarCeu();
  const chao = criarChao();
  const aeroporto = criarAeroporto();
  const faixaTaxi = aeroporto.getObjectByName('faixa-taxi');
  const pista = criarPista();
  const nuvens = criarNuvens();
  mundo.add(chao.malha, aeroporto, pista, nuvens.malha);
  pivo.add(ceu.grupo, mundo);

  const matriz = new THREE.Matrix4();
  const posicao = new THREE.Vector3();
  const rotacao = new THREE.Quaternion();

  return {
    grupo: pivo,
    atualizar(p, tempo) {
      const tremor = calcularTremor(tempo, p.tremor);
      // No ar a paisagem balança alguns metros; no chão, só o tremor da própria cabine.
      // A ampliação cresce nos primeiros 30 m de altitude, sem salto na decolagem e no toque.
      const balanco = tremor.y * fatorBalanco(p.altitude);
      pivo.rotation.x = -THREE.MathUtils.degToRad(p.inclinacao);
      mundo.position.y = -(p.altitude + ALTURA_PISO_SOBRE_SOLO) + balanco;

      chao.textura.offset.y = modulo(p.odometro / TAMANHO_LADRILHO, 1);

      const noAeroporto = p.fase === 'portao' || p.fase === 'taxi';
      aeroporto.visible = noAeroporto;
      if (noAeroporto) {
        aeroporto.position.z = p.distanciaNaFase; // terminal e pátio ficam para trás
        // A faixa de taxiamento acompanha o avião, deslizando só dentro de uma repetição da
        // textura: as marcas passam, mas a faixa nunca acaba (taxiamento pode durar muito).
        faixaTaxi.position.z = FAIXA_TAXI.centroZ - p.distanciaNaFase + modulo(p.distanciaNaFase, FAIXA_TAXI.periodo);
      }

      pista.visible = p.fase === 'decolagem' || p.fase === 'pouso';
      if (p.fase === 'decolagem') pista.position.z = p.distanciaNaFase - CABECEIRA_DECOLAGEM;
      if (p.fase === 'pouso') pista.position.z = p.distanciaNaFase - CABECEIRA_POUSO;

      nuvens.base.forEach((n, i) => {
        posicao.set(n.x, n.y, modulo(n.z + p.odometro, AREA_NUVENS) - AREA_NUVENS / 2);
        matriz.compose(posicao, rotacao, n.escala);
        nuvens.malha.setMatrixAt(i, matriz);
      });
      nuvens.malha.instanceMatrix.needsUpdate = true;

      // Atravessando a camada de nuvens: tudo fica branco lá fora.
      const distanciaFaixa = Math.max(0, NUVENS.base - p.altitude, p.altitude - NUVENS.topo);
      const naNuvem = THREE.MathUtils.clamp(1 - distanciaFaixa / 40, 0, 1);
      cena.fog.near = THREE.MathUtils.lerp(NEVOA.perto, NEVOA.pertoNuvem, naNuvem);
      cena.fog.far = THREE.MathUtils.lerp(NEVOA.longe, NEVOA.longeNuvem, naNuvem);
      cena.fog.color.copy(COR_HORIZONTE).lerp(COR_NUVEM, naNuvem);
      ceu.material.uniforms.nuvem.value = naNuvem;
      ceu.sol.visible = naNuvem < 0.5;
    },
  };
}
