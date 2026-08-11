-- Padroniza as agendas de demonstração em 30 minutos e protege o expediente.
-- Execute depois de 20260807150000_bloqueia_finais_de_semana.sql.

begin;

update public.recursos_clinica
set duracao_padrao_minutos = 30,
    atualizado_em = now()
where id in (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002'
);

-- Mantém os registros históricos da carga de demonstração coerentes com 30 minutos.
update public.agendamentos_ocupacionais
set fim_agendado = inicio_agendado + interval '30 minutes'
where id in (
  '40000000-0000-4000-8000-000000000004',
  '40000000-0000-4000-8000-000000000005'
)
  and inicio_agendado is not null;

create or replace function public.validar_grade_de_agendamento()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  inicio_local timestamp;
  fim_local timestamp;
begin
  if new.inicio_agendado is null or new.fim_agendado is null then
    return new;
  end if;

  inicio_local := new.inicio_agendado at time zone 'America/Sao_Paulo';
  fim_local := new.fim_agendado at time zone 'America/Sao_Paulo';

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

  if inicio_local::date <> fim_local::date
    or inicio_local::time < time '08:00:00'
    or fim_local::time > time '18:00:00' then
    raise exception 'A clínica realiza atendimentos entre 08:00 e 18:00.'
      using errcode = '22007';
  end if;

  return new;
end;
$$;

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

  if data_local_do_inicio > agendamento.data_limite
    or data_local_do_fim > agendamento.data_limite then
    raise exception 'O atendimento não pode terminar depois do prazo ocupacional.'
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

revoke all on function public.validar_grade_de_agendamento() from public;
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

comment on function public.validar_grade_de_agendamento() is
  'Impede atendimentos fora de dias úteis, da grade de 30 minutos e do expediente entre 08:00 e 18:00.';

commit;
