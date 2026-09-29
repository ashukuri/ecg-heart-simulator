# ECG Heart Simulator

## 概要

12誘導心電図と、心臓内の刺激伝導・心筋脱分極・再分極・収縮を、同一のMaster Timeline上で同期表示する教育用Webシミュレーターです。心臓内の興奮伝播と各誘導の波形変化を見比べながら、心電図の成り立ちを学べます。

## 主な特徴

- 標準12誘導ECG、25 mm/s相当、10 mm/mV相当
- 教育用0.25×スロー再生
- SA node / AV node / His束 / bundle branches / Purkinjeの伝導表示
- 心臓内Activation Front、脱分極、再分極、収縮の同期表示
- RBBB / LBBB等の遅延伝導、AV block、AF / AFL、PAC / PVC、WPW、VT / TdP / VF
- 心筋梗塞、電解質異常などを含む、コード上の全26疾患
- 電気ベクトル表示と正常波形比較

## 使い方

1. 左側から疾患を選択します。
2. 中央の心臓で興奮伝播とActivation Frontを確認します。
3. 周囲の12誘導ECGを観察します。
4. ECGカーソルと心臓の興奮位置をMaster Timeline上で比較します。
5. 誘導を選択して右側の解説を確認します。
6. 必要に応じて電気ベクトルや正常波形比較を使用します。

## この教材で重視していること

単に異常波形を暗記するのではなく、どこから興奮が始まり、どこを速く伝わり、どこで遅れ、最後にどこが興奮するかを確認します。その結果として12誘導ECGがどのように変化するかを、心臓内の電気現象と波形の因果関係として理解することを目的としています。

## 公開Web版

[ECG Heart Simulatorを開く](https://ashukuri.github.io/ecg-heart-simulator/)

[日本語の使い方・解説ページ](https://ashukuri.github.io/ecg-heart-simulator/guide.html)

## 技術構成

- React
- TypeScript
- Vite
- Tailwind CSS
- SVG
- GitHub Actions
- GitHub Pages

## 起動方法

### 前提環境

- Node.js 22以上
- npm

```bash
npm ci
npm run dev
```

本番ビルドと検証:

```bash
npm run validate:ecg
npm run lint
npm run build
```

## 注意事項

本シミュレーターは教育目的です。診断・治療判断には使用しないでください。

実患者の心電図を再現する医療機器ではなく、教育用の典型的・模式的表現です。

## ライセンス

ライセンスは未指定です。
