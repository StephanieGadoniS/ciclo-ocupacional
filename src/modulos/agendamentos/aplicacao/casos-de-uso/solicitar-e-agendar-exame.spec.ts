import { beforeEach, describe, expect, it } from "vitest";
import type { GeradorDeIdentificador } from "@/src/compartilhado/aplicacao/gerador-de-identificador";
import type { Relogio } from "@/src/compartilhado/aplicacao/relogio";
import { ErroDeDominio } from "../../dominio/erro-de-dominio";
import {
  PERIODOS_PREFERIDOS,
  STATUS_DO_AGENDAMENTO,
  TIPOS_DE_EXAME,
} from "../../dominio/tipos-do-agendamento";
import { RepositorioDeAgendamentosEmMemoria } from "../../infraestrutura/repositorio-de-agendamentos-em-memoria";
import { AgendarExame } from "./agendar-exame";
import { SolicitarAgendamento } from "./solicitar-agendamento";

class GeradorSequencial implements GeradorDeIdentificador {
  private sequencia = 0;

  gerar(): string {
    this.sequencia += 1;
    return `id-${this.sequencia}`;
  }
}

class RelogioFixo implements Relogio {
  agora(): Date {
    return new Date("2026-08-05T12:00:00.000Z");
  }
}

describe("Fluxo de solicitar e agendar exame", () => {
  let repositorio: RepositorioDeAgendamentosEmMemoria;
  let gerador: GeradorSequencial;
  let solicitar: SolicitarAgendamento;
  let agendar: AgendarExame;

  beforeEach(() => {
    repositorio = new RepositorioDeAgendamentosEmMemoria();
    gerador = new GeradorSequencial();
    solicitar = new SolicitarAgendamento(
      repositorio,
      gerador,
      new RelogioFixo(),
    );
    agendar = new AgendarExame(repositorio, gerador, new RelogioFixo());
  });

  it("persiste a solicitação e seu primeiro evento de auditoria", async () => {
    const resultado = await solicitar.executar({
      empresaId: "empresa-1",
      clinicaId: "clinica-1",
      colaboradorId: "colaborador-1",
      tipoDeExame: TIPOS_DE_EXAME.PERIODICO,
      dataDeReferencia: "2026-08-20",
      periodoPreferido: PERIODOS_PREFERIDOS.QUALQUER,
      solicitadoPor: "usuario-rh",
    });

    expect(resultado.status).toBe(STATUS_DO_AGENDAMENTO.SOLICITADO);
    expect(repositorio.eventos).toHaveLength(1);
  });

  it("impede duas solicitações abertas equivalentes", async () => {
    const entrada = {
      empresaId: "empresa-1",
      clinicaId: "clinica-1",
      colaboradorId: "colaborador-1",
      tipoDeExame: TIPOS_DE_EXAME.PERIODICO,
      dataDeReferencia: "2026-08-20",
      periodoPreferido: PERIODOS_PREFERIDOS.QUALQUER,
      solicitadoPor: "usuario-rh",
    } as const;

    await solicitar.executar(entrada);

    await expect(solicitar.executar(entrada)).rejects.toBeInstanceOf(
      ErroDeDominio,
    );
  });

  it("impede sobreposição de horários na mesma agenda clínica", async () => {
    const primeiro = await solicitar.executar({
      empresaId: "empresa-1",
      clinicaId: "clinica-1",
      colaboradorId: "colaborador-1",
      tipoDeExame: TIPOS_DE_EXAME.ADMISSIONAL,
      dataDeReferencia: "2026-08-20",
      periodoPreferido: PERIODOS_PREFERIDOS.MANHA,
      solicitadoPor: "usuario-rh",
    });
    const segundo = await solicitar.executar({
      empresaId: "empresa-1",
      clinicaId: "clinica-1",
      colaboradorId: "colaborador-2",
      tipoDeExame: TIPOS_DE_EXAME.ADMISSIONAL,
      dataDeReferencia: "2026-08-20",
      periodoPreferido: PERIODOS_PREFERIDOS.MANHA,
      solicitadoPor: "usuario-rh",
    });

    await agendar.executar({
      agendamentoId: primeiro.id,
      recursoDaClinicaId: "agenda-medica-1",
      inicio: "2026-08-10T09:00:00-03:00",
      fim: "2026-08-10T09:30:00-03:00",
      realizadoPor: "usuario-clinica",
    });

    await expect(
      agendar.executar({
        agendamentoId: segundo.id,
        recursoDaClinicaId: "agenda-medica-1",
        inicio: "2026-08-10T09:15:00-03:00",
        fim: "2026-08-10T09:45:00-03:00",
        realizadoPor: "usuario-clinica",
      }),
    ).rejects.toMatchObject({ codigo: "HORARIO_INDISPONIVEL" });
  });
});
