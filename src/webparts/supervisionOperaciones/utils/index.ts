export { getWorkingDaysCount } from './workingDays';
export { generateAuditID } from './auditUtils';
export {
  calculateAgentProductivity,
  calculateProductivityOverlapFactor,
  calculateTeamMetricAverages,
  DEFAULT_CASE_SLA_GOAL_PERCENTAGE,
  DEFAULT_DAILY_PRODUCTIVITY_GOALS,
  DEFAULT_PRODUCTIVITY_WEIGHTS,
  PRODUCTIVITY_METRIC_KEYS,
  resolveCaseSlaValues,
  resolveCaseSlaGoalPercentage,
  resolveProductivityMetricValues
} from './productivityCalculator';
export type {
  IAgentProductivityResult,
  ICaseSlaValues,
  IProductivityAgentRecord,
  IProductivityCalculationConfig,
  IProductivityMetricBreakdown,
  IProductivityProcessBreakdown,
  IProductivityPeriodRecord,
  ITeamMetricAverages,
  ProductivityGoalMode,
  ProductivityMetricKey,
  ProductivityProcess
} from './productivityCalculator';
export {
  DEFAULT_VIEW,
  MODULE_TO_SLUG,
  SLUG_TO_MODULE,
  getHashForView,
  getSlugFromView,
  getViewFromHash,
  getViewFromSlug,
  parseHash,
  updateHashForView,
  type ViewKey
} from './routeUtils';

