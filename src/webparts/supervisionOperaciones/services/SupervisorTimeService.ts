import type GraphService from './GraphService';
import { SharePointService } from './SharePointService';
import type { ILlamadaFlotaItem } from './SharePointService';
import { getWorkingDaysCount } from '../utils/workingDays';

const EMAIL_MINUTES_PER_MESSAGE = 3;
const TRAINING_MINUTES_PER_RECORD = 60;
const STANDARD_WORKDAY_MINUTES = 8 * 60;
const MAX_GRAPH_PAGES = 100;

export type SupervisorTimeSource =
  | 'teamsMeetings'
  | 'sharePointEmails'
  | 'trainings'
  | 'fleetCalls';

export interface ISupervisorTimeSourceError {
  source: SupervisorTimeSource;
  message: string;
}

export interface ITeamsMeetingTime {
  id: string;
  subject: string;
  startDateTime: string;
  endDateTime: string;
  durationMinutes: number;
}

export interface ISupervisorTimeAnalytics {
  startDate: string;
  endDate: string;
  workingDays: number;
  standardWorkMinutes: number;
  meetingsCount: number;
  meetingsMinutes: number;
  sentEmailsCount: number;
  emailMinutes: number;
  trainingCount: number;
  trainingMinutes: number;
  trainingMinutesPerRecord: number;
  fleetCallCount: number;
  fleetCallMinutes: number;
  totalOccupiedMinutes: number;
  availableMinutes: number;
  occupancyPercentage: number;
  availablePercentage: number;
  isOutsideStandardSchedule: boolean;
  meetings: ITeamsMeetingTime[];
  fleetCalls: ILlamadaFlotaItem[];
  sourceErrors: ISupervisorTimeSourceError[];
}

interface IGraphCollectionResponse<TItem> {
  value?: TItem[];
  '@odata.nextLink'?: string;
}

interface IGraphDateTimeZone {
  dateTime?: string;
  timeZone?: string;
}

interface IGraphOnlineMeeting {
  joinUrl?: string;
}

interface IGraphCalendarEvent {
  id?: string;
  subject?: string;
  start?: IGraphDateTimeZone;
  end?: IGraphDateTimeZone;
  isCancelled?: boolean;
  isAllDay?: boolean;
  isOnlineMeeting?: boolean;
  onlineMeetingProvider?: string;
  onlineMeeting?: IGraphOnlineMeeting;
}

interface ISourceResult<TValue> {
  value: TValue;
  error?: ISupervisorTimeSourceError;
}

interface INormalizedDateRange {
  start: Date;
  end: Date;
}

const normalizeEmail = (value: string): string =>
  value.trim().toLocaleLowerCase();

const roundToTwoDecimals = (value: number): number =>
  Math.round(value * 100) / 100;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const parseGraphDateTime = (
  value: string | undefined,
  timeZone: string | undefined
): Date | undefined => {
  if (!value) {
    return undefined;
  }

  const hasOffset = /(Z|[+-]\d{2}:\d{2})$/i.test(value);
  const normalizedValue =
    !hasOffset && timeZone?.toLocaleUpperCase() === 'UTC'
      ? `${value}Z`
      : value;
  const parsedDate = new Date(normalizedValue);

  return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
};

const isTeamsMeeting = (event: IGraphCalendarEvent): boolean => {
  const provider = event.onlineMeetingProvider
    ?.trim()
    .toLocaleLowerCase();
  const joinUrl = event.onlineMeeting?.joinUrl
    ?.trim()
    .toLocaleLowerCase() || '';
  const hasTeamsJoinUrl =
    joinUrl.indexOf('teams.microsoft.com') >= 0 ||
    joinUrl.indexOf('teams.live.com') >= 0;

  return provider === 'teamsforbusiness' ||
    provider === 'teamsforconsumer' ||
    (event.isOnlineMeeting === true && hasTeamsJoinUrl);
};

/**
 * Consolidates the supervisor's time across Microsoft Graph and SharePoint.
 *
 * Coaching records do not currently store a duration. Until that field exists,
 * each Capacitación entry is explicitly estimated as one hour.
 */
export default class SupervisorTimeService {
  public constructor(
    private readonly graphService: GraphService,
    private readonly sharePointService: SharePointService =
      new SharePointService()
  ) {}

