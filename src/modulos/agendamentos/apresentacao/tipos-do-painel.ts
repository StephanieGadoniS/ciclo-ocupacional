import type {
  DadosDoAgendamentoOcupacional,
  PeriodoPreferido,
  TipoDeExame,
} from "../dominio/tipos-do-agendamento";
export type { PerfilDeAcesso } from "@/src/modulos/acesso/dominio/perfil-de-acesso";

export interface ColaboradorParaSelecao {
  id: string;
  nome: string;
  cpfMascarado: string;
  matricula: string;
  cargo: string;
  iniciais: string;
  cor: string;
}

export interface AgendamentoParaPainel
  extends DadosDoAgendamentoOcupacional {
  colaborador: ColaboradorParaSelecao;
  empresaNome: string;
  clinicaNome: string;
  recursoDaClinicaNome: string | null;
}

export interface RecursoDaClinicaParaSelecao {
  id: string;
  nome: string;
  duracaoEmMinutos: number;
}

export interface ClinicaParaSelecao {
  id: string;
  nome: string;
}

export interface EventoDoAgendamentoParaPainel {
  id: string;
  agendamentoId: string;
  statusAnterior: DadosDoAgendamentoOcupacional["status"] | null;
  statusAtual: DadosDoAgendamentoOcupacional["status"];
  descricao: string;
  realizadoPorNome: string;
  ocorridoEm: string;
}

export interface DadosDoPainel {
  agendamentos: AgendamentoParaPainel[];
  colaboradores: ColaboradorParaSelecao[];
  recursosDaClinica: RecursoDaClinicaParaSelecao[];
  clinicasRelacionadas: ClinicaParaSelecao[];
  eventosDoAgendamento: EventoDoAgendamentoParaPainel[];
}

export interface DadosDaNovaSolicitacao {
  colaboradorId: string;
  tipoDeExame: TipoDeExame;
  dataDeReferencia: string;
  periodoPreferido: PeriodoPreferido;
  diasDeAfastamento: number | null;
  observacoes: string;
}

export interface DadosDoNovoHorario {
  recursoDaClinicaId: string;
  recursoDaClinicaNome: string;
  inicio: string;
  fim: string;
}
