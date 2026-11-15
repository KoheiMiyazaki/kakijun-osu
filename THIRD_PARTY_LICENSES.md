# Third-Party Licenses & Attributions (サードパーティライセンス・著作権表示)

本リポジトリをGitHub等へ公開・再配布するにあたり、使用している外部データおよびツールのライセンス・著作権表示を以下に明記します。

---

## 1. KanjiVG (ひらがな書き順SVGデータ・筆順座標データ)

本アプリのひらがな書き順お手本SVGおよび筆順判定用座標データは、**KanjiVG** プロジェクトのデータを使用しています。

- **プロジェクト名**: KanjiVG (Kanji Vector Graphics)
- **公式サイト**: https://kanjivg.tagaini.net/
- **著作権者 (Copyright)**: Copyright (C) 2009-2026 Ulrich Apel and contributors
- **ライセンス**: Creative Commons Attribution-ShareAlike 3.0 Unported (**CC BY-SA 3.0**)
- **ライセンス全文URL**: https://creativecommons.org/licenses/by-sa/3.0/

### 対象ファイル
- `hiragana/*.svg`
- `hiragana_strokes.json`（KanjiVG SVGパスから抽出した筆順座標データ）

### CC BY-SA 3.0 の主な条件
1. **表示（Attribution）**: 原著作者（Ulrich Apel / KanjiVG）のクレジット、KanjiVG公式サイトへのリンク、および本ライセンス（CC BY-SA 3.0）へのリンクを明記し、変更を加えた場合はその旨を表示する必要があります。
2. **継承（ShareAlike）**: これらのデータ（SVGおよびそこから派生した筆順座標JSONデータ）を改変・変換・二次利用して再配布する場合は、同一または互換性のあるライセンス（CC BY-SA 3.0）のもとで公開する必要があります。

> Original KanjiVG copyright header included in the SVG files:
>
> ```text
> Copyright (C) 2009/2010/2011 Ulrich Apel.
> This work is distributed under the conditions of the Creative Commons
> Attribution-Share Alike 3.0 Licence. This means you are free:
> * to Share - to copy, distribute and transmit the work
> * to Remix - to adapt the work
> Under the following conditions:
> * Attribution. You must attribute the work by stating your use of KanjiVG in
>   your own copyright header and linking to KanjiVG's website
>   (http://kanjivg.tagaini.net)
> * Share Alike. If you alter, transform, or build upon this work, you may
>   distribute the resulting work only under the same or similar license to this
>   one.
> See http://creativecommons.org/licenses/by-sa/3.0/ for more details.
> ```

---

## 2. Google Fonts (Webフォント・外部CSS読み込み)

HTML内でGoogle Fonts CDN経由で参照しているフォントは、各フォントのライセンス（主に SIL Open Font License 1.1）に基づいて提供されています（本リポジトリ内にフォントファイル自体は同梱していません）。

- **Yuji Boku** — SIL Open Font License 1.1
- **Reggae One** — SIL Open Font License 1.1
- **Klee One** — SIL Open Font License 1.1

---

## 3. ビルドツール・npmパッケージ (`package.json`)

開発・ビルド環境で使用しているパッケージ（Vite, TypeScript 等）は、各パッケージのライセンス（主に MIT / Apache-2.0 等）に従います。詳細は `package.json` および `node_modules` 内の各ライセンスファイルをご参照ください。
