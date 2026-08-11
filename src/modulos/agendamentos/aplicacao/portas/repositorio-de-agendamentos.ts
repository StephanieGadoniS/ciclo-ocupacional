import type { AgendamentoOcupacional } from "../../dominio/agendamento-ocupacional";
import type {
  EventoDoAgendamento,
  TipoDeExame,
} from "../../dominio/tipos-do-agendamento";

export interface RepositorioDeAgendamentos {
  buscarPorId(id: string): Promise<AgendamentoOcupacional | null>;

  existeSolicitacaoAberta(
    colaboradorId: string,
    tipoDeExame: TipoDeExame,
    dataDeReferencia: string,
  ): Promise<boolean>;

  existeConflitoDeHorario(
    recursoDaClinicaId: string,
    inicio: string,
    fim: string,
    agendamentoIgnoradoId?: string,
  ): Promise<boolean>;

  salvarComEvento(
    agendamento: AgendamentoOcupacional,
    evento: EventoDoAgendamento,
  ): Promise<void>;
}
