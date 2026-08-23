import * as React from 'react';
import {
  DatePicker,
  Dropdown,
  type IDropdownOption,
  MessageBar,
  MessageBarType,
  PrimaryButton,
  Spinner,
  SpinnerSize,
  Stack,
  Text,
  TextField
} from '@fluentui/react';
import { CalendarDays } from 'lucide-react';

import { cloudDbClient } from '../../../../services/CloudDbClient';
import { useRBAC } from '../../../../auth/RBACContext';
import type { IEmpleadoDelMes } from '../../../../types';
import type { IDirectReport } from '../../services/GraphService';
import SharePointService, {
  type AusenciaType,
  type IRegistrarAusenciaData
} from '../../services/SharePointService';
import AgentComboBox from '../AgentSelector/AgentComboBox';
import { PageHeader, SurfaceCard } from '../Common';
import styles from './AusenciasForm.module.scss';

export interface IAusenciasFormProps {
  availableAgents: ReadonlyArray<IDirectReport>;
  isLoadingAgents?: boolean;
  onSaved?: () => void;
}

const ABSENCE_TYPE_OPTIONS: ReadonlyArray<IDropdownOption> = [
  { key: 'Vacaciones', text: 'Vacaciones' },
  {
    key: 'Día Libre Cumpleaños',
    text: 'Día Libre Cumpleaños'
  },
  {
    key: 'Día Libre Empleado del Mes',
    text: 'Día Libre Empleado del Mes'
  },
  {
    key: 'Licencia / Incapacidad',
    text: 'Licencia'
  }
];

const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const getNombreMes = (mes: number): string =>
  NOMBRES_MESES[mes - 1] || `Mes ${mes}`;

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS: ReadonlyArray<IDropdownOption> = [
  { key: currentYear - 2, text: String(currentYear - 2) },
  { key: currentYear - 1, text: String(currentYear - 1) },
  { key: currentYear, text: String(currentYear) },
  { key: currentYear + 1, text: String(currentYear + 1) },
  { key: currentYear + 2, text: String(currentYear + 2) }
];

const normalizeIdentity = (value?: string): string =>
  value?.trim().toLocaleLowerCase() || '';

const getAgentKey = (agent: IDirectReport): string => {
  const email = normalizeIdentity(agent.email);

  if (email) {
    return `email:${email}`;
  }

  const objectId = normalizeIdentity(agent.id);

  if (objectId) {
    return `object:${objectId}`;
  }

  return `name:${normalizeIdentity(agent.name)}`;
};

const isAbsenceType = (value: string): value is AusenciaType =>
  ABSENCE_TYPE_OPTIONS.some((option) => option.key === value);

