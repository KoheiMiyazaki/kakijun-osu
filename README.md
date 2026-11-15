# かきじゅん押忍！ (Kakijun Osu!)

書き順通りになぞって空手技を繰り出す、子ども向け和風ひらがな書き順バトルPWAアプリです。

## 主な特徴
- ひらがな1文字ごとの書き順をリアルタイム判定し、空手の突き・蹴りで杉板を割る演出
- 連続正解で高まる道場全体の闘気・桜吹雪・火の粉エフェクト
- 第1問〜第10問の経過で移り変わる道場背景（朝〜夕暮れ〜月夜、第8問クリアで障子吹き飛ばし）
- スコアに応じた帯ランク昇段（しろおび〜かいでん）＆「しょうだん！」毛筆カットイン演出
- 和風BGM・少年気合ボイス・師範評価ボイス＆オフライン対応PWA

## 開発・ビルド手順

```bash
npm install
npm run dev
npm run build
```

## ライセンス・著作権表示 (License & Attribution)

- アプリケーション本体コード: [MIT License](./LICENSE)
- ひらがな書き順SVGおよび派生筆順座標データ: **[KanjiVG](https://kanjivg.tagaini.net/)**
  - Copyright (C) 2009-2026 Ulrich Apel
  - License: [Creative Commons Attribution-ShareAlike 3.0 Unported (CC BY-SA 3.0)](https://creativecommons.org/licenses/by-sa/3.0/)
  - 対象のSVGファイル（`hiragana/*.svg`）および派生JSONファイル（`hiragana_strokes.json`）は CC BY-SA 3.0 の条件に従います。

詳細は [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md) をご覧ください。
