// Controles do Quest e teclado → ações; padrões de vibração (lógica pura).

// Índices do layout padrão WebXR "xr-standard".
export const BOTOES = { GATILHO: 0, LATERAL: 1, DIRECIONAL: 3, A_X: 4, B_Y: 5 };

export const ACAO = {
  PROXIMA_FASE: 'proxima-fase',
  TURBULENCIA: 'turbulencia',
  DESLIGAR_TURBULENCIA: 'desligar-turbulencia',
  CINTO: 'cinto',
  RECENTRALIZAR: 'recentralizar',
};

// Ordem de verificação: gatilho, lateral, direcional, A/X, B/Y.
const ACAO_DO_BOTAO = [
  [BOTOES.GATILHO, ACAO.CINTO],
  [BOTOES.LATERAL, ACAO.DESLIGAR_TURBULENCIA],
  [BOTOES.DIRECIONAL, ACAO.RECENTRALIZAR],
  [BOTOES.A_X, ACAO.PROXIMA_FASE],
  [BOTOES.B_Y, ACAO.TURBULENCIA],
];

// Mãos rastreadas (sem controle) aparecem como fontes de entrada: a pinça viraria "gatilho".
export function ehControle({ hand, profiles } = {}) {
  if (hand) return false;
  return !(profiles ?? []).some((perfil) => perfil.startsWith('generic-hand'));
}

export function criarLeitorControles() {
  const anteriores = new Map(); // mao -> boolean[]

  return {
    // Esquece o estado anterior (nova sessão de RV): controle já apertado não dispara.
    reiniciar() {
      anteriores.clear();
    },

    ler(controles) {
      const acoes = [];
      const vistos = new Set();
      for (const { mao, botoes } of controles) {
        vistos.add(mao);
        const antes = anteriores.get(mao);
        if (antes) {
          for (const [indice, acao] of ACAO_DO_BOTAO) {
            if (botoes[indice] && !antes[indice]) acoes.push({ acao, mao });
          }
        }
        anteriores.set(mao, botoes.slice());
      }
      for (const mao of [...anteriores.keys()]) {
        if (!vistos.has(mao)) anteriores.delete(mao);
      }
      return acoes;
    },
  };
}

const ACAO_DA_TECLA = {
  Space: ACAO.PROXIMA_FASE,
  KeyT: ACAO.TURBULENCIA,
  Digit0: ACAO.DESLIGAR_TURBULENCIA,
  Numpad0: ACAO.DESLIGAR_TURBULENCIA,
  KeyC: ACAO.CINTO,
};

export function acaoDaTecla({ code, repeat, ctrlKey, metaKey, altKey }) {
  if (repeat || ctrlKey || metaKey || altKey) return null; // deixa os atalhos do navegador em paz
  return ACAO_DA_TECLA[code] ?? null;
}

export const CURTO = { duracaoMs: 80, intensidade: 0.8 };
export const LONGO = { duracaoMs: 500, intensidade: 1 };
export const INTERVALO_MS = 150;

// `estado` é o estado DEPOIS da ação ter sido aplicada.
export function padraoVibracao(acao, { numeroFase, turbulencia }) {
  switch (acao) {
    case ACAO.PROXIMA_FASE:
      return Array(numeroFase).fill(CURTO);
    case ACAO.TURBULENCIA:
      return turbulencia === 0 ? [LONGO] : Array(turbulencia).fill(CURTO);
    case ACAO.DESLIGAR_TURBULENCIA:
      return [LONGO];
    default:
      return [CURTO];
  }
}
