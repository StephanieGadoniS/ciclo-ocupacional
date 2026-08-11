-- Regras temporais e transições do fluxo ocupacional.
-- Execute depois de 20260805143000_cria_modelo_inicial.sql.

begin;

create or replace function public.calcular_data_limite_ocupacional(
  tipo public.tipo_exame_ocupacional,
  data_referencia date
)
returns date
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when tipo = 'demissional' then data_referencia + 10
    else data_referencia
  end;
$$;

create or replace function public.validar_nova_solicitacao_ocupacional()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  data_limite_esperada date;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  data_limite_esperada := public.calcular_data_limite_ocupacional(
    new.tipo_exame,
    new.data_referencia
  );

  if new.data_limite <> data_limite_esperada then
    raise exception 'O prazo ocupacional não corresponde ao tipo de exame e à data de referência.'
      using errcode = '23514';
  end if;

  -- O service role continua autorizado a carregar dados históricos do seed.
  if auth.uid() is not null and new.data_referencia < hoje then
    raise exception 'A data de referência não pode estar no passado.'
      using errcode = '22007';
  end if;

  return new;
end;
$$;

drop trigger if exists agendamentos_validar_nova_solicitacao
  on public.agendamentos_ocupacionais;

create trigger agendamentos_validar_nova_solicitacao
before insert on public.agendamentos_ocupacionais
for each row execute function public.validar_nova_solicitacao_ocupacional();

create or replace function public.validar_transicao_do_agendamento()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  transicao_permitida boolean;
begin
  if new.empresa_id <> old.empresa_id
    or new.clinica_id <> old.clinica_id
    or new.colaborador_id <> old.colaborador_id
    or new.tipo_exame <> old.tipo_exame
    or new.data_referencia <> old.data_referencia
    or new.data_limite <> old.data_limite
    or new.criado_por <> old.criado_por then
    raise exception 'Os dados de origem da solicitação são imutáveis.'
      using errcode = '42501';
  end if;

  if new.status = old.status then
    return new;
  end if;

  transicao_permitida := case old.status
    when 'solicitado' then new.status in ('agendado', 'cancelado')
    when 'agendado' then new.status in ('realizado', 'cancelado', 'nao_compareceu')
    when 'nao_compareceu' then new.status in ('agendado', 'cancelado')
    else false
  end;

  if not transicao_permitida then
    raise exception 'Transição de status não permitida: % -> %.', old.status, new.status
      using errcode = '23514';
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
  data_local_do_atendimento date;
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

  if inicio is null or fim is null or fim <= inicio then
    raise exception 'O horário final deve ser posterior ao inicial.' using errcode = '22007';
  end if;

  if inicio < now() then
    raise exception 'Não é possível agendar um atendimento no passado.' using errcode = '22007';
  end if;

  data_local_do_atendimento := (inicio at time zone 'America/Sao_Paulo')::date;
  if data_local_do_atendimento > agendamento.data_limite then
    raise exception 'O atendimento não pode ser agendado depois do prazo ocupacional.'
      using errcode = '22007';
  end if;

  if not exists (
    select 1
    from public.recursos_clinica recurso
    where recurso.id = recurso_id
      and recurso.clinica_id = agendamento.clinica_id
      and recurso.ativo
  ) then
    raise exception 'Agenda clínica inválida ou inativa.' using errcode = '23503';
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

create or replace function public.concluir_agendamento(agendamento_id uuid)
returns public.agendamentos_ocupacionais
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  agendamento public.agendamentos_ocupacionais;
begin
  if public.papel_do_usuario() <> 'clinica' then
    raise exception 'Somente a clínica pode concluir o exame.' using errcode = '42501';
  end if;

  select * into agendamento
  from public.agendamentos_ocupacionais
  where id = agendamento_id
    and clinica_id = public.organizacao_do_usuario()
  for update;

  if agendamento.id is null or agendamento.status <> 'agendado' then
    raise exception 'Agendamento não encontrado ou não pode ser concluído.'
      using errcode = 'P0002';
  end if;

  if agendamento.inicio_agendado > now() then
    raise exception 'O atendimento só pode ser concluído após o horário de início.'
      using errcode = '22007';
  end if;

  update public.agendamentos_ocupacionais
  set status = 'realizado', realizado_em = now()
  where id = agendamento_id
  returning * into agendamento;

  return agendamento;
end;
$$;

create or replace function public.registrar_nao_comparecimento(agendamento_id uuid)
returns public.agendamentos_ocupacionais
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  agendamento public.agendamentos_ocupacionais;
begin
  if public.papel_do_usuario() <> 'clinica' then
    raise exception 'Somente a clínica pode registrar a falta.' using errcode = '42501';
  end if;

  select * into agendamento
  from public.agendamentos_ocupacionais
  where id = agendamento_id
    and clinica_id = public.organizacao_do_usuario()
  for update;

  if agendamento.id is null or agendamento.status <> 'agendado' then
    raise exception 'Agendamento não encontrado ou não permite registrar falta.'
      using errcode = 'P0002';
  end if;

  if agendamento.inicio_agendado > now() then
    raise exception 'A ausência só pode ser registrada após o horário de início.'
      using errcode = '22007';
  end if;

  update public.agendamentos_ocupacionais
  set status = 'nao_compareceu'
  where id = agendamento_id
  returning * into agendamento;

  return agendamento;
end;
$$;

revoke all on function public.calcular_data_limite_ocupacional(
  public.tipo_exame_ocupacional,
  date
) from public;
revoke all on function public.validar_nova_solicitacao_ocupacional() from public;
revoke all on function public.confirmar_horario_agendamento(
  uuid,
  uuid,
  timestamptz,
  timestamptz
) from public;
revoke all on function public.concluir_agendamento(uuid) from public;
revoke all on function public.registrar_nao_comparecimento(uuid) from public;

grant execute on function public.confirmar_horario_agendamento(
  uuid,
  uuid,
  timestamptz,
  timestamptz
) to authenticated;
grant execute on function public.concluir_agendamento(uuid) to authenticated;
grant execute on function public.registrar_nao_comparecimento(uuid) to authenticated;

commit;