const AusenciasForm: React.FC<IAusenciasFormProps> = ({
  availableAgents,
  isLoadingAgents = false,
  onSaved
}) => {
  const { hasPermission } = useRBAC();
  const canRequestAbsence = hasPermission('modulo:ausencias:solicitar');
  const sharePointService = React.useMemo(() => new SharePointService(), []);
  const [selectedAgent, setSelectedAgent] = React.useState<
    IDirectReport | undefined
  >();
  const [tipoAusencia, setTipoAusencia] = React.useState<
    AusenciaType | undefined
  >();
  const [fechaInicio, setFechaInicio] = React.useState<Date>(new Date());
  const [fechaFin, setFechaFin] = React.useState<Date>(new Date());
  const [comentarios, setComentarios] = React.useState<string>('');
  const [periodoAnio, setPeriodoAnio] = React.useState<number>(currentYear);
  const [pendingAwards, setPendingAwards] = React.useState<IEmpleadoDelMes[]>([]);
  const [isLoadingAwards, setIsLoadingAwards] = React.useState<boolean>(false);
  const [selectedAwardId, setSelectedAwardId] = React.useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [successMessage, setSuccessMessage] = React.useState<string>('');
  const [errorMessage, setErrorMessage] = React.useState<string>('');

  React.useEffect(() => {
    let isMounted = true;
    if (tipoAusencia === 'Día Libre Empleado del Mes' && selectedAgent?.email) {
      setIsLoadingAwards(true);
      setSelectedAwardId(undefined);
      cloudDbClient
        .getPremiosEmpleadoMesPendientes(selectedAgent.email)
        .then((awards) => {
          if (isMounted) {
            setPendingAwards(awards);
            if (awards.length > 0) {
              setSelectedAwardId(String(awards[0].id));
            }
          }
        })
        .catch((err: unknown) => {
          console.warn('Error loading pending awards:', err);
          if (isMounted) setPendingAwards([]);
        })
        .finally(() => {
          if (isMounted) setIsLoadingAwards(false);
        });
    } else {
      setPendingAwards([]);
      setSelectedAwardId(undefined);
    }
    return () => {
      isMounted = false;
    };
  }, [tipoAusencia, selectedAgent]);

  const agentOptions = React.useMemo(() => {
    const optionsByIdentity = new Map<
      string,
      IDropdownOption<IDirectReport>
    >();

    availableAgents.forEach((agent) => {
      const key = getAgentKey(agent);

      if (!optionsByIdentity.has(key)) {
        optionsByIdentity.set(key, {
          key,
          text: agent.email
            ? `${agent.name} · ${agent.email}`
            : agent.name,
          data: agent
        });
      }
    });

    return Array.from(optionsByIdentity.values())
      .sort((left, right) => left.text.localeCompare(right.text, 'es'));
  }, [availableAgents]);

  const clearMessages = (): void => {
    setSuccessMessage('');
    setErrorMessage('');
  };

  const submitAbsence = async (): Promise<void> => {
    if (!canRequestAbsence) {
      setErrorMessage('No posee permiso para solicitar ausencias.');
      return;
    }
    clearMessages();

    if (!selectedAgent) {
      setErrorMessage('Seleccione el colaborador que estará ausente.');
      return;
    }

    if (!tipoAusencia) {
      setErrorMessage('Seleccione el tipo de ausencia.');
      return;
    }

    if (tipoAusencia === 'Día Libre Empleado del Mes') {
      if (pendingAwards.length === 0) {
        setErrorMessage('El colaborador no tiene días libres pendientes por Empleado del Mes.');
        return;
      }
      if (!selectedAwardId) {
        setErrorMessage('Seleccione el premio de Empleado del Mes a reclamar.');
        return;
      }
    }

    if (
      Number.isNaN(fechaInicio.getTime()) ||
      Number.isNaN(fechaFin.getTime())
    ) {
      setErrorMessage('Seleccione un rango de fechas válido.');
      return;
    }

    if (fechaInicio.getTime() > fechaFin.getTime()) {
      setErrorMessage(
        'La fecha de inicio no puede ser posterior a la fecha de fin.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const data: IRegistrarAusenciaData = {
        agente: selectedAgent.name.trim(),
        agenteEmail: selectedAgent.email.trim(),
        agenteObjectId: selectedAgent.id.trim(),
        tipoAusencia,
        fechaInicio,
        fechaFin,
        comentarios: comentarios.trim(),
        periodoAnio: tipoAusencia === 'Vacaciones' ? periodoAnio : undefined,
        premioEmpleadoMesId: tipoAusencia === 'Día Libre Empleado del Mes' ? selectedAwardId : undefined
      };

      await sharePointService.registrarAusencia(data);

      setSelectedAgent(undefined);
      setTipoAusencia(undefined);
      setFechaInicio(new Date());
      setFechaFin(new Date());
      setComentarios('');
      setSelectedAwardId(undefined);
      setPendingAwards([]);
      setSuccessMessage('Ausencia registrada correctamente.');
      onSaved?.();
    } catch (error: unknown) {
      const detail = error instanceof Error
        ? error.message
        : 'Ocurrió un error inesperado al registrar la ausencia.';
      setErrorMessage(detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    submitAbsence().catch((error: unknown) => {
      const detail = error instanceof Error
        ? error.message
        : 'Ocurrió un error inesperado al registrar la ausencia.';
      setErrorMessage(detail);
      setIsSubmitting(false);
    });
  };

  const handleStartDateChange = (date?: Date | null): void => {
    if (!date) {
      return;
    }

    setFechaInicio(date);

    if (date.getTime() > fechaFin.getTime()) {
      setFechaFin(date);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <Stack tokens={{ childrenGap: 18 }}>
        <PageHeader
          icon={<CalendarDays aria-hidden="true" size={24} />}
          subtitle="Programa vacaciones, licencias y días libres sin perder visibilidad sobre la capacidad del equipo."
          title="Control de Ausencias y Planificación"
        />

        {successMessage && (
          <MessageBar messageBarType={MessageBarType.success}>
            {successMessage}
          </MessageBar>
        )}

        {errorMessage && (
          <MessageBar messageBarType={MessageBarType.error}>
            {errorMessage}
          </MessageBar>
        )}

        <SurfaceCard className={styles.formCard}>
          <Stack tokens={{ childrenGap: 18 }}>
          {isLoadingAgents && (
            <Spinner
              label="Cargando colaboradores disponibles..."
              size={SpinnerSize.small}
            />
          )}

          {!isLoadingAgents && agentOptions.length === 0 && (
            <MessageBar messageBarType={MessageBarType.warning}>
              No hay colaboradores disponibles dentro de su alcance actual.
            </MessageBar>
          )}

          <AgentComboBox
            agents={availableAgents}
            disabled={isSubmitting || isLoadingAgents}
            label="Agente"
            onAgentChange={setSelectedAgent}
            placeholder="Busque por nombre o correo"
            required
            selectedAgent={selectedAgent}
          />

          <Dropdown
            disabled={isSubmitting}
            label="Tipo de ausencia"
            onChange={(_, option) => {
              const selectedValue = String(option?.key || '');
              setTipoAusencia(
                isAbsenceType(selectedValue) ? selectedValue : undefined
              );
            }}
            options={[...ABSENCE_TYPE_OPTIONS]}
            placeholder="Seleccione el tipo de ausencia"
            required
            selectedKey={tipoAusencia}
          />

          {tipoAusencia === 'Vacaciones' && (
            <Dropdown
              disabled={isSubmitting}
              label="Año del Período Correspondiente"
              onChange={(_, option) => setPeriodoAnio(Number(option?.key))}
              options={[...YEAR_OPTIONS]}
              placeholder="Seleccione el año del período"
              required
              selectedKey={periodoAnio}
            />
          )}

          {tipoAusencia === 'Día Libre Empleado del Mes' && (
            <React.Fragment>
              {isLoadingAwards ? (
                <Spinner label="Buscando premios pendientes de Empleado del Mes..." size={SpinnerSize.small} />
              ) : pendingAwards.length === 0 ? (
                <MessageBar messageBarType={MessageBarType.warning}>
                  El colaborador no tiene días libres pendientes por Empleado del Mes.
                </MessageBar>
              ) : (
                <Dropdown
                  disabled={isSubmitting}
                  label="Premio Empleado del Mes a Reclamar"
                  onChange={(_, option) => setSelectedAwardId(String(option?.key || ''))}
                  options={pendingAwards.map((award) => ({
                    key: String(award.id),
                    text: `Día Libre por Premiación de ${getNombreMes(award.mes)} ${award.anio}`
                  }))}
                  placeholder="Seleccione el premio a reclamar"
                  required
                  selectedKey={selectedAwardId}
                />
              )}
            </React.Fragment>
          )}

          <Stack horizontal wrap tokens={{ childrenGap: 18 }}>
            <Stack.Item className={styles.dateField} grow>
              <DatePicker
                disabled={isSubmitting}
                firstDayOfWeek={1}
                label="Fecha Inicio"
                onSelectDate={handleStartDateChange}
                placeholder="Seleccione la fecha de inicio"
                value={fechaInicio}
              />
            </Stack.Item>

            <Stack.Item className={styles.dateField} grow>
              <DatePicker
                disabled={isSubmitting}
                firstDayOfWeek={1}
                label="Fecha Fin"
                minDate={fechaInicio}
                onSelectDate={(date) => {
                  if (date) {
                    setFechaFin(date);
                  }
                }}
                placeholder="Seleccione la fecha de fin"
                value={fechaFin}
              />
            </Stack.Item>
          </Stack>

          <TextField
            disabled={isSubmitting}
            label="Comentarios"
            multiline
            onChange={(_, value) => setComentarios(value || '')}
            placeholder="Agregue observaciones relevantes para la planificación"
            resizable={false}
            rows={4}
            value={comentarios}
          />

          <Stack
            horizontal
            verticalAlign="center"
            tokens={{ childrenGap: 12 }}
          >
            <PrimaryButton
              disabled={
                !canRequestAbsence ||
                isSubmitting ||
                isLoadingAgents ||
                agentOptions.length === 0
              }
              iconProps={{ iconName: 'Save' }}
              text={isSubmitting ? 'Guardando...' : 'Guardar Ausencia'}
              type="submit"
            />

            {isSubmitting && (
              <Spinner
                ariaLive="assertive"
                label="Registrando ausencia..."
                size={SpinnerSize.small}
              />
            )}
          </Stack>
          </Stack>
        </SurfaceCard>
      </Stack>
    </form>
  );
};

export default AusenciasForm;
