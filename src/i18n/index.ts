import { useAppStore } from '@/store/useAppStore'

/**
 * Minimal bilingual dictionary (NFR-11). Sinhala strings are prototype
 * translations and should be reviewed by a native speaker / CRI extension
 * staff before field use.
 */
const en = {
  appName: 'CocoFarm AI',
  appTagline: 'Disease progression forecasting',
  nav_dashboard: 'Dashboard',
  nav_plots: 'Plots',
  nav_assess: 'New assessment',
  nav_alerts: 'Alerts',
  nav_knowledge: 'Knowledge base',
  nav_model: 'Model & evaluation',
  nav_settings: 'Settings',
  online: 'Online',
  offline: 'Offline',
  queued: 'queued',
  cat_monitor: 'Monitor and reassess',
  cat_prepare: 'Prepare for intervention',
  cat_intervene: 'Seek expert-confirmed intervention promptly',
  currentSeverity: 'Current severity',
  forecast: 'Forecast',
  explanation: 'Explanation',
  interventionWindow: 'Intervention window',
  plotHistory: 'Plot history',
  newAssessment: 'New assessment',
  registerPlot: 'Register plot',
  expertNotice: 'Decision support only. Any chemical intervention requires confirmation by an extension officer or plant pathologist.',
}

type Dict = typeof en

const si: Dict = {
  appName: 'CocoFarm AI',
  appTagline: 'රෝග ප්‍රගති පුරෝකථනය',
  nav_dashboard: 'උපකරණ පුවරුව',
  nav_plots: 'බිම් කොටස්',
  nav_assess: 'නව තක්සේරුව',
  nav_alerts: 'ඇඟවීම්',
  nav_knowledge: 'දැනුම් පදනම',
  nav_model: 'ආකෘතිය සහ ඇගයීම',
  nav_settings: 'සැකසුම්',
  online: 'සබැඳි',
  offline: 'නොබැඳි',
  queued: 'පෝලිමේ',
  cat_monitor: 'නිරීක්ෂණය කර නැවත තක්සේරු කරන්න',
  cat_prepare: 'මැදිහත්වීමට සූදානම් වන්න',
  cat_intervene: 'විශේෂඥ තහවුරු කළ මැදිහත්වීමක් වහාම ලබාගන්න',
  currentSeverity: 'වර්තමාන තීව්‍රතාව',
  forecast: 'පුරෝකථනය',
  explanation: 'පැහැදිලි කිරීම',
  interventionWindow: 'මැදිහත්වීමේ කාලය',
  plotHistory: 'බිම් කොටසේ ඉතිහාසය',
  newAssessment: 'නව තක්සේරුව',
  registerPlot: 'බිම් කොටස ලියාපදිංචි කරන්න',
  expertNotice: 'මෙය තීරණ සහාය පමණි. ඕනෑම රසායනික මැදිහත්වීමක් සඳහා දිස්ත්‍රික් පොල් සංවර්ධන නිලධාරියෙකුගේ හෝ ශාක රෝග විශේෂඥයෙකුගේ තහවුරු කිරීම අවශ්‍ය වේ.',
}

const dictionaries = { en, si }

export type TKey = keyof Dict

export function useT() {
  const lang = useAppStore((s) => s.settings.language)
  return (key: TKey) => dictionaries[lang][key] ?? en[key]
}
