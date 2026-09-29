import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Disease, ECGLeadId } from './types';
import { ALL_DISEASES, getDiseaseById } from './data/diseases';
import { LEFT_COLUMN_LEADS, BOTTOM_ROW_LEADS, RIGHT_COLUMN_LEADS } from './data/leads';
import { DiseaseSelector } from './components/DiseaseSelector';
import { HeartDiagram } from './components/HeartDiagram';
import { ECGLeadPanel } from './components/ECGLeadPanel';
import { ExplanationPanel } from './components/ExplanationPanel';
import {
  advanceMasterTimeSec,
  ECG_WINDOW_SEC,
  STAGE_BASE_WIDTH,
  STAGE_BASE_HEIGHT,
} from './utils/ecgGenerator';
import { evaluateMasterTimeline } from './utils/timelineEngine';
import { Compass, GitCompare, Heart, PanelRightClose, PanelRightOpen } from 'lucide-react';

export const App: React.FC = () => {
  const [currentDisease, setCurrentDisease] = useState<Disease>(ALL_DISEASES[0]);
  const normalDisease = useMemo(() => getDiseaseById('normal'), []);

  // 単一の Master Timeline（生理学的秒: 0.00 〜 scenarioDurationSec）
  const [masterTimeSec, setMasterTimeSec] = useState<number>(0);

  // 独立トグル: 正常比較 (初期OFF) ＆ 平均電気ベクトル (初期OFF)
  const [compareMode, setCompareMode] = useState<boolean>(false);
  const [showElectricVector, setShowElectricVector] = useState<boolean>(false);

  // 選択された誘導（クリック時に右側ExplanationPanelを該当誘導の解説へ切替）
  const [selectedLead, setSelectedLead] = useState<ECGLeadId | null>('II');

  // 右側解説パネルの開閉
  const [showExplanation, setShowExplanation] = useState<boolean>(true);

  // 中央ステージの縦横同率スケール（25mm/s・10mm/mV の正方比率を厳密保持）
  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const [stageScale, setStageScale] = useState<number>(1);

  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const scenarioDurationSec = currentDisease.scenarioDurationSec;

  // 画面解像度(1366×768 / 1536×864 / 1920×1080等)に応じた中央ステージの同率スケーリング計算
  useEffect(() => {
    const el = stageContainerRef.current;
    if (!el) return;

    const updateScale = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const availW = Math.max(320, rect.width - 16);
      const availH = Math.max(320, rect.height - 12);
      const scaleX = availW / STAGE_BASE_WIDTH;
      const scaleY = availH / STAGE_BASE_HEIGHT;
      const uniformScale = Math.max(0.75, Math.min(scaleX, scaleY, 1.28));
      setStageScale(Number(uniformScale.toFixed(4)));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(el);
    window.addEventListener('resize', updateScale);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, [showExplanation]);

  // Master Timeline 自動ループエンジン (EDUCATION_TIME_SCALE = 0.25 を全体へ均一適用)
  useEffect(() => {
    lastTimeRef.current = performance.now();

    const tick = (now: number) => {
      const deltaRealMs = now - lastTimeRef.current;
      lastTimeRef.current = now;

      // 異常な大ジャンプ（タブ非アクティブ復帰時など）をクランプ
      const clampedDeltaSec = Math.min(0.1, Math.max(0, deltaRealMs / 1000));

      setMasterTimeSec((prev) =>
        advanceMasterTimeSec(prev, clampedDeltaSec, scenarioDurationSec)
      );

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [scenarioDurationSec, currentDisease.id]);

  // 疾患切替時：必ず master timeline を 0 にリセットし、0から自動再生を開始する（仕様15）
  const handleSelectDisease = (disease: Disease) => {
    setCurrentDisease(disease);
    setMasterTimeSec(0);
    lastTimeRef.current = performance.now();
  };

  // Master Timeline から現在の心臓興奮・伝導・壁運動・ECG同期状態を単一算出
  const snapshot = useMemo(
    () => evaluateMasterTimeline(currentDisease, masterTimeSec),
    [currentDisease, masterTimeSec]
  );

  const renderLeadCard = (leadId: ECGLeadId) => (
    <ECGLeadPanel
      key={leadId}
      leadId={leadId}
      points={currentDisease.leads[leadId]}
      normalPoints={normalDisease.leads[leadId]}
      normalizedTime={snapshot.normalizedTime}
      phaseColor={snapshot.phaseColor}
      phaseLabelJa={snapshot.phaseLabelJa}
      isSelected={selectedLead === leadId}
      onSelect={setSelectedLead}
      compareMode={compareMode}
    />
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 font-sans text-slate-800">
      {/* 1. 左サイドバー：疾患一覧セレクター */}
      <DiseaseSelector
        currentDiseaseId={currentDisease.id}
        onSelectDisease={handleSelectDisease}
      />

      {/* 2. 中央メイン領域：上部ヘッダー ＋ 2.5D四腔断面心臓 ＆ 標準12誘導ECG */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-slate-50 min-w-0">
        {/* 上部ヘッダーバー */}
        <header className="h-11 px-3 border-b border-slate-200 bg-white/95 flex items-center justify-between gap-2 z-10 shadow-xs shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
              <Heart className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm text-slate-900 truncate">
              {currentDisease.nameJa}
            </span>
            <span className="text-xs text-slate-400 font-mono hidden 2xl:inline truncate">
              ({currentDisease.nameEn})
            </span>

            {/* 生理学的HR表示バッジ（0.25倍速に左右されない本来の病態HR） */}
            <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded-md bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
              {currentDisease.hrDisplay || 'HR 75 bpm'}
            </span>

            {/* 教育用 0.25× 固定スロー再生バッジ（速度切替UIは置かず静的に明示） */}
            <span
              className="px-2 py-0.5 text-[10.5px] font-mono font-semibold rounded-md bg-slate-100 text-slate-600 border border-slate-200 shrink-0"
              title={`生理学的タイムライン（周期 ${scenarioDurationSec.toFixed(2)}s / 表示窓 ${ECG_WINDOW_SEC.toFixed(2)}s）を0.25倍速（実時間4.0s = 生理時間1.0s）で再生中`}
            >
              教育用 0.25× ({scenarioDurationSec.toFixed(2)}s周期)
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* 電気ベクトル OFF / ON 独立トグル（仕様20） */}
            <button
              onClick={() => setShowElectricVector((v) => !v)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border transition shadow-2xs cursor-pointer ${
                showElectricVector
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
              title="現在の平均電気ベクトル（細い矢印1本）の表示切替"
            >
              <Compass className={`w-3.5 h-3.5 ${showElectricVector ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span>電気ベクトル {showElectricVector ? 'ON' : 'OFF'}</span>
            </button>

            {/* 正常波形との比較 OFF / ON トグル（仕様21） */}
            <button
              onClick={() => setCompareMode((c) => !c)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border transition shadow-2xs cursor-pointer ${
                compareMode
                  ? 'bg-blue-50 border-blue-300 text-blue-800 font-semibold'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
              title="全12誘導に正常洞調律波形を薄い点線で重ねて比較"
            >
              <GitCompare className={`w-3.5 h-3.5 ${compareMode ? 'text-blue-600' : 'text-slate-400'}`} />
              <span>正常と比較 {compareMode ? 'ON' : 'OFF'}</span>
            </button>

            {/* 右側解説パネルの開閉ボタン */}
            <button
              onClick={() => setShowExplanation((s) => !s)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition shadow-2xs cursor-pointer"
              title="解説パネルの開閉"
            >
              {showExplanation ? (
                <>
                  <PanelRightClose className="w-3.5 h-3.5 text-slate-600" />
                  <span className="hidden xl:inline">解説を閉じる</span>
                </>
              ) : (
                <>
                  <PanelRightOpen className="w-3.5 h-3.5 text-slate-600" />
                  <span className="hidden xl:inline">解説を開く</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* 中央ワークスペース：1366×768〜1920×1080で横スクロールなし・縦横同率スケーリング */}
        <div
          ref={stageContainerRef}
          className="flex-1 overflow-hidden flex items-center justify-center p-1.5"
        >
          <div
            className="flex items-center justify-center gap-2 shrink-0 origin-center transition-transform duration-75"
            style={{
              width: `${STAGE_BASE_WIDTH}px`,
              height: `${STAGE_BASE_HEIGHT}px`,
              transform: `scale(${stageScale})`,
            }}
          >
            {/* 左カラム: aVR, V1, V2, V3 */}
            <div className="flex flex-col justify-center gap-1.5 shrink-0">
              {LEFT_COLUMN_LEADS.map(renderLeadCard)}
            </div>

            {/* 中央カラム: 教材用2.5D心尖部四腔断面 ＋ 下部下壁誘導 (II, aVF, III) */}
            <div className="flex flex-col items-center justify-between gap-1.5 shrink-0 w-[480px]">
              <HeartDiagram
                snapshot={snapshot}
                showElectricVector={showElectricVector}
              />

              {/* 下部: II, aVF, III */}
              <div className="flex items-center justify-center gap-1.5 pt-0.5">
                {BOTTOM_ROW_LEADS.map(renderLeadCard)}
              </div>
            </div>

            {/* 右カラム: aVL, I, V4, V5, V6 */}
            <div className="flex flex-col justify-center gap-1 shrink-0">
              {RIGHT_COLUMN_LEADS.map(renderLeadCard)}
            </div>
          </div>
        </div>
      </div>

      {/* 3. 右サイドバー：詳細解説パネル */}
      {showExplanation && (
        <div className="w-[280px] xl:w-[320px] 2xl:w-[360px] h-full shrink-0 z-20">
          <ExplanationPanel
            disease={currentDisease}
            snapshot={snapshot}
            selectedLead={selectedLead}
            compareMode={compareMode}
          />
        </div>
      )}
    </div>
  );
};

export default App;
