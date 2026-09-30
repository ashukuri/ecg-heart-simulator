import React, { useState } from 'react';
import { Disease, DiseaseCategory } from '../types';
import { ALL_DISEASES, CATEGORIES } from '../data/diseases';
import { Search, HeartPulse } from 'lucide-react';

interface DiseaseSelectorProps {
  currentDiseaseId: string;
  playbackSpeed: number;
  onSelectDisease: (disease: Disease) => void;
}

export const DiseaseSelector: React.FC<DiseaseSelectorProps> = ({
  currentDiseaseId,
  playbackSpeed,
  onSelectDisease,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<DiseaseCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDiseases = ALL_DISEASES.filter((d) => {
    const matchCat = selectedCategory === 'all' || d.category === selectedCategory;
    const matchSearch =
      searchQuery === '' ||
      d.nameJa.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.shortDescription.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <aside className="w-[216px] xl:w-[244px] 2xl:w-[268px] h-full bg-white border-r border-slate-200 flex flex-col text-slate-800 select-none z-20 shrink-0">
      {/* ロゴ・アプリヘッダー */}
      <div className="p-2.5 xl:p-3 border-b border-slate-200 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
            <HeartPulse className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
              ECG Heart Simulator
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                12-Lead
              </span>
            </h1>
            <p className="text-[10px] text-slate-500 font-sans">心臓電気生理 ＆ 12誘導心電図学習アトラス</p>
          </div>
        </div>

        {/* 検索バー */}
        <div className="mt-2.5 relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="病態名・特徴を検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1 bg-white border border-slate-200 rounded-md text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition shadow-sm"
          />
        </div>
      </div>

      {/* カテゴリセレクタータブ */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-slate-200 bg-white">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
            selectedCategory === 'all'
              ? 'bg-slate-900 text-white font-semibold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          すべて ({ALL_DISEASES.length})
        </button>
        {CATEGORIES.map((cat) => {
          const count = ALL_DISEASES.filter((d) => d.category === cat.id).length;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                selectedCategory === cat.id
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {cat.nameJa} ({count})
            </button>
          );
        })}
      </div>

      {/* 疾患リスト */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-white">
        {filteredDiseases.map((disease) => {
          const isSelected = disease.id === currentDiseaseId;
          return (
            <div
              key={disease.id}
              onClick={() => onSelectDisease(disease)}
              className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-blue-50/80 border-blue-500/70 border-l-[3px] border-l-blue-600 shadow-sm'
                  : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1 gap-1">
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border shrink-0 ${
                    disease.category === 'normal'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : disease.category === 'arrhythmia'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : disease.category === 'conduction'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : disease.category === 'infarction'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-purple-50 text-purple-700 border-purple-200'
                  }`}
                >
                  {disease.categoryNameJa}
                </span>
                <span className="text-[10px] text-slate-500 font-mono truncate">
                  {disease.hrDisplay || 'HR 75 bpm'}
                </span>
              </div>
              <div
                className={`text-xs font-bold leading-snug ${
                  isSelected ? 'text-blue-900' : 'text-slate-900'
                }`}
              >
                {disease.nameJa}
              </div>
              <div className="text-[11px] text-slate-500 truncate mt-0.5 font-sans">
                {disease.shortDescription}
              </div>
            </div>
          );
        })}

        {filteredDiseases.length === 0 && (
          <div className="p-6 text-center text-xs text-slate-400">
            該当する病態が見つかりませんでした。
          </div>
        )}
      </div>

      {/* フッター情報 ＆ 教育目的の注意書き */}
      <div className="p-2.5 border-t border-slate-200 text-[10px] text-slate-500 bg-slate-50 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span>全 {ALL_DISEASES.length} 疾患収録（標準12誘導）</span>
          <span className="font-mono">教育用 {playbackSpeed}×</span>
        </div>
        <p className="text-[9.5px] text-slate-400 leading-tight">
          本シミュレーターは教育目的です。診断・治療判断には使用しないでください。
        </p>
      </div>
    </aside>
  );
};
