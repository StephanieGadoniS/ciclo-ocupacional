import type { GeradorDeIdentificador } from "@/src/compartilhado/aplicacao/gerador-de-identificador";
import type { Relogio } from "@/src/compartilhado/aplicacao/relogio";
import { ErroDeDominio } from "../../dominio/erro-de-dominio";
import type { RepositorioDeAgendamentos } from "../portas/repositorio-de-agendamentos";

export class ConcluirExame {
  constructor(
    private readonly repositorio: RepositorioDeAgendamentos,
    private readonly geradorDeIdentificador: GeradorDeIdentificador,
    private readonly relogio: Relogio,
  ) {}

  async executar(agendamentoId: string, realizadoPor: string) {
    const agendamento = await this.repositorio.buscarPorId(agendamentoId);

    if (!agendamento) {
      throw new ErroDeDominio(
        "Agendamento não encontrado.",
        "AGENDAMENTO_NAO_ENCONTRADO",
      );
    }

    const resultado = agendamento.concluir({
      eventoId: this.geradorDeIdentificador.gerar(),
      realizadoPor,
      ocorridoEm: this.relogio.agora().toISOString(),
    });

    await this.repositorio.salvarComEvento(
      resultado.agendamento,
      resultado.evento,
    );

    return resultado.agendamento.obterDados();
  }
}