  public async getTimeAnalytics(
    startDate: Date,
    endDate: Date,
    supervisorEmail: string
  ): Promise<ISupervisorTimeAnalytics> {
    const range = this.normalizeDateRange(startDate, endDate);
    const normalizedSupervisorEmail = normalizeEmail(supervisorEmail);

    if (!normalizedSupervisorEmail) {
      throw new Error(
        'El correo del supervisor es obligatorio para consultar la ocupación.'
      );
    }

    const [
      meetingsResult,
      emailRecordsResult,
      trainingsResult,
      fleetCallsResult
    ] = await Promise.all([
      this.captureSource(
        'teamsMeetings',
        [],
        () => this.getTeamsMeetings(range)
      ),
      this.captureSource(
        'sharePointEmails',
        [],
        () => this.sharePointService.getOcupacionCorreos(
          range.start,
          range.end,
          normalizedSupervisorEmail
        )
      ),
      this.captureSource(
        'trainings',
        [],
        () => this.sharePointService.getCapacitacionesPeriodo(
          range.start,
          range.end,
          normalizedSupervisorEmail
        )
      ),
      this.captureSource(
        'fleetCalls',
        [],
        () => this.sharePointService.getLlamadasFlota(
          range.start,
          range.end,
          normalizedSupervisorEmail
        )
      )
    ]);

    const meetings = meetingsResult.value;
    const emailRecords = emailRecordsResult.value;
    const trainings = trainingsResult.value;
    const fleetCalls = fleetCallsResult.value.filter(
      (call) =>
        normalizeEmail(call.SupervisorEmail || '') ===
          normalizedSupervisorEmail
    );
    const meetingsMinutes = meetings.reduce(
      (total, meeting) => total + meeting.durationMinutes,
      0
    );
    const sentEmailsCount = emailRecords.reduce(
      (total, record) =>
        total + Math.max(0, Number(record.CantidadCorreos) || 0),
      0
    );
    const emailMinutes = sentEmailsCount * EMAIL_MINUTES_PER_MESSAGE;
    const trainingMinutes =
      trainings.length * TRAINING_MINUTES_PER_RECORD;
    const fleetCallMinutes = fleetCalls.reduce(
      (total, call) =>
        total + Math.max(0, Number(call.DuracionMinutos) || 0),
      0
    );
    const totalOccupiedMinutes =
      meetingsMinutes +
      emailMinutes +
      trainingMinutes +
      fleetCallMinutes;
    const workingDays = getWorkingDaysCount(range.start, range.end);
    const standardWorkMinutes =
      workingDays * STANDARD_WORKDAY_MINUTES;
    const isOutsideStandardSchedule =
      standardWorkMinutes === 0 && totalOccupiedMinutes > 0;
    const occupancyPercentage = standardWorkMinutes > 0
      ? roundToTwoDecimals(
        (totalOccupiedMinutes / standardWorkMinutes) * 100
      )
      : 0;
    const availableMinutes = Math.max(
      0,
      standardWorkMinutes - totalOccupiedMinutes
    );
    const availablePercentage = standardWorkMinutes > 0
      ? roundToTwoDecimals(Math.max(0, 100 - occupancyPercentage))
      : 0;
    const sourceErrors = [
      meetingsResult.error,
      emailRecordsResult.error,
      trainingsResult.error,
      fleetCallsResult.error
    ].filter(
      (error): error is ISupervisorTimeSourceError => Boolean(error)
    );

    return {
      startDate: range.start.toISOString(),
      endDate: range.end.toISOString(),
      workingDays,
      standardWorkMinutes,
      meetingsCount: meetings.length,
      meetingsMinutes: roundToTwoDecimals(meetingsMinutes),
      sentEmailsCount,
      emailMinutes,
      trainingCount: trainings.length,
      trainingMinutes,
      trainingMinutesPerRecord: TRAINING_MINUTES_PER_RECORD,
      fleetCallCount: fleetCalls.length,
      fleetCallMinutes: roundToTwoDecimals(fleetCallMinutes),
      totalOccupiedMinutes: roundToTwoDecimals(totalOccupiedMinutes),
      availableMinutes: roundToTwoDecimals(availableMinutes),
      occupancyPercentage,
      availablePercentage,
      isOutsideStandardSchedule,
      meetings,
      fleetCalls,
      sourceErrors
    };
  }

  private normalizeDateRange(
    startDate: Date,
    endDate: Date
  ): INormalizedDateRange {
    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime())
    ) {
      throw new Error('El rango de fechas de ocupación no es válido.');
    }

    const start = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
      0,
      0,
      0,
      0
    );
    const end = new Date(
      endDate.getFullYear(),
      endDate.getMonth(),
      endDate.getDate(),
      23,
      59,
      59,
      999
    );

    if (start.getTime() > end.getTime()) {
      throw new Error(
        'La fecha de inicio no puede ser posterior a la fecha de fin.'
      );
    }

    return { start, end };
  }

  private async getTeamsMeetings(
    _range: INormalizedDateRange
  ): Promise<ITeamsMeetingTime[]> {
    // Teams/Graph is disabled in standalone mode. Future meeting data can be
    // imported into Tabla_Ocupacion by Power Automate without browser tokens.
    await Promise.resolve();
    return [];
  }

  private async captureSource<TValue>(
    source: SupervisorTimeSource,
    fallbackValue: TValue,
    operation: () => Promise<TValue>
  ): Promise<ISourceResult<TValue>> {
    try {
      return { value: await operation() };
    } catch (error: unknown) {
      return {
        value: fallbackValue,
        error: {
          source,
          message: getErrorMessage(error)
        }
      };
    }
  }
}
