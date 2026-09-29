# 3D心臓電気生理 & 心電図インタラクティブ学習シミュレータ (ECG Heart 3D Edu)

心臓内の電気刺激の**発生・伝導・興奮順序**と、それが各誘導の**心電図波形（P-QRS-T-U）にどう反映されるかの因果関係**を、高精度3D心臓解剖モデルと同期アニメーションで直感的に学ぶための医学教育用Webアプリケーションです。

---

## 🌟 特徴と教育コンセプト

1. **「波形暗記」から「電気現象・ベクトルの理解」へ**
   - 「この波形だからこの疾患」ではなく、**「心臓内でこういう電気現象が起きるから、この誘導から見るとこの波形になる」**という物理的・電気生理学的因果関係を可視化。
   - 3D空間内に総合脱分極ベクトル（ゴールド矢印）および再分極ベクトル（シアン矢印）がリアルタイム表示され、各誘導の視線方向との関係を体感できます。

2. **高精度3D心臓解剖モデル（BodyParts3D）の完全連携**
   - 洞結節、結節間伝導路、房室結節（AV node）、ヒス束（His bundle）、右脚、左脚前枝・後枝・中隔枝、プルキンエ線維網、副伝導路（Kent束）、心房、心室中隔、左室前壁・側壁・下壁、右室壁を完全再現。
   - 「伝導系透視モード」により、外側心筋を半透明化して内部の高速伝導路を直視可能。
   - マウスオーバーによるリアルタイム解剖構造名表示。

3. **代表10誘導の解剖学的周囲配置 & 視線連動**
   - **肢誘導**: 第I誘導（左横）、第II誘導（心尖・下壁）、第III誘導（右下）、aVR（右肩見下ろし）、aVL（左肩）、aVF（足元見上げ）
   - **胸部誘導**: V1（右前胸部・中隔右側）、V2（中隔直前）、V5（前側壁）、V6（側壁）
   - 誘導パネルまたは3D空間内の電極をクリックすると、**その誘導が心臓を見つめる観察アングルへカメラがスムーズに移動**。

4. **全24病態の網羅的収録**
   - **正常**: 正常洞調律、右胸心
   - **不整脈**: 1度房室ブロック、Wenckebach型（Mobitz I）、Mobitz II型、完全房室ブロック、心房細動（AF）、心室細動（VF）、心房粗動（AFL）、心室頻拍（VT）、心室期外収縮（PVC）、心房期外収縮（PAC）、WPW症候群、房室接合部調律、トルサード・ド・ポアント（TdP）
   - **伝導障害**: 完全右脚ブロック（CRBBB）、左脚前枝ブロック（LAFB）、左脚後枝ブロック（LPFB）
   - **心筋梗塞**: 急性前壁中隔梗塞、急性側壁梗塞、急性下壁梗塞
   - **電解質異常**: 高カリウム血症、低カリウム血症、高カルシウム血症、低カルシウム血症

5. **高度な学習支援機能**
   - **正常波形と比較モード**: 現在の病態波形と正常波形をミリ方眼紙上にオーバーレイ点線表示。
   - **リアルタイム心臓内イベント同期表示**: 「洞結節発振」「AV結節で生理的遅延中」「副伝導路（Kent束）を早期通過中」「前壁中隔壊死による電気的窓効果」など、時間スライダーと同期して日本語解説。
   - **再生コントロール**: 任意時間シークバー、再生速度（0.25x / 0.5x / 1.0x）、ループ再生、一時停止・リセット。

---

## 📁 ディレクトリ・ファイル構成

```
ecg-heart-simulator/
├── public/
│   └── models/
│       ├── optimized/          # 最適化・正規化済みの解剖グループ別OBJファイル
│       │   ├── sa_node.obj             # 洞結節
│       │   ├── internodal.obj          # 結節間伝導路
│       │   ├── av_node.obj             # 房室結節
│       │   ├── his_bundle.obj          # ヒス束
│       │   ├── right_bundle.obj        # 右脚
│       │   ├── left_bundle_ant.obj     # 左脚前枝
│       │   ├── left_bundle_post.obj    # 左脚後枝
│       │   ├── left_bundle_sept.obj    # 左脚中隔枝
│       │   ├── atria.obj               # 心房筋（右房・左房）
│       │   ├── iv_septum.obj           # 心室中隔
│       │   ├── lv_anterior.obj         # 左室前壁
│       │   ├── lv_lateral.obj          # 左室側壁
│       │   ├── lv_inferior.obj         # 左室下壁
│       │   ├── rv_wall.obj             # 右室自由壁
│       │   └── vessels_valves.obj      # 大血管・弁
│       └── heart_parts/        # 原本OBJファイル一式
├── src/
│   ├── types/
│   │   └── index.ts            # 疾患・誘導・タイムライン・解剖の型定義
│   ├── data/
│   │   ├── leads.ts            # 代表10誘導の定義と解剖学的観察角度
│   │   └── diseases/           # 疾患データモジュール（全24病態）
│   │       ├── normal.ts       # 正常、右胸心
│   │       ├── arrhythmia.ts   # 房室ブロック、AF、VF、AFL、VT、期外収縮、WPW等
│   │       ├── conduction.ts   # 右脚ブロック、左脚前枝・後枝ブロック
│   │       ├── infarction.ts   # 前壁中隔・側壁・下壁梗塞
│   │       ├── electrolyte.ts  # 高/低K血症、高/低Ca血症
│   │       └── index.ts        # 全疾患エクスポート
│   ├── utils/
│   │   └── ecgGenerator.ts     # ガウス関数・スプライン曲線による心電図波形合成
│   ├── components/
│   │   ├── HeartView3D.tsx     # Three.js 3D心臓・伝導系・ベクトル矢印描画
│   │   ├── ECGLeadPanel.tsx    # 医療用方眼紙SVGリアルタイム心電図パネル
│   │   ├── ExplanationPanel.tsx# 電気生理メカニズム・学習ポイント・現在イベント解説
│   │   ├── DiseaseSelector.tsx # 検索・カテゴリ別疾患選択サイドバー
│   │   └── PlaybackControls.tsx# シークスライダー・速度調整・正常比較トグル
│   ├── App.tsx                 # メインレイアウト統合
│   ├── main.tsx
│   └── index.css               # メディカルダークテーマスタイリング
├── package.json
└── vite.config.ts
```

