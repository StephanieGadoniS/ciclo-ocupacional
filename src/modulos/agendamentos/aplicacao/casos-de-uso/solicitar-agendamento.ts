import type { GeradorDeIdentificador } from "@/src/compartilhado/aplicacao/gerador-de-identificador";
import type { Relogio } from "@/src/compartilhado/aplicacao/relogio";
import { AgendamentoOcupacional } from "../../dominio/agendamento-ocupacional";
import { ErroDeDominio } from "../../dominio/erro-de-dominio";
import type {
  PeriodoPreferido,
  TipoDeExame,
} from "../../dominio/tipos-do-agendamento";
import type { RepositorioDeAgendamentos } from "../portas/repositorio-de-agendamentos";

export interface EntradaParaSolicitarAgendamento {
  empresaId: string;
  clinicaId: string;
  colaboradorId: string;
  tipoDeExame: TipoDeExame;
  dataDeReferencia: string;
  periodoPreferido: PeriodoPreferido;
  diasDeAfastamento?: number | null;
  observacoes?: string | null;
  solicitadoPor: string;
}

export class SolicitarAgendamento {
  constructor(
    private readonly repositorio: RepositorioDeAgendamentos,
    private readonly geradorDeIdentificador: GeradorDeIdentificador,
    private readonly relogio: Relogio,
  ) {}

  async executar(entrada: EntradaParaSolicitarAgendamento) {
    const jaExiste = await this.repositorio.existeSolicitacaoAberta(
      entrada.colaboradorId,
      entrada.tipoDeExame,
      entrada.dataDeReferencia,
    );

    if (jaExiste) {
      throw new ErroDeDominio(
        "Já existe uma solicitação aberta desse exame para o colaborador.",
        "SOLICITACAO_DUPLICADA",
      );
    }

    const criadoEm = this.relogio.agora().toISOString();
    const resultado = AgendamentoOcupacional.solicitar(
      {
        ...entrada,
        id: this.geradorDeIdentificador.gerar(),
        criadoPor: entrada.solicitadoPor,
        criadoEm,
      },
      this.geradorDeIdentificador.gerar(),
    );

    await this.repositorio.salvarComEvento(
      resultado.agendamento,
      resultado.evento,
    );

    return resultado.agendamento.obterDados();
  }
}
