import type { GeradorDeIdentificador } from "@/src/compartilhado/aplicacao/gerador-de-identificador";
import type { Relogio } from "@/src/compartilhado/aplicacao/relogio";
import { ErroDeDominio } from "../../dominio/erro-de-dominio";
import type { RepositorioDeAgendamentos } from "../portas/repositorio-de-agendamentos";

export interface EntradaParaAgendarExame {
  agendamentoId: string;
  recursoDaClinicaId: string;
  inicio: string;
  fim: string;
  realizadoPor: string;
}

export class AgendarExame {
  constructor(
    private readonly repositorio: RepositorioDeAgendamentos,
    private readonly geradorDeIdentificador: GeradorDeIdentificador,
    private readonly relogio: Relogio,
  ) {}

  async executar(entrada: EntradaParaAgendarExame) {
    const agendamento = await this.repositorio.buscarPorId(
      entrada.agendamentoId,
    );

    if (!agendamento) {
      throw new ErroDeDominio(
        "Agendamento não encontrado.",
        "AGENDAMENTO_NAO_ENCONTRADO",
      );
    }

    const existeConflito = await this.repositorio.existeConflitoDeHorario(
      entrada.recursoDaClinicaId,
      entrada.inicio,
      entrada.fim,
      entrada.agendamentoId,
    );

    if (existeConflito) {
      throw new ErroDeDominio(
        "A agenda Medicina do Trabalho já possui um atendimento nesse horário.",
        "HORARIO_INDISPONIVEL",
      );
    }

    const resultado = agendamento.agendar(
      {
        recursoDaClinicaId: entrada.recursoDaClinicaId,
        inicio: entrada.inicio,
        fim: entrada.fim,
      },
      {
        eventoId: this.geradorDeIdentificador.gerar(),
        realizadoPor: entrada.realizadoPor,
        ocorridoEm: this.relogio.agora().toISOString(),
      },
    );

    await this.repositorio.salvarComEvento(
      resultado.agendamento,
      resultado.evento,
    );

    return resultado.agendamento.obterDados();
  }
}
