// Liga as partes: entrada → voo → cabine/paisagem/som → renderização.
import * as THREE from 'three';
import { criarVoo, NOMES_FASES } from './flight.js';
import { calcularTremor } from './tremor.js';
import { acaoDaTecla, ACAO } from './input.js';
import { criarCabine } from './cabin.js';
import { criarPaisagem } from './outside.js';

const NOMES_TURBULENCIA = ['desligada', 'leve', 'moderada', 'forte'];

// ?acelerar=N multiplica o tempo (só para testes e demonstração).
const acelerar = Math.min(20, Math.max(1, Number(new URLSearchParams(location.search).get('acelerar')) || 1));

const elInicio = document.querySelector('#inicio');
const elEntrar = document.querySelector('#entrar');
const elPainel = document.querySelector('#painel');
const elAviso = document.querySelector('#aviso');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.body.prepend(renderer.domElement);

const cena = new THREE.Scene();
cena.add(new THREE.HemisphereLight(0xffffff, 0xd8d2c8, 2.0));
cena.add(new THREE.AmbientLight(0xffffff, 0.7));
const sol = new THREE.DirectionalLight(0xfff2d8, 1.2);
sol.position.set(-5, 6, 2);
cena.add(sol);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 30000);
const rig = new THREE.Group();
rig.add(camera);
cena.add(rig);

const cabine = criarCabine();
cena.add(cabine.grupo);
const paisagem = criarPaisagem(cena);
cena.add(paisagem.grupo);

const voo = criarVoo();

// Só para o teste automático inspecionar o estado da cena.
window.aviaoDebug = { cena };

// ---------- ações ----------
function aplicarAcao(acao) {
  switch (acao) {
    case ACAO.PROXIMA_FASE:
      voo.proximaFase();
      break;
    case ACAO.TURBULENCIA:
      voo.ciclarTurbulencia();
      break;
    case ACAO.DESLIGAR_TURBULENCIA:
      voo.desligarTurbulencia();
      break;
    case ACAO.CINTO:
      cabine.definirCinto(voo.alternarCinto());
      break;
    default:
      break;
  }
}

window.addEventListener('keydown', (evento) => {
  const acao = acaoDaTecla(evento);
  if (!acao) return;
  evento.preventDefault();
  aplicarAcao(acao);
});

// ---------- modo notebook: olhar com o mouse ----------
const olhar = { yaw: 0.45, pitch: -0.08, arrastando: false, x: 0, y: 0 };
function aplicarOlhar() {
  camera.position.copy(cabine.olhos);
  camera.rotation.set(olhar.pitch, olhar.yaw, 0, 'YXZ');
}
aplicarOlhar();

renderer.domElement.addEventListener('pointerdown', (e) => {
  olhar.arrastando = true;
  olhar.x = e.clientX;
  olhar.y = e.clientY;
});
window.addEventListener('pointerup', () => {
  olhar.arrastando = false;
});
window.addEventListener('pointermove', (e) => {
  if (!olhar.arrastando || renderer.xr.isPresenting) return;
  olhar.yaw += (e.clientX - olhar.x) * 0.005;
  olhar.pitch = THREE.MathUtils.clamp(olhar.pitch + (e.clientY - olhar.y) * 0.005, -1.4, 1.4);
  olhar.x = e.clientX;
  olhar.y = e.clientY;
  aplicarOlhar();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function iniciarModoNotebook() {
  elInicio.classList.add('oculto');
  elPainel.classList.remove('oculto');
  elAviso.classList.remove('oculto');
  elAviso.textContent =
    'RV indisponível neste aparelho — modo notebook: Espaço = próxima fase · T = turbulência · ' +
    '0 = desliga turbulência · C = cinto · arraste o mouse para olhar';
}

elEntrar.addEventListener('click', () => {
  iniciarModoNotebook();
});

// ---------- painel ----------
let textoPainel = '';
function atualizarPainel(p) {
  const texto =
    `Fase ${p.numeroFase} – ${NOMES_FASES[p.numeroFase - 1]}\n` +
    `Turbulência: ${NOMES_TURBULENCIA[p.turbulencia]}\n` +
    `Cinto: ${p.cinto ? 'ligado' : 'desligado'}`;
  if (texto !== textoPainel) {
    textoPainel = texto;
    elPainel.textContent = texto;
  }
}

// ---------- laço ----------
const relogio = new THREE.Clock();
let tempo = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(relogio.getDelta(), 0.1) * acelerar;
  tempo += dt;
  const p = voo.atualizar(dt);
  cabine.atualizar(calcularTremor(tempo, p.tremor));
  paisagem.atualizar(p, tempo);
  atualizarPainel(p);
  renderer.render(cena, camera);
});
