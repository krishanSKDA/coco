import type { Forecast, InterventionDecision } from '@/types'
import { round } from './utils'

export interface DecisionConfig {
  actionThreshold: number // severity units, default 3.0 (Moderate)
  confidenceThreshold: number // below this a forecast is "low confidence"
}

/**
 * Phase 5 – convert forecast trajectory + uncertainty into an
 * intervention-window category (Table 7). Where uncertainty is high the
 * system falls back to the more conservative category and says so.
 */
export function decideIntervention(currentSeverity: number, forecast: Forecast, cfg: DecisionConfig): InterventionDecision {
  const T = cfg.actionThreshold
  const [h3, h7, h14] = forecast.horizons
  const reasons: string[] = []
  const crossing = forecast.trajectory.find((p) => p.day > 0 && p.mean >= T)
  const crossingDay = currentSeverity >= T ? 0 : (crossing?.day ?? null)
  const anyLowConfidence = forecast.horizons.some((h) => h.confidence < cfg.confidenceThreshold)

  // 1. Seek expert-confirmed intervention promptly
  const rising = h3.mean - currentSeverity > 0.1
  if (currentSeverity >= T && rising) {
    reasons.push(`Current severity (${currentSeverity}) is already at the action threshold (${T}) and still rising.`)
  }
  if (h3.mean >= T) {
    reasons.push(
      `3-day forecast (${h3.mean.toFixed(1)}) crosses the action threshold (${T}) with ${Math.round(h3.confidence * 100)} % confidence.`,
    )
  }
  if (reasons.length) {
    const lowConfidence = h3.confidence < cfg.confidenceThreshold
    if (lowConfidence) reasons.push('Confidence at 3 days is below the reliability threshold – expert confirmation is required.')
    return { category: 'intervene', reasons, conservativeFallback: false, lowConfidence, crossingDay, threshold: T }
  }

  // 2. Prepare for intervention
  if (h7.mean >= T) reasons.push(`7-day forecast (${h7.mean.toFixed(1)}) crosses the action threshold (${T}).`)
  else if (h14.mean >= T) reasons.push(`14-day forecast (${h14.mean.toFixed(1)}) crosses the action threshold (${T}).`)
  if (forecast.progressionRisk >= 0.6 && anyLowConfidence) {
    reasons.push(`Progression risk is elevated (${Math.round(forecast.progressionRisk * 100)} %) but forecast uncertainty is high.`)
  }
  if (reasons.length) {
    return { category: 'prepare', reasons, conservativeFallback: false, lowConfidence: anyLowConfidence, crossingDay, threshold: T }
  }

  // 3. Conservative fallback: the mean stays below T but the upper bound does not
  const upperCross = [h3, h7].find((h) => h.upper >= T && h.confidence < cfg.confidenceThreshold)
  if (upperCross) {
    return {
      category: 'prepare',
      reasons: [
        `Mean forecast stays below the threshold, but the ${upperCross.horizon}-day upper bound (${upperCross.upper.toFixed(1)}) reaches it and confidence is low (${Math.round(upperCross.confidence * 100)} %).`,
        'The system has fallen back to the more conservative category.',
      ],
      conservativeFallback: true,
      lowConfidence: true,
      crossingDay,
      threshold: T,
    }
  }

  // 4. Monitor and reassess
  return {
    category: 'monitor',
    reasons: [
      `Forecast severity remains below the action threshold (${T}) at all horizons (max ${round(Math.max(h3.mean, h7.mean, h14.mean), 1)}).`,
      `Progression risk is ${forecast.progressionRisk < 0.35 ? 'low' : 'moderate'} (${Math.round(forecast.progressionRisk * 100)} %).`,
    ],
    conservativeFallback: false,
    lowConfidence: anyLowConfidence,
    crossingDay,
    threshold: T,
  }
}
