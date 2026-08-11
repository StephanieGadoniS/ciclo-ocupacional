export const TIPOS_DE_EXAME = {
  ADMISSIONAL: "admissional",
  PERIODICO: "periodico",
  RETORNO_AO_TRABALHO: "retorno_ao_trabalho",
  MUDANCA_DE_RISCO: "mudanca_de_risco",
  DEMISSIONAL: "demissional",
} as const;

export type TipoDeExame =
  (typeof TIPOS_DE_EXAME)[keyof typeof TIPOS_DE_EXAME];

export const ROTULOS_DOS_TIPOS_DE_EXAME: Record<TipoDeExame, string> = {
  admissional: "Admissional",
  periodico: "Periódico",
  retorno_ao_trabalho: "Retorno ao trabalho",
  mudanca_de_risco: "Mudança de risco",
  demissional: "Demissional",
};

export const STATUS_DO_AGENDAMENTO = {
  SOLICITADO: "solicitado",
  AGENDADO: "agendado",
  REALIZADO: "realizado",
  CANCELADO: "cancelado",
  NAO_COMPARECEU: "nao_compareceu",
} as const;

export type StatusDoAgendamento =
  (typeof STATUS_DO_AGENDAMENTO)[keyof typeof STATUS_DO_AGENDAMENTO];

export const ROTULOS_DOS_STATUS: Record<StatusDoAgendamento, string> = {
  solicitado: "Solicitado",
  agendado: "Agendado",
  realizado: "Realizado",
  cancelado: "Cancelado",
  nao_compareceu: "Não compareceu",
};

export const PERIODOS_PREFERIDOS = {
  MANHA: "manha",
  TARDE: "tarde",
  QUALQUER: "qualquer",
} as const;

export type PeriodoPreferido =
  (typeof PERIODOS_PREFERIDOS)[keyof typeof PERIODOS_PREFERIDOS];

export const ROTULOS_DOS_PERIODOS_PREFERIDOS: Record<
  PeriodoPreferido,
  string
> = {
  manha: "Manhã",
  tarde: "Tarde",
  qualquer: "Qualquer período",
};

export type SituacaoDoPrazo =
  | "em_dia"
  | "atencao"
  | "atrasado"
  | "concluido"
  | "encerrado";

export interface DadosDoAgendamentoOcupacional {
  id: string;
  empresaId: string;
  clinicaId: string;
  colaboradorId: string;
  tipoDeExame: TipoDeExame;
  status: StatusDoAgendamento;
  dataDeReferencia: string;
  dataLimite: string;
  periodoPreferido: PeriodoPreferido;
  diasDeAfastamento: number | null;
  observacoes: string | null;
  recursoDaClinicaId: string | null;
  inicioAgendado: string | null;
  fimAgendado: string | null;
  motivoDoCancelamento: string | null;
  criadoPor: string;
  criadoEm: string;
  atualizadoEm: string;
  realizadoEm: string | null;
}

export interface EventoDoAgendamento {
  id: string;
  agendamentoId: string;
  statusAnterior: StatusDoAgendamento | null;
  statusAtual: StatusDoAgendamento;
  descricao: string;
  realizadoPor: string;
  ocorridoEm: string;
}

export interface ResultadoDaAlteracao {
  agendamento: import("./agendamento-ocupacional").AgendamentoOcupacional;
  evento: EventoDoAgendamento;
}
