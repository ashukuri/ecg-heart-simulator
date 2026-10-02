import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Disease, ECGLeadId } from './types';
import { ALL_DISEASES, getDiseaseById } from './data/diseases';
import { ALL_LEAD_IDS } from './data/leads';
import { DiseaseSelector } from './components/DiseaseSelector';
import { HeartDiagram } from './components/HeartDiagram';
import { ECGLeadPanel } from './components/ECGLeadPanel';
import { ExplanationPanel } from './components/ExplanationPanel';
import {
  STAGE_BASE_WIDTH,
  STAGE_BASE_HEIGHT,
} from './utils/ecgGenerator';
import { advancePlaybackTimeSec, clampPlaybackTimeSec, PLAYBACK_SPEEDS, type PlaybackSpeed } from './utils/playbackClock';
import { RECORDING_LEAD_POSITIONS, STANDARD_LEAD_POSITIONS, type ECGLayoutMode } from './utils/ecgLayout';
import { evaluateMasterTimeline } from './utils/timelineEngine';
import { Compass, GitCompare, Heart, Pause, Play, PanelRightClose, PanelRightOpen } from 'lucide-react';

export const App: React.FC = () => {
  const [currentDisease, setCurrentDisease] = useState<Disease>(ALL_DISEASES[0]);
  const normalDisease = useMemo(() => getDiseaseById('normal'), []);

  // 単一の Master Timeline（生理学的秒: 0.00 〜 scenarioDurationSec）
  const [masterTimeSec, setMasterTimeSec] = useState<number>(0);
  const [ecgLayout, setECGLayout] = useState<ECGLayoutMode>('recording');
  const layoutWidth = ecgLayout === 'standard' ? 1008 : STAGE_BASE_WIDTH;
  const leadPositions = ecgLayout === 'standard' ? STANDARD_LEAD_POSITIONS : RECORDING_LEAD_POSITIONS;
  const [isPlaying, setIsPlaying] = useState(true);
  const playbackRunningRef = useRef(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(0.25);

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
      const availW = Math.max(1, rect.width - 16);
      const availH = Math.max(1, rect.height - 12);
      const scaleX = availW / layoutWidth;
      const scaleY = availH / STAGE_BASE_HEIGHT;
      const uniformScale = Math.max(0.01, Math.min(scaleX, scaleY, 1.28));
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
  }, [showExplanation, layoutWidth]);

  // Single shared physiological clock; speed changes preserve the current phase.
  useEffect(() => {
    lastTimeRef.current = performance.now();
    if (!isPlaying) return;

    const tick = (now: number) => {
      if (!playbackRunningRef.current) return;
      const deltaRealMs = now - lastTimeRef.current;
      lastTimeRef.current = now;

      // 異常な大ジャンプ（タブ非アクティブ復帰時など）をクランプ
      const clampedDeltaSec = Math.min(0.1, Math.max(0, deltaRealMs / 1000));

      setMasterTimeSec((prev) =>
        advancePlaybackTimeSec(prev, clampedDeltaSec, scenarioDurationSec, playbackSpeed)
      );

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [scenarioDurationSec, currentDisease.id, playbackSpeed, isPlaying]);

  // Switching disease resets time while preserving the user's pause state.
  const handleSelectDisease = (disease: Disease) => {
    setCurrentDisease(disease);
    setMasterTimeSec(0);
    lastTimeRef.current = performance.now();
  };

  const handleTogglePlayback = () => {
    playbackRunningRef.current = !playbackRunningRef.current;
    lastTimeRef.current = performance.now();
    setIsPlaying(playbackRunningRef.current);
  };

  const handleSeek = (timeSec: number) => {
    // Pause immediately, including any RAF queued before React commits state.
    playbackRunningRef.current = false;
    setIsPlaying(false);
    setMasterTimeSec(clampPlaybackTimeSec(timeSec, scenarioDurationSec));
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
        playbackSpeed={playbackSpeed}
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


          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={`${import.meta.env.BASE_URL}guide.html`}
              className="px-2 py-1 rounded-md text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
            >
              使い方・このシミュレーターについて
            </a>

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

        <div role="group" aria-label="再生コントロール"
          className="flex flex-wrap items-center gap-2 px-3 py-1.5 bg-white border-b border-slate-200 shrink-0">
          <button type="button" onClick={handleTogglePlayback}
            aria-label={isPlaying ? '一時停止' : '再生'}
            className="flex items-center justify-center gap-1 px-2 py-1 min-w-20 rounded-md text-xs font-medium border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer">
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isPlaying ? '一時停止' : '再生'}
          </button>
          <select aria-label="再生速度" value={playbackSpeed}
            onChange={(event) => setPlaybackSpeed(Number(event.target.value) as PlaybackSpeed)}
            className="px-1 py-1 text-xs font-mono rounded-md bg-slate-50 border border-slate-200 cursor-pointer"
            title={`再生速度 ${playbackSpeed}×。心臓とECGを同期して変更します。`}>
            {PLAYBACK_SPEEDS.map((speed) => <option key={speed} value={speed}>{speed}×</option>)}
          </select>
          <input type="range" aria-label="再生位置" min={0} max={scenarioDurationSec} step={0.01}
            value={masterTimeSec} aria-valuetext={`${masterTimeSec.toFixed(2)}秒 / ${scenarioDurationSec.toFixed(2)}秒`}
            onChange={(event) => handleSeek(Number(event.target.value))}
            className="flex-1 min-w-16 accent-blue-600 cursor-pointer"
            title="位置を変更すると一時停止します。再生ボタンで続きから再開できます。" />
          <span className="text-[10px] font-mono tabular-nums text-slate-600 whitespace-nowrap">
            {masterTimeSec.toFixed(2)} / {scenarioDurationSec.toFixed(2)} s
          </span>
          <div role="group" aria-label="心電図の配置" className="inline-flex rounded-md border border-slate-200 overflow-hidden shrink-0">
            {([['recording', '記録位置を反映'], ['standard', '標準']] as const).map(([mode, label]) => (
              <button key={mode} type="button" aria-pressed={ecgLayout === mode}
                onClick={() => setECGLayout(mode)}
                className={`px-2 py-1 text-[10.5px] font-medium cursor-pointer transition-colors ${ecgLayout === mode
                  ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 中央ワークスペース：1366×768〜1920×1080で横スクロールなし・縦横同率スケーリング */}
        <div
          ref={stageContainerRef}
          className="flex-1 overflow-hidden flex items-center justify-center p-1.5"
        >
          <div
            data-ecg-stage={ecgLayout}
            className="relative shrink-0 origin-center ecg-layout-stage"
            style={{
              width: `${layoutWidth}px`,
              height: `${STAGE_BASE_HEIGHT}px`,
              transform: `scale(${stageScale})`,
            }}
          >
            <div data-heart-position={ecgLayout}
              className="absolute top-0 left-0 flex flex-col items-center ecg-layout-heart"
              style={{ width: ecgLayout === 'standard' ? 330 : 480,
                transform: ecgLayout === 'standard' ? 'translate(10px, 80px)' : 'translate(164px, 26px)' }}>
              <HeartDiagram
                isJunctionalRhythm={currentDisease.id === 'junctional_rhythm'}
                snapshot={snapshot}
                showElectricVector={showElectricVector}
              />
            </div>
            {ALL_LEAD_IDS.map((leadId) => (
              <div key={leadId} data-lead-card={leadId}
                className="absolute top-0 left-0 ecg-layout-card"
                style={{ transform: `translate(${leadPositions[leadId].x}px, ${leadPositions[leadId].y}px)` }}>
                {renderLeadCard(leadId)}
              </div>
            ))}
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
