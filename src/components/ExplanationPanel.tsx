import React, { useState } from 'react';
import { Disease, ECGLeadId } from '../types';
import { ECG_LEADS } from '../data/leads';
import { MasterTimelineSnapshot } from '../utils/timelineEngine';
import {
  Activity,
  BookOpen,
  ChevronRight,
  HelpCircle,
  Info,
  Lightbulb,
  MapPin,
  Sparkles,
  Stethoscope,
  Zap,
} from 'lucide-react';

interface ExplanationPanelProps {
  disease: Disease;
  snapshot: MasterTimelineSnapshot;
  selectedLead: ECGLeadId | null;
  compareMode: boolean;
}

export const ExplanationPanel: React.FC<ExplanationPanelProps> = ({
  disease,
  snapshot,
  selectedLead,
  compareMode,
}) => {
  const [activeTab, setActiveTab] = useState<'mechanism' | 'ecg' | 'teaching'>('mechanism');

  const currentEvent = snapshot.currentEvent;
  const leadInfo = selectedLead ? ECG_LEADS[selectedLead] : null;
  const leadNote = selectedLead ? disease.leadNotes?.[selectedLead] : null;

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200 text-slate-800 shadow-sm overflow-hidden font-sans">
      {/* 疾患タイトルヘッダー */}
      <div className="p-3 xl:p-3.5 border-b border-slate-200 bg-slate-50/70">
        <div className="flex items-center justify-between gap-1.5 mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
              {disease.categoryNameJa}
            </span>
            <span className="text-[11px] text-slate-400 font-mono truncate">
              {disease.nameEn}
            </span>
          </div>
          <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
            {disease.hrDisplay || 'HR 75 bpm'}
          </span>
        </div>
        <h2 className="text-sm xl:text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
          {disease.nameJa}
        </h2>
        <p className="mt-0.5 text-[11px] text-slate-600 leading-snug">{disease.shortDescription}</p>

        {/* 刺激発生源と伝導順序バッジ */}
        <div className="mt-2 p-2 rounded-lg bg-white border border-slate-200 text-[11px] flex flex-col gap-1 shadow-2xs">
          <div className="flex items-start gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
            <span className="text-slate-400 shrink-0 font-medium">発生源:</span>
            <span className="text-slate-800 font-semibold">{disease.heartOrigin}</span>
          </div>
          <div className="flex items-start gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
            <span className="text-slate-400 shrink-0 font-medium">伝導路:</span>
            <span className="text-slate-700 leading-snug">{disease.conductionSequence}</span>
          </div>
        </div>
      </div>

      {/* Master Timeline 同期・リアルタイム心臓内イベントインジケータ */}
      <div className="px-3 py-2.5 bg-blue-50/50 border-b border-blue-100 h-24 shrink-0 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-blue-700">
              <Activity className="w-3.5 h-3.5 text-blue-600 animate-pulse shrink-0" />
              <span className="truncate">心臓内リアルタイム現象:</span>
            </div>
            <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-white text-blue-700 border border-blue-200 shadow-2xs shrink-0">
              {snapshot.phaseLabelJa} ({snapshot.masterTimeSec.toFixed(2)}s)
            </span>
          </div>
          <div className="text-xs font-bold text-slate-900 truncate">
            {currentEvent?.titleJa}
          </div>
        </div>
        <p className="text-[11px] text-slate-600 leading-snug line-clamp-2">
          {currentEvent?.descriptionJa}
        </p>
      </div>

      {/* 誘導特化解説（選択中のみ） */}
      {selectedLead && leadInfo && (
        <div className="mx-3 mt-2.5 p-2.5 rounded-lg bg-slate-50 border border-blue-200 shadow-2xs shrink-0">
          <div className="flex items-center justify-between mb-1.5 gap-2">
            <div className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 bg-blue-600 text-white font-mono font-bold text-xs rounded">
                {selectedLead}
              </span>
              <span className="text-xs font-semibold text-slate-800">{leadInfo.name}</span>
            </div>
            <span className="text-[10px] text-slate-500 font-medium truncate">
              観察領域: {leadInfo.targetRegion}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mb-1.5 leading-snug">
            {leadInfo.viewDescription}
          </p>
          <p className="text-xs text-slate-700 leading-relaxed">
            <strong>この誘導の典型的変化: </strong>
            {leadNote ||
              `${disease.nameJa}における${selectedLead}誘導の典型的波形。心臓の「${leadInfo.targetRegion}」の電気的興奮と再分極を反映しています。`}
          </p>
        </div>
      )}

      {/* 解説タブナビゲーション */}
      <div className="flex items-center border-b border-slate-200 px-4 mt-1 bg-white shrink-0">
        <button
          onClick={() => setActiveTab('mechanism')}
          className={`flex items-center gap-1.5 py-2.5 px-2.5 text-xs font-semibold border-b-2 transition -mb-px ${
            activeTab === 'mechanism'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Stethoscope className="w-3.5 h-3.5" />
          電気生理メカニズム
        </button>
        <button
          onClick={() => setActiveTab('ecg')}
          className={`flex items-center gap-1.5 py-2.5 px-2.5 text-xs font-semibold border-b-2 transition -mb-px ${
            activeTab === 'ecg'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          ECG所見と因果関係
        </button>
        <button
          onClick={() => setActiveTab('teaching')}
          className={`flex items-center gap-1.5 py-2.5 px-2.5 text-xs font-semibold border-b-2 transition -mb-px ${
            activeTab === 'teaching'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Lightbulb className="w-3.5 h-3.5" />
          学習ポイント
        </button>
      </div>

      {/* タブコンテンツ */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3.5 text-xs leading-relaxed text-slate-700 bg-white">
        {activeTab === 'mechanism' && (
          <div className="space-y-3.5">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                心臓内で何が起きているか？
              </h4>
              <p className="text-slate-600 whitespace-pre-line leading-relaxed">
                {disease.mechanismDetail}
              </p>
            </div>

            {compareMode && (
              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
                <h4 className="text-xs font-bold text-emerald-800 flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  正常洞調律との波形比較（点線オーバーレイ中）
                </h4>
                <p className="text-emerald-900 leading-relaxed">
                  各誘導パネルの薄い点線が「正常洞調律（HR 75 bpm）」の基準波形です。PR間隔の伸縮、QRS幅・極性の変化、ST偏位やT/U波のタイミング差を同一スケール（25mm/s・10mm/mV）上で直接比較できます。
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'ecg' && (
          <div className="space-y-3.5">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-2">
                <Activity className="w-4 h-4 text-blue-600" />
                12誘導心電図の典型的所見
              </h4>
              <p className="text-slate-600 whitespace-pre-line leading-relaxed">
                {disease.ecgFeaturesDetail}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-2">
                <HelpCircle className="w-4 h-4 text-indigo-600" />
                なぜ各誘導にこの変化が現れるのか？
              </h4>
              <p className="text-slate-600 whitespace-pre-line leading-relaxed">
                {disease.whyLeadChanges}
              </p>
            </div>
          </div>
        )}

        {activeTab === 'teaching' && (
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-2.5">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                重要学習チェックポイント
              </h4>
              <ul className="space-y-2">
                {disease.teachingPoints.map((point, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <ChevronRight className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                    <span className="text-slate-700 leading-snug">{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-3 rounded-lg bg-blue-50/50 border border-blue-200 text-slate-600 text-[11px] leading-relaxed">
              <Info className="w-3.5 h-3.5 inline text-blue-600 mr-1" />
              12誘導カードをクリックすると、その誘導の観察方向と病態固有の波形変化が上部に表示されます。
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