---

## 🚀 起動方法

### 前提環境
- Node.js (v18以上推奨)
- npm

### 開発サーバーの起動
```bash
cd /Users/admin/.gemini/antigravity/scratch/ecg-heart-simulator
npm run dev
```
ブラウザで `http://localhost:5173/` にアクセスします。

### 本番ビルド
```bash
npm run build
npm run preview
```

---

## ⌨️ キーボードショートカット

| キー | アクション |
| :--- | :--- |
| **Space** | 再生 / 一時停止 |
| **R** | アニメーションを最初（t=0）にリセット |
| **→ (右矢印)** | 0.02秒 時間を進める |
| **← (左矢印)** | 0.02秒 時間を戻す |
| **C** | 「正常波形と比較」モードのON/OFF切替 |

---

## 🛠️ 新しい病態の追加手順（拡張性の高い設計）

新しい病態を追加する際は、`src/data/diseases/` 配下の該当カテゴリファイルにオブジェクトを1つ追加するだけで、UIや3Dアニメーション、ECG波形、解説が自動的に反映されます。

### 追加例: `src/data/diseases/conduction.ts`
```typescript
{
  id: 'lbbb',
  nameJa: '完全左脚ブロック (CLBBB)',
  nameEn: 'Complete Left Bundle Branch Block',
  category: 'conduction',
  categoryNameJa: '伝導障害',
  subtitle: '左脚本幹の遮断により右室先行、左室へ遅延伝導',
  shortDescription: '右脚から右室が先行脱分極し、左室へ中隔を越えて遅れて伝導するため、V5/V6で幅広く頂点が平坦またはノッチのあるR波を呈する。',
  heartOrigin: '洞房結節 (SA node)',
  conductionSequence: '洞結節 → AV結節 → His束 → 【右脚先行】右室脱分極 → 【左脚遮断】中隔筋間を越えて左室全体へ遅延興奮',
  mechanismDetail: '...',
  ecgFeaturesDetail: '① QRS幅 ≧ 0.12秒。② V5, V6, I, aVLで幅広く頂点の割れたR波（notched R）。③ V1で幅広いQS型またはrS型...',
  whyLeadChanges: '...',
  teachingPoints: ['新規出現のLBBBは急性心筋梗塞（STEMI相当）として扱う', '...'],
  cycleDurationMs: 1000,
  events: [
    {
      start: 0.00,
      end: 0.06,
      phase: 'baseline',
      titleJa: '洞結節発振',
      descriptionJa: '...',
      activeRegions: ['sa_node']
    },
    // ...各フェーズ
  ],
  regions: {
    left_bundle_ant: { isBlocked: true, activationStart: 0, activationDuration: 0, repolarizationStart: 0, repolarizationDuration: 0 },
    left_bundle_post: { isBlocked: true, activationStart: 0, activationDuration: 0, repolarizationStart: 0, repolarizationDuration: 0 },
    // 各部位の興奮・遅延タイミング
  },
  leads: baseLeads((lead, t) => {
    // 誘導ごとの波形定義
  }),
  leadNotes: {
    V6: 'ノッチを伴う幅広いR波。中隔から左室への遅延伝導を反映。'
  }
}
```

---

## 🩺 医学教育における工夫

- **心筋梗塞における「電気的窓効果」の体感**:
  前壁中隔梗塞では、中隔心筋が壊死して起電力を失うため、直前のV1/V2で本来あるはずの初期r波が消失し、反対側の後退ベクトルが覗き見えて深いQS波となる現象を、3Dモデル上の壊死部位（暗紫・非活動領域）とベクトル矢印の逆向き表示で視覚的に納得できます。
- **副伝導路（Kent束）の短絡伝導**:
  WPW症候群では、心房から心室側壁へ短絡するKent束が点灯し、房室結節の遅延を飛び越えて心室が早期発火することで「デルタ波」が立ち上がる様子が3D上で明瞭に確認できます。
- **脚ブロックでの筋間遅延伝導**:
  右脚ブロックでは、左脚から中隔・左室が一気に興奮を終えた後、遅れて中隔を越えて右室自由壁が脱分極する終末ベクトルが前方に近づくため、V1で第二の巨大R波（rsR'型）が形成される仕組みが一目で分かります。
