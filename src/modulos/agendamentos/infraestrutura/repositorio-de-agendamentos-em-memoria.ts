import { AgendamentoOcupacional } from "../dominio/agendamento-ocupacional";
import {
  STATUS_DO_AGENDAMENTO,
  type DadosDoAgendamentoOcupacional,
  type EventoDoAgendamento,
  type StatusDoAgendamento,
  type TipoDeExame,
} from "../dominio/tipos-do-agendamento";
import type { RepositorioDeAgendamentos } from "../aplicacao/portas/repositorio-de-agendamentos";

const STATUS_ABERTOS: ReadonlySet<StatusDoAgendamento> = new Set([
  STATUS_DO_AGENDAMENTO.SOLICITADO,
  STATUS_DO_AGENDAMENTO.AGENDADO,
]);

export class RepositorioDeAgendamentosEmMemoria
  implements RepositorioDeAgendamentos
{
  readonly agendamentos = new Map<string, DadosDoAgendamentoOcupacional>();
  readonly eventos: EventoDoAgendamento[] = [];

  async buscarPorId(id: string): Promise<AgendamentoOcupacional | null> {
    const dados = this.agendamentos.get(id);
    return dados ? AgendamentoOcupacional.restaurar(dados) : null;
  }

  async existeSolicitacaoAberta(
    colaboradorId: string,
    tipoDeExame: TipoDeExame,
    dataDeReferencia: string,
  ): Promise<boolean> {
    return [...this.agendamentos.values()].some(
      (agendamento) =>
        agendamento.colaboradorId === colaboradorId &&
        agendamento.tipoDeExame === tipoDeExame &&
        agendamento.dataDeReferencia === dataDeReferencia &&
        STATUS_ABERTOS.has(agendamento.status),
    );
  }

  async existeConflitoDeHorario(
    recursoDaClinicaId: string,
    inicio: string,
    fim: string,
    agendamentoIgnoradoId?: string,
  ): Promise<boolean> {
    const inicioNovo = Date.parse(inicio);
    const fimNovo = Date.parse(fim);

    return [...this.agendamentos.values()].some((agendamento) => {
      if (
        agendamento.id === agendamentoIgnoradoId ||
        agendamento.recursoDaClinicaId !== recursoDaClinicaId ||
        agendamento.status !== STATUS_DO_AGENDAMENTO.AGENDADO ||
        !agendamento.inicioAgendado ||
        !agendamento.fimAgendado
      ) {
        return false;
      }

      return (
        inicioNovo < Date.parse(agendamento.fimAgendado) &&
        fimNovo > Date.parse(agendamento.inicioAgendado)
      );
    });
  }

  async salvarComEvento(
    agendamento: AgendamentoOcupacional,
    evento: EventoDoAgendamento,
  ): Promise<void> {
    const dados = agendamento.obterDados();
    this.agendamentos.set(dados.id, { ...dados });
    this.eventos.push({ ...evento });
  }
}
