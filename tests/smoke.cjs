// Teste de fumaça: abre a página num Chromium sem óculos, percorre o app pelo teclado,
// confere o painel e salva fotos.  Uso: node tests/smoke.cjs [pasta-das-fotos]
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const RAIZ = path.resolve(__dirname, '..');
const SAIDA = path.resolve(process.argv[2] || path.join(RAIZ, 'tests', 'fotos'));
const PORTA = 8123;
const URL_APP = `http://localhost:${PORTA}/?acelerar=10`;

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function subirServidor() {
  const servidor = spawn('python3', ['-m', 'http.server', String(PORTA), '--bind', '127.0.0.1'], {
    cwd: RAIZ,
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`http://localhost:${PORTA}/`);
      if (r.ok) return servidor;
    } catch {
      /* ainda subindo */
    }
    await espera(100);
  }
  servidor.kill();
  throw new Error('servidor local não subiu');
}

async function principal() {
  fs.mkdirSync(SAIDA, { recursive: true });
  const servidor = await subirServidor();
  const navegador = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
  });
  const erros = [];
  try {
    const pagina = await navegador.newPage({ viewport: { width: 1280, height: 720 } });
    pagina.on('pageerror', (e) => erros.push(`pageerror: ${e.message}`));
    pagina.on('console', (m) => {
      if (m.type() === 'error') erros.push(`console: ${m.text()}`);
    });

    const painelContem = (texto, timeout = 5000) =>
      pagina
        .waitForFunction((t) => document.querySelector('#painel')?.textContent.includes(t), texto, { timeout })
        .catch(() => {
          throw new Error(`painel não mostrou "${texto}"`);
        });
    const foto = async (nome) => {
      await espera(400);
      await pagina.screenshot({ path: path.join(SAIDA, nome) });
      console.log(`foto: ${path.join(SAIDA, nome)}`);
    };

    await pagina.goto(URL_APP);
    await pagina.click('#entrar');

    await painelContem('Fase 1 – Parado no portão');
    await painelContem('Turbulência: desligada');
    await painelContem('Cinto: desligado');
    const aviso = await pagina.textContent('#aviso');
    if (!aviso.includes('RV indisponível neste aparelho')) throw new Error(`aviso inesperado: "${aviso}"`);

    await pagina.keyboard.press('Space');
    await painelContem('Fase 2 – Taxiamento');
    await pagina.keyboard.press('KeyT');
    await painelContem('Turbulência: leve');
    await pagina.keyboard.press('Digit0');
    await painelContem('Turbulência: desligada');
    await pagina.keyboard.press('KeyC');
    await painelContem('Cinto: ligado');
    await foto('cabine.png');

    if (erros.length) throw new Error(`erros na página:\n${erros.join('\n')}`);
    console.log('SMOKE OK');
  } finally {
    await navegador.close();
    servidor.kill();
  }
}

principal().catch((e) => {
  console.error(`SMOKE FALHOU: ${e.message}`);
  process.exit(1);
});
