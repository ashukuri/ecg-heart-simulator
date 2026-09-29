import { Disease, DiseaseCategory } from '../../types';
import { normalDiseases } from './normal';
import { arrhythmiaDiseases } from './arrhythmia';
import { conductionDiseases } from './conduction';
import { infarctionDiseases } from './infarction';
import { electrolyteDiseases } from './electrolyte';

export const ALL_DISEASES: Disease[] = [
  ...normalDiseases,
  ...arrhythmiaDiseases,
  ...conductionDiseases,
  ...infarctionDiseases,
  ...electrolyteDiseases,
];

export const CATEGORIES: { id: DiseaseCategory; nameJa: string; description: string }[] = [
  { id: 'normal', nameJa: '正常', description: '正常洞調律および右胸心' },
  { id: 'arrhythmia', nameJa: '不整脈', description: '房室ブロック、期外収縮、頻拍、細動、粗動、WPWなど' },
  { id: 'conduction', nameJa: '伝導障害', description: '右脚ブロック、左脚前枝・後枝ブロック' },
  { id: 'infarction', nameJa: '心筋梗塞', description: '前壁中隔梗塞、側壁梗塞、下壁梗塞' },
  { id: 'electrolyte', nameJa: '電解質異常', description: '高/低カリウム血症、高/低カルシウム血症' },
];

export function getDiseaseById(id: string): Disease {
  const d = ALL_DISEASES.find(item => item.id === id);
  return d || normalDiseases[0];
}

export function getDiseasesByCategory(cat: DiseaseCategory): Disease[] {
  return ALL_DISEASES.filter(d => d.category === cat);
}
