// Lógica pura do voo: fases, perfil de voo, turbulência e luz de cinto.
// Não depende de Three.js nem do navegador (testável em Node).

export const FASES = ['portao', 'taxi', 'decolagem', 'cruzeiro', 'pouso'];
export const NOMES_FASES = ['Parado no portão', 'Taxiamento', 'Decolagem', 'Cruzeiro', 'Descida e pouso'];

// Perfil de cada fase: listas [tempo (s), valor] interpoladas linearmente,
// mantendo o primeiro/último valor fora do intervalo.
const PERFIS = {
  portao: {
    velocidade: [[0, 0]],
    altitude: [[0, 0]],
    inclinacao: [[0, 0]],
    motor: [[0, 0.1]],
    noChao: () => true,
  },
  taxi: {
    velocidade: [[0, 0], [4, 8]],
    altitude: [[0, 0]],
    inclinacao: [[0, 0]],
    motor: [[0, 0.3]],
    noChao: () => true,
  },
  decolagem: {
    duracao: 60,
    proxima: 'cruzeiro',
    velocidade: [[0, 8], [28, 78], [60, 150]],
    altitude: [[0, 0], [28, 0], [60, 700]],
    inclinacao: [[0, 0], [26, 0], [29, 12], [50, 12], [60, 0]],
    motor: [[0, 0.3], [5, 1], [45, 1], [60, 0.6]],
    noChao: (t) => t < 28,
    eventos: [[36, 'trem-recolhido']],
  },
  cruzeiro: {
    velocidade: [[0, 150]],
    altitude: [[0, 700]],
    inclinacao: [[0, 0]],
    motor: [[0, 0.6]],
    noChao: () => false,
  },
  pouso: {
    duracao: 75,
    velocidade: [[0, 150], [60, 70], [75, 0]],
    altitude: [[0, 700], [60, 0]],
    inclinacao: [[0, 0], [5, -3], [55, -3], [60, 4], [63, 0]],
    motor: [[0, 0.6], [5, 0.35], [60, 0.35], [61, 0.9], [69, 0.9], [72, 0.15]],
    noChao: (t) => t >= 60,
    eventos: [[30, 'trem-baixado'], [60, 'toque-na-pista']],
  },
};

export const PERFIL = {
  portao: { motor: 0.1 },
  taxi: { velocidade: 8, motor: 0.3 },
  decolagem: { duracao: 60, tDecolagem: 28, tTremRecolhido: 36, inclinacaoMax: 12 },
  cruzeiro: { velocidade: 150, altitude: 700, motor: 0.6 },
  // distanciaToque = área sob a velocidade de 0 a 60 s: (150 + 70) / 2 × 60
  pouso: { duracao: 75, tTremBaixado: 30, tToque: 60, distanciaToque: 6600 },
};

function interpolar(pontos, t) {
  if (t <= pontos[0][0]) return pontos[0][1];
  for (let i = 1; i < pontos.length; i++) {
    const [t1, v1] = pontos[i];
    if (t <= t1) {
      const [t0, v0] = pontos[i - 1];
      return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
    }
  }
  return pontos[pontos.length - 1][1];
}

const VELOCIDADE_TURBULENCIA = 1; // níveis por segundo
const VELOCIDADE_DESLIGAR = 10; // níveis por segundo (zera em ≤ 0,3 s)

export function criarVoo() {
  let indiceFase = 0;
  let tempoNaFase = 0;
  let distanciaNaFase = 0;
  let odometro = 0;
  let turbulencia = 0;
  let intensidadeTurbulencia = 0;
  let cinto = false;

  function entrarNaFase(indice) {
    indiceFase = indice;
    tempoNaFase = 0;
    distanciaNaFase = 0;
  }

  function suavizarTurbulencia(dt) {
    const taxa = turbulencia === 0 ? VELOCIDADE_DESLIGAR : VELOCIDADE_TURBULENCIA;
    const passo = taxa * dt;
    if (intensidadeTurbulencia < turbulencia) {
      intensidadeTurbulencia = Math.min(turbulencia, intensidadeTurbulencia + passo);
    } else {
      intensidadeTurbulencia = Math.max(turbulencia, intensidadeTurbulencia - passo);
    }
  }

  function avancarTempo(dt, eventos) {
    let restante = dt;
    for (;;) {
      const perfil = PERFIS[FASES[indiceFase]];
      const tAntes = tempoNaFase;
      const passo = perfil.proxima ? Math.min(restante, perfil.duracao - tAntes) : restante;
      const tDepois = tAntes + passo;
      for (const [tEvento, nome] of perfil.eventos ?? []) {
        if (tEvento > tAntes && tEvento <= tDepois) eventos.push(nome);
      }
      const distancia =
        ((interpolar(perfil.velocidade, tAntes) + interpolar(perfil.velocidade, tDepois)) / 2) * passo;
      distanciaNaFase += distancia;
      odometro += distancia;
      tempoNaFase = tDepois;
      restante -= passo;
      if (perfil.proxima && tempoNaFase >= perfil.duracao) {
        entrarNaFase(FASES.indexOf(perfil.proxima));
        if (restante > 0) continue;
      }
      return;
    }
  }

  return {
    get fase() {
      return FASES[indiceFase];
    },
    get numeroFase() {
      return indiceFase + 1;
    },
    get turbulencia() {
      return turbulencia;
    },
    get cinto() {
      return cinto;
    },

    proximaFase() {
      entrarNaFase((indiceFase + 1) % FASES.length);
      return indiceFase + 1;
    },
    ciclarTurbulencia() {
      turbulencia = (turbulencia + 1) % 4;
      return turbulencia;
    },
    desligarTurbulencia() {
      turbulencia = 0;
      return 0;
    },
    alternarCinto() {
      cinto = !cinto;
      return cinto;
    },

    atualizar(dt) {
      const eventos = [];
      avancarTempo(dt, eventos);
      suavizarTurbulencia(dt);
      const fase = FASES[indiceFase];
      const perfil = PERFIS[fase];
      const t = tempoNaFase;
      return {
        fase,
        numeroFase: indiceFase + 1,
        velocidade: interpolar(perfil.velocidade, t),
        altitude: interpolar(perfil.altitude, t),
        inclinacao: interpolar(perfil.inclinacao, t),
        motor: interpolar(perfil.motor, t),
        noChao: perfil.noChao(t),
        turbulencia,
        intensidadeTurbulencia,
        tremor: Math.max(intensidadeTurbulencia, fase === 'taxi' ? 1 : 0),
        cinto,
        distanciaNaFase,
        odometro,
        eventos,
      };
    },
  };
}
