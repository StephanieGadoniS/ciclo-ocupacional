import { combinarClasses } from "@/src/compartilhado/apresentacao/combinar-classes";
import {
  ROTULOS_DOS_STATUS,
  type StatusDoAgendamento,
} from "@/src/modulos/agendamentos/dominio/tipos-do-agendamento";

export function EtiquetaStatus({ status }: { status: StatusDoAgendamento }) {
  return (
    <span className={combinarClasses("etiqueta-status", `status-${status}`)}>
      <span aria-hidden="true" />
      {ROTULOS_DOS_STATUS[status]}
    </span>
  );
}
