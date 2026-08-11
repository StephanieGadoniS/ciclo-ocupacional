import { Activity } from "lucide-react";

interface PropriedadesDoLogotipo {
  compacto?: boolean;
}

export function LogotipoCiclo({ compacto = false }: PropriedadesDoLogotipo) {
  return (
    <div className="logotipo-ciclo" aria-label="Ciclo">
      <span className="logotipo-ciclo__simbolo" aria-hidden="true">
        <Activity size={21} strokeWidth={2.4} />
      </span>
      {!compacto && (
        <span>
          <strong>Ciclo</strong>
          <small>Saúde ocupacional</small>
        </span>
      )}
    </div>
  );
}
