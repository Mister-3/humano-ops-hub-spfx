import * as React from 'react';
import {
  DatePicker,
  DefaultButton,
  Dropdown,
  type IDropdownOption,
  MessageBar,
  MessageBarType,
  PrimaryButton,
  Spinner,
  SpinnerSize,
  Stack,
  Text
} from '@fluentui/react';

import type { IFalta, RoleType } from '../../models/AppModels';
import type GraphService from '../../services/GraphService';
import SharePointService, {
  type IRegistrarFaltaData
} from '../../services/SharePointService';
import styles from './FaltasForm.module.scss';

export interface IFaltasFormProps {
  graphService: GraphService;
  userRole: RoleType;
}

const ASSISTANT_CATEGORY = 'Error en proceso';

const categoryOptions: IDropdownOption[] = [
  { key: 'Tardanza', text: 'Tardanza' },
  { key: 'Ausencia Injustificada', text: 'Ausencia Injustificada' },
  { key: ASSISTANT_CATEGORY, text: ASSISTANT_CATEGORY },
  { key: 'Violación de Política', text: 'Violación de Política' }
];

const impactOptions: IDropdownOption[] = [
  { key: 'Bajo', text: 'Bajo' },
  { key: 'Medio', text: 'Medio' },
  { key: 'Crítico', text: 'Crítico' }
];

