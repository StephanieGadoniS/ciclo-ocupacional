-- Mantém o prazo para a primeira marcação, mas permite continuidade após agendamento/falta.
-- Execute depois de 20260807190000_simplifica_agenda_medicina_do_trabalho.sql.

begin;

create or replace function public.confirmar_horario_agendamento(
  agendamento_id uuid,
  recurso_id uuid,
  inicio timestamptz,
  fim timestamptz
)
returns public.agendamentos_ocupacionais
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  agendamento public.agendamentos_ocupacionais;
  duracao_do_recurso integer;
  inicio_local timestamp;
  fim_local timestamp;
  data_local_do_inicio date;
  data_local_do_fim date;
begin
  if public.papel_do_usuario() <> 'clinica' then
    raise exception 'Somente a clínica pode confirmar ou alterar um horário.'
      using errcode = '42501';
  end if;

  select * into agendamento
  from public.agendamentos_ocupacionais
  where id = agendamento_id
  for update;

  if agendamento.id is null
    or agendamento.clinica_id <> public.organizacao_do_usuario() then
    raise exception 'Agendamento não encontrado.' using errcode = 'P0002';
  end if;

  if agendamento.status not in ('solicitado', 'agendado', 'nao_compareceu') then
    raise exception 'O status atual não permite agendamento.' using errcode = '23514';
  end if;

  select recurso.duracao_padrao_minutos into duracao_do_recurso
  from public.recursos_clinica recurso
  where recurso.id = recurso_id
    and recurso.clinica_id = agendamento.clinica_id
    and recurso.ativo;

  if duracao_do_recurso is null then
    raise exception 'Agenda clínica inválida ou inativa.' using errcode = '23503';
  end if;

  if inicio is null or fim is null or fim <= inicio then
    raise exception 'O horário final deve ser posterior ao inicial.' using errcode = '22007';
  end if;

  if fim <> inicio + make_interval(mins => duracao_do_recurso) then
    raise exception 'A duração deve corresponder à agenda clínica selecionada.'
      using errcode = '22007';
  end if;

  if inicio < now() then
    raise exception 'Não é possível agendar um atendimento no passado.' using errcode = '22007';
  end if;

  inicio_local := inicio at time zone 'America/Sao_Paulo';
  fim_local := fim at time zone 'America/Sao_Paulo';
  data_local_do_inicio := inicio_local::date;
  data_local_do_fim := fim_local::date;

  -- O prazo continua obrigatório para a primeira marcação. Depois que o fluxo
  -- já foi agendado ou recebeu falta, a clínica pode escolher uma nova data.
  if agendamento.status = 'solicitado'
    and (
      data_local_do_inicio > agendamento.data_limite
      or data_local_do_fim > agendamento.data_limite
    ) then
    raise exception 'O primeiro atendimento não pode terminar depois do prazo ocupacional.'
      using errcode = '22007';
  end if;

  if extract(isodow from inicio_local) in (6, 7)
    or extract(isodow from fim_local) in (6, 7) then
    raise exception 'A clínica atende somente de segunda a sexta-feira.'
      using errcode = '22007';
  end if;

  if mod(extract(minute from inicio_local)::integer, 30) <> 0
    or extract(second from inicio_local) <> 0 then
    raise exception 'O horário de início deve usar intervalos de 30 minutos.'
      using errcode = '22007';
  end if;

  if data_local_do_inicio <> data_local_do_fim
    or inicio_local::time < time '08:00:00'
    or fim_local::time > time '18:00:00' then
    raise exception 'A clínica realiza atendimentos entre 08:00 e 18:00.'
      using errcode = '22007';
  end if;

  update public.agendamentos_ocupacionais
  set status = 'agendado',
      recurso_clinica_id = recurso_id,
      inicio_agendado = inicio,
      fim_agendado = fim,
      realizado_em = null,
      motivo_cancelamento = null
  where id = agendamento_id
  returning * into agendamento;

  return agendamento;
end;
$$;

revoke all on function public.confirmar_horario_agendamento(
  uuid,
  uuid,
  timestamptz,
  timestamptz
) from public;

grant execute on function public.confirmar_horario_agendamento(
  uuid,
  uuid,
  timestamptz,
  timestamptz
) to authenticated;

comment on function public.confirmar_horario_agendamento(
  uuid,
  uuid,
  timestamptz,
  timestamptz
) is
  'Agenda dentro do prazo na primeira marcação e permite reagendar fluxos já agendados ou com não comparecimento, mantendo futuro, dia útil, expediente, duração e conflito.';

commit;