const FaltasForm: React.FC<IFaltasFormProps> = ({ graphService, userRole }) => {
  const isAssistant = userRole === 'Asistente';
  const canRegisterOfficial = userRole === 'Supervisor' || userRole === 'Admin';
  const canSubmit = isAssistant || canRegisterOfficial;

  const [agente, setAgente] = React.useState<string>('');
  const [fecha, setFecha] = React.useState<Date | null>(new Date());
  const [categoria, setCategoria] = React.useState<string>(
    isAssistant ? ASSISTANT_CATEGORY : ''
  );
  const [nivelImpacto, setNivelImpacto] = React.useState<string>('');
  const [evidenciaFile, setEvidenciaFile] = React.useState<File | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string>('');
  const [errorMessage, setErrorMessage] = React.useState<string>('');
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [teamOptions, setTeamOptions] = React.useState<IDropdownOption[]>([]);
  const [isLoadingTeam, setIsLoadingTeam] = React.useState<boolean>(true);
  const [teamErrorMessage, setTeamErrorMessage] = React.useState<string>('');
  const successTimerRef = React.useRef<number | undefined>(undefined);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const sharePointService = React.useMemo(() => new SharePointService(), []);

  React.useEffect(() => {
    let isMounted = true;

    const loadTeam = async (): Promise<void> => {
      try {
        const directReports = await graphService.getDirectReports();

        if (isMounted) {
          setTeamOptions(directReports.map((item) => ({
            key: item.name,
            text: item.name
          })));
        }
      } catch (error: unknown) {
        if (isMounted) {
          const detail = error instanceof Error
            ? error.message
            : 'No fue posible cargar el equipo del supervisor.';
          setTeamErrorMessage(detail);
        }
      } finally {
        if (isMounted) {
          setIsLoadingTeam(false);
        }
      }
    };

    loadTeam().catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [graphService]);

  React.useEffect(() => {
    if (isAssistant) {
      setCategoria(ASSISTANT_CATEGORY);
    }
  }, [isAssistant]);

  React.useEffect(() => () => {
    if (successTimerRef.current !== undefined) {
      window.clearTimeout(successTimerRef.current);
    }
  }, []);

  const submitFalta = async (): Promise<void> => {
    setErrorMessage('');
    setSuccessMessage('');

    if (!agente.trim() || !fecha || !categoria || !nivelImpacto) {
      setErrorMessage('Complete los campos obligatorios antes de continuar.');
      return;
    }

    setIsSubmitting(true);

    try {
      const estado: IFalta['estado'] = isAssistant ? 'Borrador' : 'Aprobado';
      const faltaData: IRegistrarFaltaData = {
        agente: agente.trim(),
        fecha,
        categoria,
        impacto: nivelImpacto,
        estado,
        rolOriginador: userRole
      };

      await sharePointService.registrarFalta(faltaData, evidenciaFile);

      setAgente('');
      setFecha(new Date());
      setCategoria(isAssistant ? ASSISTANT_CATEGORY : '');
      setNivelImpacto('');
      setEvidenciaFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setSuccessMessage('Falta registrada correctamente');

      if (successTimerRef.current !== undefined) {
        window.clearTimeout(successTimerRef.current);
      }

      successTimerRef.current = window.setTimeout(() => {
        setSuccessMessage('');
      }, 4000);
    } catch (error: unknown) {
      const detail = error instanceof Error
        ? error.message
        : 'Ocurrió un error inesperado al guardar la falta.';
      setErrorMessage(detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    submitFalta().catch((error: unknown) => {
      const detail = error instanceof Error
        ? error.message
        : 'Ocurrió un error inesperado al guardar la falta.';
      setErrorMessage(detail);
      setIsSubmitting(false);
    });
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <Stack
        className={styles.formCard}
        tokens={{ childrenGap: 15 }}
      >
        <Text className={styles.title} variant="xLarge">
          Registro de faltas operativas
        </Text>

        {!canSubmit && (
          <MessageBar messageBarType={MessageBarType.warning}>
            El rol {userRole} posee acceso de consulta, pero no puede registrar faltas.
          </MessageBar>
        )}

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

        {teamErrorMessage && (
          <MessageBar messageBarType={MessageBarType.warning}>
            {teamErrorMessage}
          </MessageBar>
        )}

        {isLoadingTeam && (
          <Spinner label="Cargando equipo del supervisor..." size={SpinnerSize.small} />
        )}

        <Dropdown
          disabled={!canSubmit || isSubmitting || isLoadingTeam}
          label="Agente"
          onChange={(_, option) => setAgente(String(option?.key || ''))}
          options={teamOptions}
          placeholder="Seleccione un reporte directo"
          required
          selectedKey={agente || undefined}
        />

        <DatePicker
          disabled={!canSubmit || isSubmitting}
          firstDayOfWeek={1}
          label="Fecha"
          onSelectDate={(selectedDate) => {
            setFecha(selectedDate || null);
          }}
          placeholder="Seleccione una fecha"
          value={fecha || undefined}
        />

        <Dropdown
          disabled={!canSubmit || isAssistant || isSubmitting}
          label="Categoría"
          onChange={(_, option) => setCategoria(String(option?.key || ''))}
          options={isAssistant
            ? categoryOptions.filter((option) => option.key === ASSISTANT_CATEGORY)
            : categoryOptions}
          required
          selectedKey={categoria}
        />

        <Dropdown
          disabled={!canSubmit || isSubmitting}
          label="Nivel de Impacto"
          onChange={(_, option) => setNivelImpacto(String(option?.key || ''))}
          options={impactOptions}
          required
          selectedKey={nivelImpacto}
        />

        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 12 }}>
          <input
            accept="image/*,.pdf,.msg,.eml"
            aria-label="Seleccionar archivo de evidencia"
            disabled={!canSubmit || isSubmitting}
            onChange={(event) => {
              setEvidenciaFile(event.currentTarget.files?.[0] || null);
            }}
            ref={fileInputRef}
            style={{ display: 'none' }}
            type="file"
          />
          <DefaultButton
            disabled={!canSubmit || isSubmitting}
            onClick={() => fileInputRef.current?.click()}
            text="Adjuntar Evidencia (Foto/Correo)"
            type="button"
          />
          {evidenciaFile && (
            <Text className={styles.fileName}>
              Archivo seleccionado: {evidenciaFile.name}
            </Text>
          )}
        </Stack>

        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 12 }}>
          <PrimaryButton
            disabled={!canSubmit || isSubmitting || isLoadingTeam}
            text={isAssistant
              ? 'Enviar para Revisión (Borrador)'
              : 'Registrar Falta Oficial'}
            type="submit"
          />
          {isSubmitting && (
            <Spinner
              label="Guardando..."
              size={SpinnerSize.small}
            />
          )}
        </Stack>
      </Stack>
    </form>
  );
};

export default FaltasForm;
