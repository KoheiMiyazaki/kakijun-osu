/**
 * ============================================================================
 * かきじゅん押忍！ (Kakijun Osu!) - Core Application Logic
 * 
 * Copyright & Third-Party Attribution:
 * This application uses stroke order SVG graphics and derived stroke coordinate
 * data from KanjiVG (https://kanjivg.tagaini.net/), Copyright (C) 2009-2026
 * Ulrich Apel, distributed under the Creative Commons Attribution-ShareAlike
 * 3.0 Unported License (CC BY-SA 3.0: https://creativecommons.org/licenses/by-sa/3.0/).
 * See LICENSE and THIRD_PARTY_LICENSES.md for full details.
 * 
 * 共通ハーネスルール適用:
 * 1. データの分離と拡張性の確保 (GAME_CONFIG, HIRAGANA_CHAR_LIST, BELT_RANKS)
 * 2. オンメモリリソースの原則 (Web Audio APIシンセサイザー, インラインSVGキャラクター)
 * 3. スマホ最適化 (PointerEvent, Canvas DPI対応, localStorage永続化)
 * 4. PWAキャッシュクリーン (Service Worker更新検知と自動リロード)
 * 5. ルート直下相対パス設計 (./hiragana_strokes.json, ./hiragana/)
 * ============================================================================
 */

// ============================================================================
// 1. データの分離と拡張性の確保（拡張性ハーネス）
// ============================================================================

export const DIFFICULTY_PRESETS = {
  easy: {
    id: "easy",
    name: "かんたん",
    hint: "少し線がずれても大丈夫！たくさん技が出せる幼稚園・初心者向け設定（距離誤差マージン 2.0）。",
    tolerance: 2.0,
    penaltyMult: 2.2,
    startPenalty: 0.4,
    endPenalty: 0.35,
    maxPenalty: 0.2,
    passScore: 50,
    highSkillScore: 80,
    minScore: 35
  },
  normal: {
    id: "normal",
    name: "ふつう",
    hint: "初期の標準判定。お手本に沿ってしっかりと丁寧に描く道場基準設定（距離誤差マージン 1.0）。",
    tolerance: 1.0,
    penaltyMult: 3.8,
    startPenalty: 1.0,
    endPenalty: 0.8,
    maxPenalty: 0.4,
    passScore: 55,
    highSkillScore: 80,
    minScore: 10
  },
  hard: {
    id: "hard",
    name: "むずかしい",
    hint: "お手本通りに正確になぞらないと高得点が出ない厳しい師範判定（距離誤差マージン 0.5）。",
    tolerance: 0.5,
    penaltyMult: 5.0,
    startPenalty: 1.3,
    endPenalty: 1.0,
    maxPenalty: 0.5,
    passScore: 65,
    highSkillScore: 90,
    minScore: 0
  }
};

/**
 * ============================================================================
 * 濁点・半濁点機能モジュール（撤去・切り替え容易化ハーネス）
 * ============================================================================
 * 本機能が不要になった場合、下記 DAKUTEN_FEATURE_CONFIG.enabled を false にするだけで
 * 濁点・半濁点の出題が即座に停止し、アプリ全体が元の「清音のみ」の動作に安全に復帰します。
 */
export const DAKUTEN_FEATURE_CONFIG = {
  // 機能マスタースイッチ（撤去・無効化時はここを false にするだけで全機能オフ）
  enabled: true,

  // 初期状態で濁点・半濁点をゲーム出題に含めるか（true: 有効 / false: 清音のみ）
  defaultIncludeInQuiz: true,

  // 短いストローク（濁点゛の点、半濁点゜の丸など）の指描画判定に対する許容誤差倍率
  shortStrokeToleranceBonus: 1.5
};

// 濁点文字セット
export const DAKUTEN_CHARS = new Set([
  "が","ぎ","ぐ","げ","ご",
  "ざ","じ","ず","ぜ","ぞ",
  "だ","ぢ","づ","で","ど",
  "ば","び","ぶ","べ","ぼ"
]);

// 半濁点文字セット
export const HANDAKUTEN_CHARS = new Set([
  "ぱ","ぴ","ぷ","ぺ","ぽ"
]);

// 濁点・半濁点の全文字セット
export const DAKUTEN_HANDAKUTEN_CHARS = new Set([
  ...DAKUTEN_CHARS,
  ...HANDAKUTEN_CHARS
]);

export function isDakutenOrHandakutenChar(char) {
  return DAKUTEN_HANDAKUTEN_CHARS.has(char);
}

// 活字フォント上で濁点位置が通常位置と異なり児童が混乱しやすい出題除外文字
export const EXCLUDED_QUIZ_CHARS = new Set(["ぐ", "で"]);

export function containsExcludedQuizChar(word) {
  return Array.from(word).some(c => EXCLUDED_QUIZ_CHARS.has(c));
}

/**
 * 共通ハーネスルール1: データの分離と拡張性の確保（拡張性ハーネス）
 * 出題単語データ辞書（2文字、3文字、4文字、5文字）
 * 濁音・半濁音を含み（「ぐ」「で」を含む語は除外）、問題進行（第1〜2問:2文字、第3〜4問:3文字、第5〜7問:4文字、第8〜10問:5文字）に応じて
 * 動的かつランダムに選定されます。
 */
export const QUIZ_WORDS_BY_LENGTH = {
  "2": [
    // 清音（濁点・半濁点なし）
    "いぬ", "ねこ", "うみ", "やま", "そら",
    "ほし", "はな", "くも", "あめ", "ゆき",
    "とり", "くま", "さる", "しか", "かに",
    "つき", "ふね", "くつ", "かさ", "とら",
    "うま", "あり", "もも",
    // 濁点・半濁点あり
    "かぎ", "げた", "ごみ", "かぜ", "すず",
    "ぞう", "ちず", "まど", "えだ", "ぱん",
    "ぴざ", "かば", "へび", "ぶた", "なべ",
    "ばす", "どあ", "がむ", "びん", "おじ",
    "ぱぱ", "ぎん", "えび", "かべ", "ひげ"
  ],
  "3": [
    // 清音（濁点・半濁点なし）
    "おにく", "くるま", "さくら", "たいこ", "きつね",
    "たぬき", "すいか", "みかん", "めろん", "れもん",
    "ほたる", "かめら", "つくえ", "とけい", "はさみ",
    "えほん", "あひる", "いるか", "きりん", "ひよこ",
    // 濁点・半濁点あり
    "めがね", "うさぎ", "りんご", "たまご", "かぞく",
    "ねずみ", "すずめ", "からだ", "ごはん", "いちご",
    "ばなな", "はなび", "かぶと", "こぶた", "さんぽ",
    "らっぱ", "こっぷ", "はっぱ", "きっぷ", "しっぽ",
    "ぱんだ", "ごりら", "だんご", "ぶどう", "めだか",
    "みどり", "とびら", "てがみ", "まどべ"
  ],
  "4": [
    // 清音（濁点・半濁点なし）
    "こうえん", "おひさま", "おまつり", "たいよう", "せんせい",
    "さんかく", "しろくま", "しまうま", "やきいも", "おしるこ",
    "はちみつ", "ちいさい", "おおきい", "おやすみ", "かみなり",
    "ふうりん", "あめふり", "ひこうき", "ふみきり", "あやとり",
    // 濁点・半濁点あり
    "あさがお", "ともだち", "しんぶん", "てぶくろ", "てつぼう",
    "おにぎり", "にんじん", "えんぴつ", "けしごむ", "だいこん",
    "ざぶとん", "すいどう", "やきそば", "みずうみ", "かようび",
    "どようび", "たんぽぽ"
  ],
  "5": [
    // 清音（濁点・半濁点なし）
    "おとうさん", "おかあさん", "おにいさん", "おねえさん", "おむらいす",
    "さようなら", "ほんをよむ", "てをあらう", "くつをはく", "かたつむり",
    "なつやすみ", "はるやすみ", "ふゆやすみ", "あたらしい", "さくらもち",
    "なつまつり",
    // 濁点・半濁点あり
    "おべんとう", "らんどせる", "じてんしゃ", "じどうしゃ", "おてつだい",
    "ありがとう", "こんばんは", "かぶとむし", "だんごむし", "すなあそび",
    "すいようび", "はをみがく", "みずをのむ"
    // ※「ごめんなさい」「いただきます」「ごちそうさま」は6文字のため5文字枠から除外
  ]
};

/**
 * 問題番号（0-indexed）に応じた出題単語の対象文字数キーを取得
 * 第1問〜第2問 (0, 1): 2文字
 * 第3問〜第4問 (2, 3): 3文字
 * 第5問〜第7問 (4, 5, 6): 4文字
 * 第8問〜第10問 (7, 8, 9): 5文字
 */
export function getQuestionTargetLengthKey(qIndex) {
  if (qIndex <= 1) return "2";
  if (qIndex <= 3) return "3";
  if (qIndex <= 6) return "4";
  return "5";
}

/**
 * 各問題番号（第1問〜第10問）に応じた候補単語リストを取得
 * 実際の文字数が対象文字数と完全一致し、除外文字（ぐ・で）を含まない単語のみを厳密に抽出し、
 * 同一ゲームプレイ内の重複および直前・直近ゲームとの連続重複を防止します。
 * @param {number} qIndex 問題番号 (0..9)
 * @param {boolean} includeDakuten 濁点・半濁点を含めるか
 * @param {Set<string>} excludedWords 同一ゲーム内ですでに出題済みの単語セット
 * @param {Array<string>} recentWords 直近に出題された単語履歴配列
 * @param {string} lastWord 直前に出題された単語
 * @returns {Array<string>} 候補単語文字列の配列
 */
export function getQuizCandidateWordsForQuestion(
  qIndex,
  includeDakuten = true,
  excludedWords = new Set(),
  recentWords = [],
  lastWord = ""
) {
  const lenKey = getQuestionTargetLengthKey(qIndex);
  const targetLen = parseInt(lenKey, 10);
  // 重複定義を排除した上で、実際の文字数が targetLen と一致し、「ぐ」「で」を含まない単語のみを厳密に抽出
  let words = Array.from(new Set(QUIZ_WORDS_BY_LENGTH[lenKey] || []))
    .filter(w => Array.from(w).length === targetLen && !containsExcludedQuizChar(w));
  if (words.length === 0) {
    words = Array.from(new Set(Object.values(QUIZ_WORDS_BY_LENGTH).flat()))
      .filter(w => Array.from(w).length === targetLen && !containsExcludedQuizChar(w));
  }
  const allowDakuten = DAKUTEN_FEATURE_CONFIG.enabled && includeDakuten;
  if (!allowDakuten) {
    const seionWords = words.filter(w => !Array.from(w).some(c => isDakutenOrHandakutenChar(c)));
    if (seionWords.length > 0) words = seionWords;
  }

  const recentSet = new Set(Array.isArray(recentWords) ? recentWords : []);

  // 第1優先: 今ゲーム未出題 かつ 直近履歴にも無い かつ 直前単語でもない
  const freshWords = words.filter(w => !excludedWords.has(w) && !recentSet.has(w) && w !== lastWord);
  if (freshWords.length > 0) return freshWords;

  // 第2優先: 今ゲーム未出題 かつ 直前単語でもない
  const unpickedInGame = words.filter(w => !excludedWords.has(w) && w !== lastWord);
  if (unpickedInGame.length > 0) return unpickedInGame;

  // 第3優先: 直前と同じ問題が2回連続出ることだけは絶対に防ぐ
  const notImmediateRepeat = words.filter(w => w !== lastWord);
  return notImmediateRepeat.length > 0 ? notImmediateRepeat : words;
}

/**
 * 全単語のオブジェクト配列（設定画面デバッグ用および互換用）
 * @param {boolean} includeDakuten 濁点・半濁点を含めるか
 * @returns {Array<Object>} 出題単語オブジェクト配列
 */
export function getQuizCandidateWords(includeDakuten = true) {
  const allowDakuten = DAKUTEN_FEATURE_CONFIG.enabled && includeDakuten;
  const list = [];
  for (const [lenKey, words] of Object.entries(QUIZ_WORDS_BY_LENGTH)) {
    words.forEach(w => {
      if (containsExcludedQuizChar(w)) return;
      const hasDakuten = Array.from(w).some(c => isDakutenOrHandakutenChar(c));
      if (allowDakuten || !hasDakuten) {
        list.push({
          word: w,
          length: parseInt(lenKey, 10),
          category: `${lenKey}文字`
        });
      }
    });
  }
  return list;
}

export const WORD_DATA = Object.entries(QUIZ_WORDS_BY_LENGTH).flatMap(([lenKey, words]) => {
  return words.map((w, idx) => ({
    id: `w_${lenKey}_${idx}`,
    word: w,
    length: parseInt(lenKey, 10),
    category: `${lenKey}文字`
  }));
});

export const GAME_CONFIG = {
  title: "かきじゅん押忍！",
  totalQuestions: 10,
  scoreUnit: "押忍",
  unitSuffix: "押忍！",
  canvasCoordinateMax: 109,     // KanjiVG / JSONの標準座標範囲 (0〜109)
  
  /* タイトル画面設定（共通ハーネスルール1: データの分離と拡張性の確保） */
  titleScreenConfig: {
    titleLine1: "かきじゅん",
    titleLine2: "押忍！",
    subtitle: "和風ひらがな書き順バトル",
    startButtonLabel: "かいし！",
    /* TODO: 画像差し替え用パス */
    bgImage: "./assets/aistudio/title_bg.webp"
  },
  
  /* 主人公スプライトシート設定（全体 1024x768px、各コマ 256x384px） */
  spriteConfig: {
    useSpriteSheet: true,
    sheetUrl: "./assets/aistudio/karate_boy_4d6a3fcf.webp",
    frameWidth: 256,
    frameHeight: 384,
    sheetWidth: 1024,
    sheetHeight: 768,
    frames: {
      idle: { col: 0, row: 0, name: "ストローク待機中" },
      seiken_zuki: { col: 1, row: 0, name: "正拳突き" },
      punch: { col: 1, row: 0, name: "正拳突き" },
      shitazuki: { col: 2, row: 0, name: "下突き" },
      uraken: { col: 3, row: 0, name: "裏拳" },
      age_geri: { col: 0, row: 1, name: "上蹴り" },
      kick: { col: 0, row: 1, name: "上蹴り" },
      mawashi_geri: { col: 1, row: 1, name: "回し蹴り" },
      zukkoke: { col: 2, row: 1, name: "ずっこけ" }
    }
  },

  /* TODO: 個別画像差し替え用パス（将来単体画像ファイルに差し替える際はこちらを指定） */
  imagePaths: {
    useCustomImages: false, // trueにすると下記パスの個別画像を表示
    idle: "./assets/karate_idle.png",                 // 構え（通常待機時）
    seiken_zuki: "./assets/karate_seiken_zuki.png",   // パターン5: 正拳突き（通常）
    shitazuki: "./assets/karate_shitazuki.png",       // パターン1: 下突き（縦・下方向）
    uraken: "./assets/karate_uraken.png",             // パターン2: 裏拳（交差せず長い）
    mawashi_geri: "./assets/karate_mawashi_geri.png", // パターン3: 回し蹴り（交差して長い）
    age_geri: "./assets/karate_age_geri.png",         // パターン4: 上蹴り（終わりが上向き）
    zukkoke: "./assets/karate_zukkoke.png",           // パターン0: ずっこけ（スコア30未満）
    // 互換性エイリアス
    punch: "./assets/karate_seiken_zuki.png",
    kick: "./assets/karate_age_geri.png"
  },

  /* TODO: 盛り上げ役キャラクター画像差し替え用パス（将来本物の画像ファイルに差し替える際はこちらを指定：共通ハーネスルール1 & 2） */
  companionConfig: {
    useCustomImages: false, // trueにすると下記パスの画像を表示
    rabbit: {
      id: "rabbit",
      name: "白ハチマキウサギ",
      unlockScore: 100,
      description: "白いハチマキを締めた熱血ウサギ。少年の左足元で2足歩行の演武を同期する。",
      spriteConfig: {
        useSpriteSheet: true,
        sheetUrl: "./assets/aistudio/rabbit_karate_spritesheet.webp",
        frameWidth: 256,
        frameHeight: 384,
        sheetWidth: 1024,
        sheetHeight: 768,
        frames: {
          idle: { col: 0, row: 0, name: "構え（通常待機）" },
          punch: { col: 1, row: 0, name: "正拳突き" },
          seiken_zuki: { col: 1, row: 0, name: "正拳突き" },
          shitazuki: { col: 2, row: 0, name: "下突き" },
          uraken: { col: 3, row: 0, name: "裏拳" },
          kick: { col: 0, row: 1, name: "上蹴り" },
          age_geri: { col: 0, row: 1, name: "上蹴り" },
          mawashi_geri: { col: 1, row: 1, name: "回し蹴り" },
          zukkoke: { col: 2, row: 1, name: "ずっこけ（技失敗）" }
        }
      },
      images: {
        idle: "./assets/companion_rabbit_idle.png",
        seiken_zuki: "./assets/companion_rabbit_seiken_zuki.png",
        shitazuki: "./assets/companion_rabbit_shitazuki.png",
        uraken: "./assets/companion_rabbit_uraken.png",
        mawashi_geri: "./assets/companion_rabbit_mawashi_geri.png",
        age_geri: "./assets/companion_rabbit_age_geri.png",
        zukkoke: "./assets/companion_rabbit_zukkoke.png"
      }
    },
    kintaro: {
      id: "kintaro",
      name: "金太郎",
      unlockScore: 300,
      description: "赤い腹掛けを身につけた力持ちの少年空手家。力強く元気いっぱいに空手技を少年と同期して繰り出す。",
      spriteConfig: {
        useSpriteSheet: true,
        sheetUrl: "./assets/aistudio/kintaro_karate_spritesheet.webp",
        frameWidth: 256,
        frameHeight: 384,
        sheetWidth: 1024,
        sheetHeight: 768,
        frames: {
          idle: { col: 0, row: 0, name: "構え（通常待機）" },
          punch: { col: 1, row: 0, name: "正拳突き" },
          seiken_zuki: { col: 1, row: 0, name: "正拳突き" },
          shitazuki: { col: 2, row: 0, name: "下突き" },
          uraken: { col: 3, row: 0, name: "裏拳" },
          kick: { col: 0, row: 1, name: "上蹴り" },
          age_geri: { col: 0, row: 1, name: "上蹴り" },
          mawashi_geri: { col: 1, row: 1, name: "回し蹴り" },
          zukkoke: { col: 2, row: 1, name: "ずっこけ（技失敗）" }
        }
      },
      images: {
        idle: "./assets/companion_kintaro_idle.png",
        seiken_zuki: "./assets/companion_kintaro_seiken_zuki.png",
        shitazuki: "./assets/companion_kintaro_shitazuki.png",
        uraken: "./assets/companion_kintaro_uraken.png",
        mawashi_geri: "./assets/companion_kintaro_mawashi_geri.png",
        age_geri: "./assets/companion_kintaro_age_geri.png",
        zukkoke: "./assets/companion_kintaro_zukkoke.png"
      }
    },
    turtle: {
      id: "turtle",
      name: "赤ハチマキカメ",
      unlockScore: 200,
      description: "赤いハチマキを締めた努力家カメ。少年の右足元で重厚な空手技を同期する。",
      spriteConfig: {
        useSpriteSheet: true,
        sheetUrl: "./assets/aistudio/turtle_karate_spritesheet.webp",
        frameWidth: 256,
        frameHeight: 384,
        sheetWidth: 1024,
        sheetHeight: 768,
        frames: {
          idle: { col: 0, row: 0, name: "構え（通常待機）" },
          punch: { col: 1, row: 0, name: "正拳突き" },
          seiken_zuki: { col: 1, row: 0, name: "正拳突き" },
          shitazuki: { col: 2, row: 0, name: "下突き" },
          uraken: { col: 3, row: 0, name: "裏拳" },
          kick: { col: 0, row: 1, name: "上蹴り" },
          age_geri: { col: 0, row: 1, name: "上蹴り" },
          mawashi_geri: { col: 1, row: 1, name: "回し蹴り" },
          zukkoke: { col: 2, row: 1, name: "ずっこけ（技失敗）" }
        }
      },
      images: {
        idle: "./assets/companion_turtle_idle.png",
        seiken_zuki: "./assets/companion_turtle_seiken_zuki.png",
        shitazuki: "./assets/companion_turtle_shitazuki.png",
        uraken: "./assets/companion_turtle_uraken.png",
        mawashi_geri: "./assets/companion_turtle_mawashi_geri.png",
        age_geri: "./assets/companion_turtle_age_geri.png",
        zukkoke: "./assets/companion_turtle_zukkoke.png"
      }
    },
    red_riding_hood: {
      id: "red_riding_hood",
      name: "赤ずきんの女の子",
      unlockScore: 250,
      description: "カメの右横に登場する赤い頭巾をかぶった勇敢な女の子空手家。華麗な空手技を少年と同期して繰り出す。",
      spriteConfig: {
        useSpriteSheet: true,
        sheetUrl: "./assets/aistudio/hood_karate_spritesheet.webp",
        frameWidth: 256,
        frameHeight: 384,
        sheetWidth: 1024,
        sheetHeight: 768,
        frames: {
          idle: { col: 0, row: 0, name: "構え（通常待機）" },
          punch: { col: 1, row: 0, name: "正拳突き" },
          seiken_zuki: { col: 1, row: 0, name: "正拳突き" },
          shitazuki: { col: 2, row: 0, name: "下突き" },
          uraken: { col: 3, row: 0, name: "裏拳" },
          kick: { col: 0, row: 1, name: "上蹴り" },
          age_geri: { col: 0, row: 1, name: "上蹴り" },
          mawashi_geri: { col: 1, row: 1, name: "回し蹴り" },
          zukkoke: { col: 2, row: 1, name: "ずっこけ（技失敗）" }
        }
      },
      images: {
        idle: "./assets/companion_red_riding_hood_idle.png",
        seiken_zuki: "./assets/companion_red_riding_hood_seiken_zuki.png",
        shitazuki: "./assets/companion_red_riding_hood_shitazuki.png",
        uraken: "./assets/companion_red_riding_hood_uraken.png",
        mawashi_geri: "./assets/companion_red_riding_hood_mawashi_geri.png",
        age_geri: "./assets/companion_red_riding_hood_age_geri.png",
        zukkoke: "./assets/companion_red_riding_hood_zukkoke.png"
      }
    },
    girl: {
      id: "girl",
      name: "道着の女の子空手家",
      unlockScore: 300,
      description: "ポニーテールの頼もしい女の子空手家。少年の左背後でキレのある技を披露する。",
      spriteConfig: {
        useSpriteSheet: true,
        sheetUrl: "./assets/aistudio/girl_karate_spritesheet.webp",
        frameWidth: 256,
        frameHeight: 384,
        sheetWidth: 1024,
        sheetHeight: 768,
        frames: {
          idle: { col: 0, row: 0, name: "構え（通常待機）" },
          punch: { col: 1, row: 0, name: "正拳突き" },
          seiken_zuki: { col: 1, row: 0, name: "正拳突き" },
          shitazuki: { col: 2, row: 0, name: "下突き" },
          uraken: { col: 3, row: 0, name: "裏拳" },
          kick: { col: 0, row: 1, name: "上蹴り" },
          age_geri: { col: 0, row: 1, name: "上蹴り" },
          mawashi_geri: { col: 1, row: 1, name: "回し蹴り" },
          zukkoke: { col: 2, row: 1, name: "ずっこけ（技失敗）" }
        }
      },
      images: {
        idle: "./assets/companion_girl_idle.png",
        seiken_zuki: "./assets/companion_girl_seiken_zuki.png",
        shitazuki: "./assets/companion_girl_shitazuki.png",
        uraken: "./assets/companion_girl_uraken.png",
        mawashi_geri: "./assets/companion_girl_mawashi_geri.png",
        age_geri: "./assets/companion_girl_age_geri.png",
        zukkoke: "./assets/companion_girl_zukkoke.png"
      }
    },
    wolf: {
      id: "wolf",
      name: "オオカミ",
      unlockScore: 350,
      description: "赤ずきんの右横に登場する童話のオオカミ空手家。大きな体躯で迫力ある空手技を少年と同期して繰り出す。",
      spriteConfig: {
        useSpriteSheet: true,
        sheetUrl: "./assets/aistudio/wolf_karate_spritesheet.webp",
        frameWidth: 256,
        frameHeight: 384,
        sheetWidth: 1024,
        sheetHeight: 768,
        frames: {
          idle: { col: 0, row: 0, name: "構え（通常待機）" },
          punch: { col: 1, row: 0, name: "正拳突き" },
          seiken_zuki: { col: 1, row: 0, name: "正拳突き" },
          shitazuki: { col: 2, row: 0, name: "下突き" },
          uraken: { col: 3, row: 0, name: "裏拳" },
          kick: { col: 0, row: 1, name: "上蹴り" },
          age_geri: { col: 0, row: 1, name: "上蹴り" },
          mawashi_geri: { col: 1, row: 1, name: "回し蹴り" },
          zukkoke: { col: 2, row: 1, name: "ずっこけ（技失敗）" }
        }
      },
      images: {
        idle: "./assets/companion_wolf_idle.png",
        seiken_zuki: "./assets/companion_wolf_seiken_zuki.png",
        shitazuki: "./assets/companion_wolf_shitazuki.png",
        uraken: "./assets/companion_wolf_uraken.png",
        mawashi_geri: "./assets/companion_wolf_mawashi_geri.png",
        age_geri: "./assets/companion_wolf_age_geri.png",
        zukkoke: "./assets/companion_wolf_zukkoke.png"
      }
    },
    boy_ally: {
      id: "boy_ally",
      name: "道着の男の子空手家",
      unlockScore: 400,
      description: "青バンダナを巻いた男の子の仲間空手家。少年の右背後で迫力の技を繰り出す。",
      spriteConfig: {
        useSpriteSheet: true,
        sheetUrl: "./assets/aistudio/boy_ally_spritesheet.webp",
        frameWidth: 256,
        frameHeight: 384,
        sheetWidth: 1024,
        sheetHeight: 768,
        frames: {
          idle: { col: 0, row: 0, name: "構え（通常待機）" },
          punch: { col: 1, row: 0, name: "正拳突き" },
          seiken_zuki: { col: 1, row: 0, name: "正拳突き" },
          shitazuki: { col: 2, row: 0, name: "下突き" },
          uraken: { col: 3, row: 0, name: "裏拳" },
          kick: { col: 0, row: 1, name: "上蹴り" },
          age_geri: { col: 0, row: 1, name: "上蹴り" },
          mawashi_geri: { col: 1, row: 1, name: "回し蹴り" },
          zukkoke: { col: 2, row: 1, name: "ずっこけ（技失敗）" }
        }
      },
      images: {
        idle: "./assets/companion_boy_ally_idle.png",
        seiken_zuki: "./assets/companion_boy_ally_seiken_zuki.png",
        shitazuki: "./assets/companion_boy_ally_shitazuki.png",
        uraken: "./assets/companion_boy_ally_uraken.png",
        mawashi_geri: "./assets/companion_boy_ally_mawashi_geri.png",
        age_geri: "./assets/companion_boy_ally_age_geri.png",
        zukkoke: "./assets/companion_boy_ally_zukkoke.png"
      }
    },
    monkey: {
      id: "monkey",
      name: "サル",
      unlockScore: 500,
      description: "猿蟹合戦のひょうきんなサルの空手家。親しみやすい表情とコミカルな動きで空手技を少年と同期して繰り出す。",
      spriteConfig: {
        useSpriteSheet: true,
        sheetUrl: "./assets/aistudio/monkey_karate_spritesheet.webp",
        frameWidth: 256,
        frameHeight: 384,
        sheetWidth: 1024,
        sheetHeight: 768,
        frames: {
          idle: { col: 0, row: 0, name: "構え（通常待機）" },
          punch: { col: 1, row: 0, name: "正拳突き" },
          seiken_zuki: { col: 1, row: 0, name: "正拳突き" },
          shitazuki: { col: 2, row: 0, name: "下突き" },
          uraken: { col: 3, row: 0, name: "裏拳" },
          kick: { col: 0, row: 1, name: "上蹴り" },
          age_geri: { col: 0, row: 1, name: "上蹴り" },
          mawashi_geri: { col: 1, row: 1, name: "回し蹴り" },
          zukkoke: { col: 2, row: 1, name: "ずっこけ（技失敗）" }
        }
      },
      images: {
        idle: "./assets/companion_monkey_idle.png",
        seiken_zuki: "./assets/companion_monkey_seiken_zuki.png",
        shitazuki: "./assets/companion_monkey_shitazuki.png",
        uraken: "./assets/companion_monkey_uraken.png",
        mawashi_geri: "./assets/companion_monkey_mawashi_geri.png",
        age_geri: "./assets/companion_monkey_age_geri.png",
        zukkoke: "./assets/companion_monkey_zukkoke.png"
      }
    }
  },

  /* 音声差し替え用パス（Gemini TTS生成 最高品質 少年空手ボイス & 師範5区分15種類ボイス・軽量MP3統一） */
  audioPaths: {
    useCustomAudio: true, // trueにするとGemini TTS少年ボイス・師範音声ファイルを使用
    boyKiai: "./audio/boy_kiai_ei.mp3",
    boyKickKiai: "./audio/boy_kiai_kick.mp3",
    boyKiaiSei: "./audio/boy_kiai_sei.mp3",
    // 師範評価ボイス（5区分・各3セリフ計15種類・軽量MP3）
    shihan_katsu: "./audio/shihan_katsu.mp3",
    shihan_shugyo: "./audio/shihan_shugyo.mp3",
    shihan_kiai_irenaose: "./audio/shihan_kiai_irenaose.mp3",
    shihan_maamaa: "./audio/shihan_maamaa.mp3",
    shihan_warukuwanai: "./audio/shihan_warukuwanai.mp3",
    shihan_mousukoshi: "./audio/shihan_mousukoshi.mp3",
    shihan_hou_yarunou: "./audio/shihan_hou_yarunou.mp3",
    shihan_iizo_sonochoushi: "./audio/shihan_iizo_sonochoushi.mp3",
    shihan_kire: "./audio/shihan_kire.mp3",
    shihan_migoto: "./audio/shihan_migoto.mp3",
    shihan_subarashii: "./audio/shihan_subarashii.mp3",
    shihan_onushi: "./audio/shihan_onushi.mp3",
    shihan_appare: "./audio/shihan_appare.mp3",
    shihan_monkunashi: "./audio/shihan_monkunashi.mp3",
    shihan_kamigakatteru: "./audio/shihan_kamigakatteru.mp3",
    // 空手・和風道場BGM（ゲーム画面専用・軽量MP3シームレスループ）
    bgm: "./audio/dojo_bgm.mp3"
  },

  // 空手段位・帯の色設定（1問あたり0〜100点、全10問1000点満点に対応）
  beltRanks: [
    { name: "しろおび", color: "#F4F4F5", textColor: "#18181B", border: "#A1A1AA", minScore: 0 },
    { name: "きおび", color: "#FBBF24", textColor: "#78350F", border: "#D97706", minScore: 200 },
    { name: "あおおび", color: "#2563EB", textColor: "#FFFFFF", border: "#1D4ED8", minScore: 300 },
    { name: "みどりおび", color: "#10B981", textColor: "#FFFFFF", border: "#047857", minScore: 400 },
    { name: "むらさきおび", color: "#8B5CF6", textColor: "#FFFFFF", border: "#6D28D9", minScore: 500 },
    { name: "ちゃおび", color: "#854D0E", textColor: "#FEF3C7", border: "#713F12", minScore: 600 },
    { name: "くろおび", color: "#18181B", textColor: "#F4F4F5", border: "#000000", minScore: 700 },
    { name: "かいでん", color: "#DC2626", textColor: "#FFFFFF", border: "#991B1B", minScore: 900 }
  ],

  // 評価ランク判定テーブル（幼稚園児向けにひらがな化）
  evaluations: [
    { min: 90, text: "いっぽん！ みごと！", class: "super", actionText: "おす！" },
    { min: 75, text: "わざあり！ いいぞ！", class: "high", actionText: "せいっ！" },
    { min: 50, text: "ゆうこう！ よし！", class: "normal", actionText: "おす！" },
    { min: 0,  text: "もういっかい！", class: "miss", actionText: "せいっ！" }
  ]
};

/**
 * 共通ハーネスルール1: データの分離と拡張性の確保
 * タイトル画面・スコアランキング TOP 5 設定定義
 */
export const LEADERBOARD_CONFIG = {
  storageKey: 'kakijun_osu_leaderboard_v1',
  maxEntries: 5,
  medalColors: {
    1: { fill: '#fbbf24', stroke: '#fef08a', ribbon: '#dc2626', text: '#78350f' },
    2: { fill: '#cbd5e1', stroke: '#f8fafc', ribbon: '#2563eb', text: '#1e293b' },
    3: { fill: '#d97706', stroke: '#fde68a', ribbon: '#059669', text: '#451a03' }
  }
};

export function getBeltRankForScore(score) {
  const numericScore = Number.isFinite(Number(score)) ? Number(score) : 0;
  const ranks = GAME_CONFIG.beltRanks;
  let current = ranks[0];
  for (const r of ranks) {
    if (numericScore >= r.minScore) {
      current = r;
    }
  }
  return current;
}

export function formatLeaderboardDate(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
  }
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/**
 * 共通ハーネスルール1: データの分離と拡張性の確保
 * 道場全体の和風闘気パーティクル（桜吹雪・火の粉・気流）設定テーブル
 */
export const COMBO_MILESTONES_CONFIG = [
  { threshold: 5,  seal: '気', title: 'きあい！',       sub: '5れんぞく！',  badgeIcon: '🌸', themeClass: 'milestone-5',  ringColor: '#fda4af', ringCount: 1 },
  { threshold: 10, seal: '風', title: 'しっぷう！',     sub: '10れんぞく！', badgeIcon: '🔥', themeClass: 'milestone-10', ringColor: '#fb923c', ringCount: 1 },
  { threshold: 15, seal: '桜', title: 'さくらあらし！', sub: '15れんぞく！', badgeIcon: '🌪️', themeClass: 'milestone-15', ringColor: '#fde047', ringCount: 2 },
  { threshold: 20, seal: '炎', title: 'ぐれん！',       sub: '20れんぞく！', badgeIcon: '💮', themeClass: 'milestone-20', ringColor: '#ef4444', ringCount: 2 },
  { threshold: 30, seal: '雷', title: 'そうえん！',     sub: '30れんぞく！', badgeIcon: '⚡', themeClass: 'milestone-30', ringColor: '#38bdf8', ringCount: 3 },
  { threshold: 40, seal: '龍', title: 'てんかむそう！', sub: '40れんぞく！', badgeIcon: '🐉', themeClass: 'milestone-40', ringColor: '#facc15', ringCount: 3 }
];

export const DOJO_AURA_CONFIG = {
  tiers: [
    {
      tier: 0,
      minCombo: 0,
      className: "",
      maxAmbient: 0,
      sakuraRatio: 0.75,
      windSpeed: 0,
      streakRate: 0,
      goldLeafRate: 0,
      lightningRate: 0,
      burstScale: 1.0,
      sakuraColors: ["#fbcfe8", "#f9a8d4", "#fff1f2"],
      emberColors: ["#fbbf24", "#fb923c"]
    },
    {
      tier: 1,
      minCombo: 1,
      className: "aura-tier-1",
      maxAmbient: 14,
      sakuraRatio: 0.74,
      windSpeed: 1.0,
      streakRate: 0,
      goldLeafRate: 0,
      lightningRate: 0,
      burstScale: 1.05,
      sakuraColors: ["#fbcfe8", "#f9a8d4", "#ffe4e6", "#fda4af"],
      emberColors: ["#fbbf24", "#fb923c", "#f59e0b"]
    },
    {
      tier: 2,
      minCombo: 5,
      className: "aura-tier-2",
      maxAmbient: 28,
      sakuraRatio: 0.64,
      windSpeed: 1.3,
      streakRate: 0.02,
      goldLeafRate: 0,
      lightningRate: 0,
      burstScale: 1.22,
      sakuraColors: ["#fbcfe8", "#f9a8d4", "#fda4af", "#fff1f2"],
      emberColors: ["#fef08a", "#fbbf24", "#f97316", "#ef4444"]
    },
    {
      tier: 3,
      minCombo: 10,
      className: "aura-tier-3",
      maxAmbient: 44,
      sakuraRatio: 0.56,
      windSpeed: 1.65,
      streakRate: 0.08,
      goldLeafRate: 0,
      lightningRate: 0,
      burstScale: 1.42,
      sakuraColors: ["#fbcfe8", "#f472b6", "#fda4af", "#ffe4e6"],
      emberColors: ["#ffffff", "#fef08a", "#f59e0b", "#ef4444"]
    },
    {
      tier: 4,
      minCombo: 15,
      className: "aura-tier-4",
      maxAmbient: 60,
      sakuraRatio: 0.58,
      windSpeed: 1.95,
      streakRate: 0.13,
      goldLeafRate: 0.12,
      lightningRate: 0,
      burstScale: 1.6,
      sakuraColors: ["#f9a8d4", "#fb7185", "#fda4af", "#fff1f2"],
      emberColors: ["#ffffff", "#fef08a", "#fbbf24", "#fb7185"]
    },
    {
      tier: 5,
      minCombo: 20,
      className: "aura-tier-5",
      maxAmbient: 78,
      sakuraRatio: 0.48,
      windSpeed: 2.3,
      streakRate: 0.18,
      goldLeafRate: 0.18,
      lightningRate: 0,
      burstScale: 1.82,
      sakuraColors: ["#f9a8d4", "#f43f5e", "#fda4af", "#fff1f2"],
      emberColors: ["#ffffff", "#fef08a", "#fb923c", "#dc2626"]
    },
    {
      tier: 6,
      minCombo: 30,
      className: "aura-tier-6",
      maxAmbient: 96,
      sakuraRatio: 0.44,
      windSpeed: 2.75,
      streakRate: 0.25,
      goldLeafRate: 0.20,
      lightningRate: 0.06,
      burstScale: 2.08,
      sakuraColors: ["#fce7f3", "#fbcfe8", "#e0f2fe", "#ffffff"],
      emberColors: ["#ffffff", "#a5f3fc", "#38bdf8", "#2563eb"]
    },
    {
      tier: 7,
      minCombo: 40,
      className: "aura-tier-7",
      maxAmbient: 120,
      sakuraRatio: 0.42,
      windSpeed: 3.2,
      streakRate: 0.34,
      goldLeafRate: 0.32,
      lightningRate: 0.12,
      burstScale: 2.35,
      sakuraColors: ["#fef9c3", "#fce7f3", "#e0f2fe", "#ffffff"],
      emberColors: ["#ffffff", "#fde047", "#38bdf8", "#f59e0b"]
    }
  ]
};

/**
 * 共通ハーネスルール1: データの分離と拡張性の確保
 * 第一問〜第十問の経過に応じた道場環境変化テーブル（時間帯・月の高さ・障子の開閉と揺れ）
 */
export const DOJO_ENVIRONMENT_CONFIG = [
  { qIndex: 0, phase: 1, skyClass: "env-phase-1", nightMode: false, shojiOpen: 0.00, shojiBlownAway: false, shojiSway: 0, bambooSway: 0, moonProgress: 0.00, moonOpacity: 0.00, starsOpacity: 0.00, label: "第一問：静かな朝の道場" },
  { qIndex: 1, phase: 1, skyClass: "env-phase-1", nightMode: false, shojiOpen: 0.10, shojiBlownAway: false, shojiSway: 0, bambooSway: 0, moonProgress: 0.04, moonOpacity: 0.00, starsOpacity: 0.00, label: "第二問：朝の光" },
  { qIndex: 2, phase: 2, skyClass: "env-phase-2", nightMode: false, shojiOpen: 0.24, shojiBlownAway: false, shojiSway: 1, bambooSway: 1, moonProgress: 0.14, moonOpacity: 0.16, starsOpacity: 0.00, label: "第三問：木漏れ日と微風" },
  { qIndex: 3, phase: 2, skyClass: "env-phase-2", nightMode: false, shojiOpen: 0.38, shojiBlownAway: false, shojiSway: 1, bambooSway: 1, moonProgress: 0.28, moonOpacity: 0.34, starsOpacity: 0.00, label: "第四問：風立ち始め" },
  { qIndex: 4, phase: 3, skyClass: "env-phase-3", nightMode: false, shojiOpen: 0.54, shojiBlownAway: false, shojiSway: 2, bambooSway: 2, moonProgress: 0.44, moonOpacity: 0.62, starsOpacity: 0.18, label: "第五問：茜の夕暮れ・夕月" },
  { qIndex: 5, phase: 3, skyClass: "env-phase-3", nightMode: false, shojiOpen: 0.66, shojiBlownAway: false, shojiSway: 2, bambooSway: 2, moonProgress: 0.58, moonOpacity: 0.80, starsOpacity: 0.38, label: "第六問：逢魔時の揺れる障子" },
  { qIndex: 6, phase: 4, skyClass: "env-phase-4", nightMode: true,  shojiOpen: 0.78, shojiBlownAway: false, shojiSway: 3, bambooSway: 3, moonProgress: 0.72, moonOpacity: 0.92, starsOpacity: 0.68, label: "第七問：宵闇と昇る月" },
  { qIndex: 7, phase: 4, skyClass: "env-phase-4", nightMode: true,  shojiOpen: 0.86, shojiBlownAway: false, shojiSway: 3, bambooSway: 3, moonProgress: 0.84, moonOpacity: 0.97, starsOpacity: 0.85, label: "第八問：星月夜の熱気" },
  { qIndex: 8, phase: 5, skyClass: "env-phase-5", nightMode: true,  shojiOpen: 2.80, shojiBlownAway: true,  shojiSway: 4, bambooSway: 4, moonProgress: 0.94, moonOpacity: 1.00, starsOpacity: 0.96, label: "第九問：満月の真剣勝負" },
  { qIndex: 9, phase: 5, skyClass: "env-phase-5", nightMode: true,  shojiOpen: 2.80, shojiBlownAway: true,  shojiSway: 4, bambooSway: 4, moonProgress: 1.00, moonOpacity: 1.00, starsOpacity: 1.00, label: "第十問：満月決戦道場" }
];

// 漢数字変換マッピング
const KANJI_NUMBERS = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

/**
 * 共通ハーネスルール1: データの分離と拡張性の確保
 * 師範（80代仙人・永井一郎風）の出来栄え（0〜100点）評価テーブル
 * 5つの範囲ごとに3つずつセリフを定義し、各範囲からランダムに選んで再生
 */
export const SHIHAN_EVALUATION_TIERS = [
  {
    tierId: "tier_90_plus",
    name: "90点以上（神技・免許皆伝）",
    minScore: 90,
    maxScore: 100,
    lines: [
      { id: "shihan_appare", text: "あっぱれじゃー！！！", durationSec: 1.35, mp3Path: "./audio/shihan_appare.mp3" },
      { id: "shihan_monkunashi", text: "文句なしっ！！！", durationSec: 1.06, mp3Path: "./audio/shihan_monkunashi.mp3" },
      { id: "shihan_kamigakatteru", text: "神がかっておる～！！！", durationSec: 1.82, mp3Path: "./audio/shihan_kamigakatteru.mp3" }
    ]
  },
  {
    tierId: "tier_80_89",
    name: "80～89点（見事・師範代）",
    minScore: 80,
    maxScore: 89,
    lines: [
      { id: "shihan_migoto", text: "見事じゃ～！", durationSec: 0.91, mp3Path: "./audio/shihan_migoto.mp3" },
      { id: "shihan_subarashii", text: "すばらしい～！", durationSec: 1.72, mp3Path: "./audio/shihan_subarashii.mp3" },
      { id: "shihan_onushi", text: "おぬし、やりおるのう～！", durationSec: 2.44, mp3Path: "./audio/shihan_onushi.mp3" }
    ]
  },
  {
    tierId: "tier_70_79",
    name: "70～79点（技あり・有段者）",
    minScore: 70,
    maxScore: 79,
    lines: [
      { id: "shihan_hou_yarunou", text: "ほう、やるのう。", durationSec: 1.81, mp3Path: "./audio/shihan_hou_yarunou.mp3" },
      { id: "shihan_iizo_sonochoushi", text: "いいぞ、その調子じゃー！", durationSec: 2.11, mp3Path: "./audio/shihan_iizo_sonochoushi.mp3" },
      { id: "shihan_kire", text: "なかなかのキレじゃ！", durationSec: 1.68, mp3Path: "./audio/shihan_kire.mp3" }
    ]
  },
  {
    tierId: "tier_50_69",
    name: "50～69点（有効・修行中）",
    minScore: 50,
    maxScore: 69,
    lines: [
      { id: "shihan_maamaa", text: "まあまあじゃ。", durationSec: 1.46, mp3Path: "./audio/shihan_maamaa.mp3" },
      { id: "shihan_warukuwanai", text: "悪くはないぞ。", durationSec: 1.13, mp3Path: "./audio/shihan_warukuwanai.mp3" },
      { id: "shihan_mousukoshi", text: "もう少しじゃな。", durationSec: 1.25, mp3Path: "./audio/shihan_mousukoshi.mp3" }
    ]
  },
  {
    tierId: "tier_under_50",
    name: "50点未満（喝・気合の入れ直し）",
    minScore: 0,
    maxScore: 49,
    lines: [
      { id: "shihan_katsu", text: "喝（かーーつ）！！！", durationSec: 0.66, mp3Path: "./audio/shihan_katsu.mp3" },
      { id: "shihan_shugyo", text: "修行が足りん！！", durationSec: 1.27, mp3Path: "./audio/shihan_shugyo.mp3" },
      { id: "shihan_kiai_irenaose", text: "気合を入れなおせ！！", durationSec: 1.44, mp3Path: "./audio/shihan_kiai_irenaose.mp3" }
    ]
  }
];

// 気合・師範ボイスのメタデータ（ファイルサイズ・長さ・用途一覧：共通ハーネスルール1）
export const VOICE_SELECTION_DATA = [
  // ５）90点以上
  {
    id: "shihan_appare",
    title: "師範 (90点以上) : 「あっぱれじゃー！！！」",
    duration: "1.35秒",
    usage: "出題された文字列を90点以上の神技・免許皆伝レベルで完成させた際、師範が両手を上げて狂喜乱舞する最大級の賛辞ボイス。",
    mp3Path: "./audio/shihan_appare.mp3",
    mp3Size: "28.2 KB",
    mp3Bytes: "28,845 B"
  },
  {
    id: "shihan_monkunashi",
    title: "師範 (90点以上) : 「文句なしっ！！！」",
    duration: "1.06秒",
    usage: "一切の隙のない完璧な筆跡に対して、師範が力強く太鼓判を押す痛快な太鼓判ボイス。",
    mp3Path: "./audio/shihan_monkunashi.mp3",
    mp3Size: "22.1 KB",
    mp3Bytes: "22,605 B"
  },
  {
    id: "shihan_kamigakatteru",
    title: "師範 (90点以上) : 「神がかっておる～！！！」",
    duration: "1.82秒",
    usage: "神仏降臨を思わせる超絶技巧の美しい運筆に、仙人師範が息を呑んで感嘆する熱狂ボイス。",
    mp3Path: "./audio/shihan_kamigakatteru.mp3",
    mp3Size: "37.1 KB",
    mp3Bytes: "37,965 B"
  },

  // ４）80～89点
  {
    id: "shihan_migoto",
    title: "師範 (80～89点) : 「見事じゃ～！」",
    duration: "0.91秒",
    usage: "堂々たる筆跡で見事な文字を書き上げた弟子に、師範が深く頷いて讃えるボイス。",
    mp3Path: "./audio/shihan_migoto.mp3",
    mp3Size: "19.3 KB",
    mp3Bytes: "19,725 B"
  },
  {
    id: "shihan_subarashii",
    title: "師範 (80～89点) : 「すばらし〜いっ！！！」",
    duration: "1.72秒",
    usage: "各文字列（問題）のクリア評価で80点（押忍）以上を獲得したとき、弟子の見事な腕前に大興奮した師範が一段高い声と熱狂的ハイテンションで叫ぶ絶賛ボイス。",
    mp3Path: "./audio/shihan_subarashii.mp3",
    mp3Size: "35.2 KB",
    mp3Bytes: "36,045 B"
  },
  {
    id: "shihan_onushi",
    title: "師範 (80～89点) : 「おぬし、やりおるのう～！」",
    duration: "2.44秒",
    usage: "想定以上の実力を発揮した弟子の成長を嬉しそうに目を細めて褒めちぎるボイス。",
    mp3Path: "./audio/shihan_onushi.mp3",
    mp3Size: "49.3 KB",
    mp3Bytes: "50,445 B"
  },

  // ３）70～79点
  {
    id: "shihan_hou_yarunou",
    title: "師範 (70～79点) : 「ほう、やるのう。」",
    duration: "1.81秒",
    usage: "70点台の確かな腕前を見せた弟子に、白い髭を撫でながら感心する師範のボイス。",
    mp3Path: "./audio/shihan_hou_yarunou.mp3",
    mp3Size: "37.1 KB",
    mp3Bytes: "37,965 B"
  },
  {
    id: "shihan_iizo_sonochoushi",
    title: "師範 (70～79点) : 「いいぞ、その調子じゃー！」",
    duration: "2.11秒",
    usage: "リズム良くストロークを決めた弟子を鼓舞する明るく温かい激励ボイス。",
    mp3Path: "./audio/shihan_iizo_sonochoushi.mp3",
    mp3Size: "42.7 KB",
    mp3Bytes: "43,725 B"
  },
  {
    id: "shihan_kire",
    title: "師範 (70～79点) : 「なかなかのキレじゃ！」",
    duration: "1.68秒",
    usage: "ハネ・トメ・ハライの鋭いキレ味を武道師範ならではの目線で評価するボイス。",
    mp3Path: "./audio/shihan_kire.mp3",
    mp3Size: "34.3 KB",
    mp3Bytes: "35,085 B"
  },

  // ２）50～69点
  {
    id: "shihan_maamaa",
    title: "師範 (50～69点) : 「まあまあじゃ。」",
    duration: "1.46秒",
    usage: "基本は押さえつつも改善の余地がある弟子に、穏やかに頷きながら語りかけるボイス。",
    mp3Path: "./audio/shihan_maamaa.mp3",
    mp3Size: "30.0 KB",
    mp3Bytes: "30,765 B"
  },
  {
    id: "shihan_warukuwanai",
    title: "師範 (50～69点) : 「悪くはないぞ。」",
    duration: "1.13秒",
    usage: "合格点に達した弟子を肯定し、次への自信を持たせる前向きな承認ボイス。",
    mp3Path: "./audio/shihan_warukuwanai.mp3",
    mp3Size: "23.5 KB",
    mp3Bytes: "24,045 B"
  },
  {
    id: "shihan_mousukoshi",
    title: "師範 (50～69点) : 「もう少しじゃな。」",
    duration: "1.25秒",
    usage: "及第点に達した弟子に対し、更なる高みを目指すよう温かくも期待を込めて諭す師範のボイス。",
    mp3Path: "./audio/shihan_mousukoshi.mp3",
    mp3Size: "26.3 KB",
    mp3Bytes: "26,925 B"
  },

  // １）50点未満
  {
    id: "shihan_katsu",
    title: "師範 (50点未満) : 「喝（かーーつ）！！！」",
    duration: "0.66秒",
    usage: "形が乱れたり大幅にずれてしまった際に、道場全体に響き渡る雷鳴のような一喝ボイス。",
    mp3Path: "./audio/shihan_katsu.mp3",
    mp3Size: "14.6 KB",
    mp3Bytes: "14,925 B"
  },
  {
    id: "shihan_shugyo",
    title: "師範 (50点未満) : 「修行が足りん！！」",
    duration: "1.27秒",
    usage: "基本の書き順や姿勢の大切さを厳しくも愛情を込めて諭す師範の叱咤激励ボイス。",
    mp3Path: "./audio/shihan_shugyo.mp3",
    mp3Size: "26.3 KB",
    mp3Bytes: "26,925 B"
  },
  {
    id: "shihan_kiai_irenaose",
    title: "師範 (50点未満) : 「気合を入れなおせ！！」",
    duration: "1.44秒",
    usage: "集中力を研ぎ澄まし、心新たに次の文字へ挑むよう活を入れる師範の鼓舞ボイス。",
    mp3Path: "./audio/shihan_kiai_irenaose.mp3",
    mp3Size: "30.0 KB",
    mp3Bytes: "30,765 B"
  },

  // 空手少年気合ボイス
  {
    id: "boy_kiai_kick",
    title: "前蹴り・コンボ: 「えーい！！！」",
    duration: "0.75秒",
    usage: "3画目以降の高判定や3連続高判定コンボ、文字完成フィニッシュ時に炸裂するテンション最高潮のキックボイス。",
    mp3Path: "./audio/boy_kiai_kick.mp3",
    mp3Size: "19.7 KB",
    mp3Bytes: "20,205 B"
  },
  {
    id: "boy_kiai_ei",
    title: "突き技: 「えいっ！」",
    duration: "0.40秒",
    usage: "1画目・2画目の基本突き技、通常の打撃ストローク時に発声するキレのある少年気合ボイス。",
    mp3Path: "./audio/boy_kiai_ei.mp3",
    mp3Size: "9.4 KB",
    mp3Bytes: "9,645 B"
  },
  {
    id: "boy_kiai_sei",
    title: "気合バリエーション: 「せいっ！」",
    duration: "0.38秒",
    usage: "鋭い踏み込みと突き技に合わせた気合の別バリエーションボイス。",
    mp3Path: "./audio/boy_kiai_sei.mp3",
    mp3Size: "9.4 KB",
    mp3Bytes: "9,645 B"
  }
];

// ============================================================================
// 2. オンメモリリソース（Web Audio APIによる空手効果音シンセサイザー & Gemini TTSボイス）
// ============================================================================

class SoundManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.audioBuffers = new Map(); // voiceId -> AudioBuffer (ゼロレイテンシーオンメモリ再生)
    this.rawArrayBuffers = new Map(); // voiceId -> ArrayBuffer (デコード用生バッファ)
    this.audioElements = new Map(); // voiceId -> HTML5 Audio (フォールバック)
    this.compressor = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.voiceGain = null;
    this.kiaiAudioBuffer = null;
    this.kiaiAudioElement = null;
    this.kickKiaiAudioBuffer = null;
    this.kickKiaiAudioElement = null;
    this.seiKiaiAudioBuffer = null;
    this.seiKiaiAudioElement = null;
    this.shihanSubarashiiAudioBuffer = null;
    this.shihanSubarashiiAudioElement = null;
    this.isLoadingKiai = false;
    this.isUnlocked = false;

    // 和風・空手BGM（ゲーム画面専用・シームレスループ再生用）
    this.bgmGain = null;
    this.bgmTargetVolume = 0.22;
    this.bgmBuffer = null;
    this.bgmRawBuffer = null;
    this.bgmSource = null;
    this.bgmIsPlaying = false;
    this.bgmDesired = false;
    this.bgmExactLoopDuration = 16.0;
    this.bgmLoopStart = 0;
    this.bgmLoopEnd = 16.0;
    this.isLoadingBgm = false;
    this.bgmStopTimeout = null;

    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.stopBgm(0.15, false);
        } else if (this.bgmDesired && this.enabled) {
          this.ensureAudioContext();
          this.startBgm(0.35);
        }
      });
    }
  }

  ensureAudioContext() {
    if (!this.ctx && typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    // プロ仕様オーディオミキシングバスの構築（音割れ防止ダイナミクスコンプレッサー＋独立バス）
    if (this.ctx && !this.masterGain) {
      try {
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-12, this.ctx.currentTime);
        this.compressor.knee.setValueAtTime(8, this.ctx.currentTime);
        this.compressor.ratio.setValueAtTime(4, this.ctx.currentTime);
        this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
        this.compressor.release.setValueAtTime(0.15, this.ctx.currentTime);

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.88, this.ctx.currentTime);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.setValueAtTime(0.45, this.ctx.currentTime); // 効果音がボイスを圧迫しない音量

        this.voiceGain = this.ctx.createGain();
        this.voiceGain.gain.setValueAtTime(1.0, this.ctx.currentTime); // キャラクターボイスをクリアに前面配置

        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.setValueAtTime(0.0001, this.ctx.currentTime); // 効果音・ボイスを邪魔しないBGMバス

        this.sfxGain.connect(this.compressor);
        this.voiceGain.connect(this.compressor);
        this.compressor.connect(this.masterGain);
        this.bgmGain.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);
      } catch (e) {
        console.warn('[SoundManager] Audio node routing notice:', e);
      }
    }
    // 未デコードの生バッファがあれば即座にデコード
    if (this.ctx && this.rawArrayBuffers.size > 0) {
      this.rawArrayBuffers.forEach((arrayBuf, id) => {
        if (!this.audioBuffers.has(id)) {
          this.ctx.decodeAudioData(arrayBuf.slice(0)).then((buf) => {
            this.audioBuffers.set(id, buf);
            if (id === 'boy_kiai_ei') this.kiaiAudioBuffer = buf;
            if (id === 'boy_kiai_kick') this.kickKiaiAudioBuffer = buf;
            if (id === 'boy_kiai_sei') this.seiKiaiAudioBuffer = buf;
            if (id === 'shihan_subarashii') this.shihanSubarashiiAudioBuffer = buf;
          }).catch(() => {});
        }
      });
    }
    // BGM生バッファが未デコードなら即座にデコード
    if (this.ctx && this.bgmRawBuffer && !this.bgmBuffer) {
      this.decodeBgmBuffer(this.bgmRawBuffer);
    }
  }

  getSfxDestination() {
    this.ensureAudioContext();
    return this.sfxGain || (this.ctx ? this.ctx.destination : null);
  }

  getVoiceDestination() {
    this.ensureAudioContext();
    return this.voiceGain || (this.ctx ? this.ctx.destination : null);
  }

  async init() {
    this.ensureAudioContext();
    this.preloadKiaiAudio();
    this.preloadBgm();
  }

  unlockAudioContext() {
    if (this.isUnlocked) return;
    this.isUnlocked = true;
    this.ensureAudioContext();
    if (this.ctx) {
      try {
        const buffer = this.ctx.createBuffer(1, 1, 22050);
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.ctx.destination);
        source.start(0);
      } catch (e) {}
    }
    this.preloadKiaiAudio();
    this.preloadBgm();
  }

  async decodeBgmBuffer(arrayBuf) {
    if (!this.ctx || !arrayBuf || this.bgmBuffer) return;
    try {
      const decoded = await this.ctx.decodeAudioData(arrayBuf.slice(0));
      const sr = decoded.sampleRate || 44100;
      const data = decoded.getChannelData(0);
      let loopStart = 0;

      // MP3のギャップレス非対応デコーダでも途切れ・クリック音を出さない厳密ループ点検出
      if (decoded.duration > this.bgmExactLoopDuration + 0.008) {
        let firstNonSilent = 0;
        const maxScan = Math.min(data.length, Math.floor(sr * 0.15));
        for (let i = 0; i < maxScan; i++) {
          if (Math.abs(data[i]) > 0.008) {
            firstNonSilent = i;
            break;
          }
        }
        loopStart = Math.max(0, (firstNonSilent - 8) / sr);
      }
      const loopEnd = Math.min(decoded.duration, loopStart + this.bgmExactLoopDuration);
      this.bgmBuffer = decoded;
      this.bgmLoopStart = loopStart;
      this.bgmLoopEnd = loopEnd > loopStart + 1.0 ? loopEnd : decoded.duration;

      if (this.bgmDesired && this.enabled && !this.bgmIsPlaying && (typeof document === 'undefined' || !document.hidden)) {
        this.startBgm(0.45);
      }
    } catch (err) {
      console.warn('[SoundManager] BGM decodeAudioData notice:', err);
    }
  }

  async preloadBgm() {
    if (this.bgmBuffer || this.bgmRawBuffer || this.isLoadingBgm) return;
    const bgmUrl = GAME_CONFIG.audioPaths && GAME_CONFIG.audioPaths.bgm;
    if (!bgmUrl || typeof fetch === 'undefined') return;
    this.isLoadingBgm = true;
    try {
      const res = await fetch(bgmUrl);
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        this.bgmRawBuffer = arrayBuf;
        if (this.ctx) {
          await this.decodeBgmBuffer(arrayBuf);
        }
      }
    } catch (err) {
      console.warn('[SoundManager] BGM preload notice:', err);
    } finally {
      this.isLoadingBgm = false;
    }
  }

  startBgm(fadeSec = 0.45) {
    this.bgmDesired = true;
    if (!this.enabled) return;
    if (typeof document !== 'undefined' && document.hidden) return;

    this.ensureAudioContext();
    this.preloadBgm();

    if (!this.ctx || !this.bgmGain) return;

    if (this.bgmStopTimeout) {
      clearTimeout(this.bgmStopTimeout);
      this.bgmStopTimeout = null;
    }

    if (this.bgmIsPlaying && this.bgmSource) {
      const now = this.ctx.currentTime;
      this.bgmGain.gain.cancelScheduledValues(now);
      this.bgmGain.gain.setValueAtTime(Math.max(0.0001, this.bgmGain.gain.value), now);
      this.bgmGain.gain.linearRampToValueAtTime(this.bgmTargetVolume, now + Math.max(0.05, fadeSec));
      return;
    }

    if (!this.bgmBuffer) {
      // デコード完了時に decodeBgmBuffer() から自動再生される
      return;
    }

    try {
      const source = this.ctx.createBufferSource();
      source.buffer = this.bgmBuffer;
      source.loop = true;
      source.loopStart = this.bgmLoopStart;
      source.loopEnd = this.bgmLoopEnd;
      source.connect(this.bgmGain);

      const now = this.ctx.currentTime;
      this.bgmGain.gain.cancelScheduledValues(now);
      this.bgmGain.gain.setValueAtTime(0.0001, now);
      this.bgmGain.gain.linearRampToValueAtTime(this.bgmTargetVolume, now + Math.max(0.05, fadeSec));

      source.start(now, this.bgmLoopStart);
      this.bgmSource = source;
      this.bgmIsPlaying = true;
    } catch (e) {
      console.warn('[SoundManager] BGM start notice:', e);
    }
  }

  stopBgm(fadeSec = 0.25, clearDesired = true) {
    if (clearDesired) {
      this.bgmDesired = false;
    }
    if (this.bgmStopTimeout) {
      clearTimeout(this.bgmStopTimeout);
      this.bgmStopTimeout = null;
    }

    const src = this.bgmSource;
    this.bgmSource = null;
    this.bgmIsPlaying = false;
    if (!src) return;

    if (this.ctx && this.bgmGain && fadeSec > 0) {
      try {
        const now = this.ctx.currentTime;
        this.bgmGain.gain.cancelScheduledValues(now);
        this.bgmGain.gain.setValueAtTime(Math.max(0.0001, this.bgmGain.gain.value), now);
        this.bgmGain.gain.linearRampToValueAtTime(0.0001, now + fadeSec);
        this.bgmStopTimeout = setTimeout(() => {
          this.bgmStopTimeout = null;
          try { src.stop(); } catch (e) {}
          try { src.disconnect(); } catch (e) {}
        }, Math.ceil(fadeSec * 1000) + 30);
        return;
      } catch (e) {}
    }

    try { src.stop(); } catch (e) {}
    try { src.disconnect(); } catch (e) {}
  }

  syncBgmState() {
    if (!this.enabled || (typeof document !== 'undefined' && document.hidden)) {
      this.stopBgm(0.15, false);
    } else if (this.bgmDesired) {
      this.startBgm(0.35);
    }
  }

  async preloadKiaiAudio() {
    if (this.isLoadingKiai) return;
    this.isLoadingKiai = true;
    this.ensureAudioContext();

    // VOICE_SELECTION_DATA の全音声（少年3種＋師範15種）を一括プリロード（軽量MP3）
    const loadPromises = VOICE_SELECTION_DATA.map(async (voice) => {
      // 1. Web Audio API 用の AudioBuffer プリロード（完全オンメモリ展開・ゼロレイテンシー）
      if (!this.audioBuffers.has(voice.id)) {
        try {
          const res = await fetch(voice.mp3Path);
          if (res.ok) {
            const arrayBuf = await res.arrayBuffer();
            this.rawArrayBuffers.set(voice.id, arrayBuf);
            if (this.ctx) {
              const audioBuf = await this.ctx.decodeAudioData(arrayBuf.slice(0));
              this.audioBuffers.set(voice.id, audioBuf);

              // 互換性ショートカット
              if (voice.id === 'boy_kiai_ei') this.kiaiAudioBuffer = audioBuf;
              if (voice.id === 'boy_kiai_kick') this.kickKiaiAudioBuffer = audioBuf;
              if (voice.id === 'boy_kiai_sei') this.seiKiaiAudioBuffer = audioBuf;
              if (voice.id === 'shihan_subarashii') this.shihanSubarashiiAudioBuffer = audioBuf;
            }
          }
        } catch (err) {
          console.warn(`[SoundManager] AudioBuffer preload notice for ${voice.id}:`, err);
        }
      }

      // 2. HTML5 Audio フォールバック用エレメント
      if (!this.audioElements.has(voice.id) && typeof Audio !== 'undefined') {
        try {
          const audio = new Audio(voice.mp3Path);
          audio.preload = 'auto';
          audio.load();
          this.audioElements.set(voice.id, audio);

          // 互換性ショートカット
          if (voice.id === 'boy_kiai_ei') this.kiaiAudioElement = audio;
          if (voice.id === 'boy_kiai_kick') this.kickKiaiAudioElement = audio;
          if (voice.id === 'boy_kiai_sei') this.seiKiaiAudioElement = audio;
          if (voice.id === 'shihan_subarashii') this.shihanSubarashiiAudioElement = audio;
        } catch (e) {}
      }
    });

    try {
      await Promise.all(loadPromises);
    } catch (e) {
      console.warn('[SoundManager] Voice preloading error:', e);
    }

    this.isLoadingKiai = false;
  }

  // 正拳突きの風切り音 & 打撃音 ("シュッ！ドン！")
  playPunch() {
    if (!this.enabled || !this.ctx) return;
    const dest = this.getSfxDestination();
    if (!dest) return;
    const now = this.ctx.currentTime;

    // 風切り音 (ノイズ + バンドパスフィルター)
    const bufferSize = this.ctx.sampleRate * 0.12;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(300, now + 0.12);

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.5, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(dest);
    noise.start(now);

    // インパクト低音 (正拳の重み)
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.16);

    oscGain.gain.setValueAtTime(0.6, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);

    osc.connect(oscGain);
    oscGain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  // 前蹴りの鋭い強撃音 ("ズバァン！")
  playKick() {
    if (!this.enabled || !this.ctx) return;
    const dest = this.getSfxDestination();
    if (!dest) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.28);

    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.28);

    // スナップ音
    const snapOsc = this.ctx.createOscillator();
    const snapGain = this.ctx.createGain();
    snapOsc.type = 'square';
    snapOsc.frequency.setValueAtTime(800, now);
    snapOsc.frequency.exponentialRampToValueAtTime(100, now + 0.08);
    snapGain.gain.setValueAtTime(0.35, now);
    snapGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    snapOsc.connect(snapGain);
    snapGain.connect(dest);
    snapOsc.start(now);
    snapOsc.stop(now + 0.08);
  }

  // 和太鼓の合図（問題開始・達成時）
  playTaiko() {
    if (!this.enabled) return;
    const dest = this.getSfxDestination();
    if (!dest || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(112, now);
    osc.frequency.exponentialRampToValueAtTime(46, now + 0.36);
    gain.gain.setValueAtTime(0.75, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.38);

    // 胴鳴り補強（低域のまま輪郭を出す）
    const bodyOsc = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();
    bodyOsc.type = 'sine';
    bodyOsc.frequency.setValueAtTime(168, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(74, now + 0.14);
    bodyGain.gain.setValueAtTime(0.28, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.005, now + 0.16);

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(280, now);

    osc.connect(gain);
    gain.connect(lp);
    bodyOsc.connect(bodyGain);
    bodyGain.connect(lp);
    lp.connect(dest);

    osc.start(now);
    osc.stop(now + 0.4);
    bodyOsc.start(now);
    bodyOsc.stop(now + 0.18);
  }

  // 一本・高得点ファンファーレ（和風チャイム）
  playIppon() {
    if (!this.enabled || !this.ctx) return;
    const dest = this.getSfxDestination();
    if (!dest) return;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C, E, G, High C
    notes.forEach((freq, idx) => {
      const startTime = this.ctx.currentTime + idx * 0.08;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(startTime);
      osc.stop(startTime + 0.35);
    });
  }

  // 帯昇段（「しょうだん！」）SE：超重厚・低音の大太鼓「ド・ドンッ！」（板割り音と完全分離）
  playPromotionRankUp() {
    if (!this.enabled) return;
    this.ensureAudioContext();
    if (!this.ctx) return;
    const dest = this.masterGain || this.getSfxDestination();
    if (!dest) return;
    const now = this.ctx.currentTime;

    // 昇段カットイン中、BGMを一時的に下げて大太鼓の低い胴鳴りをはっきり響かせる
    if (this.bgmGain && this.bgmIsPlaying) {
      try {
        const curBgm = Math.max(0.0001, this.bgmGain.gain.value);
        this.bgmGain.gain.cancelScheduledValues(now);
        this.bgmGain.gain.setValueAtTime(curBgm, now);
        this.bgmGain.gain.linearRampToValueAtTime(0.04, now + 0.12);
        this.bgmGain.gain.setValueAtTime(0.04, now + 1.15);
        this.bgmGain.gain.linearRampToValueAtTime(this.bgmTargetVolume, now + 1.75);
      } catch (e) {}
    }

    // 温かく太い低音倍音を生み出すソフトサチュレーション（高域の歪みを出さない控えめなドライブ）
    const shaper = this.ctx.createWaveShaper();
    const curveLen = 1024;
    const curve = new Float32Array(curveLen);
    for (let i = 0; i < curveLen; i++) {
      const x = (i * 2) / curveLen - 1;
      curve[i] = Math.tanh(x * 1.45);
    }
    shaper.curve = curve;
    shaper.oversample = '2x';

    // 板割り（高域クラック）と完全に差別化するため、340Hz以上を落とす重低音ローパス
    const masterFilter = this.ctx.createBiquadFilter();
    masterFilter.type = 'lowpass';
    masterFilter.frequency.setValueAtTime(340, now);
    masterFilter.Q.setValueAtTime(0.85, now);

    const odaikoBus = this.ctx.createGain();
    odaikoBus.gain.setValueAtTime(1.15, now);

    shaper.connect(masterFilter);
    masterFilter.connect(odaikoBus);
    odaikoBus.connect(dest);

    // 柔らかい撥（ばち）で革を打つ低重心の鈍いアタック用ブラウンノイズ
    const noiseDur = 0.25;
    const noiseLen = Math.floor(this.ctx.sampleRate * noiseDur);
    const noiseBuf = this.ctx.createBuffer(1, noiseLen, this.ctx.sampleRate);
    const noiseData = noiseBuf.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < noiseLen; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.06 * white) / 1.06;
      noiseData[i] = Math.max(-1, Math.min(1, lastOut * 3.2));
    }

    const strikeOdaiko = (startTime, isAccent) => {
      // 大太鼓らしいどっしり低い基音（46Hz〜56Hzに落ち着き、38Hzまで重く伸びる）
      const pitchStart = isAccent ? 104 : 96;
      const settleFreq = isAccent ? 47 : 54;
      const baseEndFreq = isAccent ? 37 : 44;
      const bodyDecay = isAccent ? 1.35 : 0.24;
      const level = isAccent ? 1.0 : 0.74;

      // 1. 大太鼓の主振動（深く重い低音「ドゥォォォン」）
      const fundOsc = this.ctx.createOscillator();
      const fundGain = this.ctx.createGain();
      fundOsc.type = 'sine';
      fundOsc.frequency.setValueAtTime(pitchStart, startTime);
      fundOsc.frequency.exponentialRampToValueAtTime(settleFreq, startTime + (isAccent ? 0.045 : 0.035));
      fundOsc.frequency.exponentialRampToValueAtTime(baseEndFreq, startTime + bodyDecay);

      fundGain.gain.setValueAtTime(0.001, startTime);
      fundGain.gain.linearRampToValueAtTime(1.0 * level, startTime + 0.006);
      fundGain.gain.exponentialRampToValueAtTime(0.55 * level, startTime + (isAccent ? 0.22 : 0.09));
      fundGain.gain.exponentialRampToValueAtTime(0.001, startTime + bodyDecay);

      fundOsc.connect(fundGain);
      fundGain.connect(shaper);
      fundOsc.start(startTime);
      fundOsc.stop(startTime + bodyDecay + 0.04);

      // 2. 小型スピーカーでも「低い音」として太く鳴る低域胴鳴り倍音（70Hz〜110Hz中心・高すぎない設計）
      const modes = [
        { ratio: 1.59, amp: 0.62, decay: isAccent ? 0.42 : 0.16 },
        { ratio: 2.00, amp: 0.28, decay: isAccent ? 0.20 : 0.10 }
      ];
      modes.forEach((mode) => {
        const mOsc = this.ctx.createOscillator();
        const mGain = this.ctx.createGain();
        mOsc.type = 'sine';
        mOsc.frequency.setValueAtTime(pitchStart * mode.ratio, startTime);
        mOsc.frequency.exponentialRampToValueAtTime(settleFreq * mode.ratio, startTime + 0.04);
        mOsc.frequency.exponentialRampToValueAtTime(baseEndFreq * mode.ratio, startTime + mode.decay);

        mGain.gain.setValueAtTime(0.001, startTime);
        mGain.gain.linearRampToValueAtTime(mode.amp * level, startTime + 0.005);
        mGain.gain.exponentialRampToValueAtTime(0.001, startTime + mode.decay);

        mOsc.connect(mGain);
        mGain.connect(shaper);
        mOsc.start(startTime);
        mOsc.stop(startTime + mode.decay + 0.03);
      });

      // 3. パチッと弾けない「ドフッ」という厚い革＋太撥の低い打撃感（200Hz以下）
      const skinSrc = this.ctx.createBufferSource();
      skinSrc.buffer = noiseBuf;
      const skinFilter = this.ctx.createBiquadFilter();
      skinFilter.type = 'lowpass';
      skinFilter.frequency.setValueAtTime(isAccent ? 220 : 200, startTime);
      skinFilter.frequency.exponentialRampToValueAtTime(85, startTime + 0.07);

      const skinGain = this.ctx.createGain();
      skinGain.gain.setValueAtTime(0.001, startTime);
      skinGain.gain.linearRampToValueAtTime((isAccent ? 0.95 : 0.72) * level, startTime + 0.004);
      skinGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.09);

      skinSrc.connect(skinFilter);
      skinFilter.connect(skinGain);
      skinGain.connect(shaper);
      skinSrc.start(startTime);
      skinSrc.stop(startTime + 0.11);
    };

    // 板割り音（約180ms）が鳴り終わった直後の200ms後に一打目「ド」、その190ms後に二打目「ドンッ！」
    strikeOdaiko(now + 0.20, false);
    strikeOdaiko(now + 0.39, true);
  }

  // 第8問クリア時：障子が左右へ吹き飛ぶ疾風＋引き戸の衝撃音＋視界開放チャイム
  playShojiBlowAway() {
    if (!this.enabled || !this.ctx) return;
    const dest = this.getSfxDestination();
    if (!dest) return;
    const now = this.ctx.currentTime;

    // 1. 障子が桟ごと弾け飛ぶ木枠の衝撃音（「ガタンッ！」）
    const thumpOsc = this.ctx.createOscillator();
    const thumpGain = this.ctx.createGain();
    thumpOsc.type = 'triangle';
    thumpOsc.frequency.setValueAtTime(195, now);
    thumpOsc.frequency.exponentialRampToValueAtTime(48, now + 0.24);
    thumpGain.gain.setValueAtTime(0.68, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.01, now + 0.24);
    thumpOsc.connect(thumpGain);
    thumpGain.connect(dest);
    thumpOsc.start(now);
    thumpOsc.stop(now + 0.25);

    // 2. 左右に吹き抜ける烈風（「ブォォォーーッ！」）
    const gustDur = Math.floor(this.ctx.sampleRate * 0.72);
    const buffer = this.ctx.createBuffer(1, gustDur, this.ctx.sampleRate);
    const d = buffer.getChannelData(0);
    for (let i = 0; i < gustDur; i++) d[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(1.4, now);
    filter.frequency.setValueAtTime(240, now);
    filter.frequency.exponentialRampToValueAtTime(1350, now + 0.16);
    filter.frequency.exponentialRampToValueAtTime(340, now + 0.70);

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.01, now);
    nGain.gain.linearRampToValueAtTime(0.55, now + 0.08);
    nGain.gain.exponentialRampToValueAtTime(0.008, now + 0.72);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(dest);
    noise.start(now);

    // 3. 夜空・満月がぱっと開ける清冽な開放和音（A5 -> D6 -> G6）
    [880, 1174.66, 1567.98].forEach((freq, i) => {
      const t = now + 0.09 + i * 0.055;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.11, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.connect(g);
      g.connect(dest);
      osc.start(t);
      osc.stop(t + 0.58);
    });
  }

  // 空手の板割り破砕音（杉板が真っ二つに割れる鋭いスナップと打撃音）
  playWoodBreak() {
    if (!this.enabled || !this.ctx) return;
    const dest = this.getSfxDestination();
    if (!dest) return;
    const now = this.ctx.currentTime;

    // 1. 鋭い木材割れ破砕音 (高域ノイズバースト)
    const crackLen = Math.floor(this.ctx.sampleRate * 0.08);
    const buffer = this.ctx.createBuffer(1, crackLen, this.ctx.sampleRate);
    const d = buffer.getChannelData(0);
    for (let i = 0; i < crackLen; i++) d[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1200, now);
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.7, now);
    nGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(dest);
    noise.start(now);

    // 2. 正拳突きの強打撃インパクト
    const osc = this.ctx.createOscillator();
    const oGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.18);
    oGain.gain.setValueAtTime(0.75, now);
    oGain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
    osc.connect(oGain);
    oGain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.18);

    // 3. 割れた杉板の胴鳴り共鳴 (Wood Snap)
    const snapOsc = this.ctx.createOscillator();
    const snapGain = this.ctx.createGain();
    snapOsc.type = 'sawtooth';
    snapOsc.frequency.setValueAtTime(520, now);
    snapOsc.frequency.exponentialRampToValueAtTime(110, now + 0.12);
    snapGain.gain.setValueAtTime(0.4, now);
    snapGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    snapOsc.connect(snapGain);
    snapGain.connect(dest);
    snapOsc.start(now);
    snapOsc.stop(now + 0.12);
  }

  // 出題文字列が画面外から流れてくるときの風切り音
  playSwoosh() {
    if (!this.enabled || !this.ctx) return;
    const dest = this.getSfxDestination();
    if (!dest) return;
    const now = this.ctx.currentTime;
    const dur = Math.floor(this.ctx.sampleRate * 0.22);
    const buffer = this.ctx.createBuffer(1, dur, this.ctx.sampleRate);
    const d = buffer.getChannelData(0);
    for (let i = 0; i < dur; i++) d[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(320, now);
    filter.frequency.exponentialRampToValueAtTime(950, now + 0.1);
    filter.frequency.exponentialRampToValueAtTime(260, now + 0.22);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    noise.start(now);
  }

  // コンボ節目（5, 10, 15, 20, 30, 40コンボ）達成時の段階的和風効果音
  playComboMilestone(threshold) {
    if (!this.enabled) return;
    const dest = this.getSfxDestination();
    if (!dest || !this.ctx) return;
    const now = this.ctx.currentTime;

    const playHyoshigi = (t, pitchScale = 1.0) => {
      [1540 * pitchScale, 2080 * pitchScale].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + idx * 0.014);
        g.gain.setValueAtTime(0.32, t + idx * 0.014);
        g.gain.exponentialRampToValueAtTime(0.002, t + idx * 0.014 + 0.09);
        osc.connect(g);
        g.connect(dest);
        osc.start(t + idx * 0.014);
        osc.stop(t + idx * 0.014 + 0.1);
      });
    };

    const playWafuChime = (t, freqs, vol = 0.22) => {
      freqs.forEach((f, idx) => {
        const st = t + idx * 0.055;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, st);
        g.gain.setValueAtTime(0.001, st);
        g.gain.linearRampToValueAtTime(vol, st + 0.006);
        g.gain.exponentialRampToValueAtTime(0.001, st + 0.34);
        osc.connect(g);
        g.connect(dest);
        osc.start(st);
        osc.stop(st + 0.36);
      });
    };

    const playLowTaikoAccent = (t, startHz, endHz, dur, vol = 0.72) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(320, t);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(startHz, t);
      osc.frequency.exponentialRampToValueAtTime(endHz, t + dur);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(g);
      g.connect(lp);
      lp.connect(dest);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    };

    if (threshold >= 40) {
      // 40コンボ：天下無双（重低音二連太鼓＋黄金の日本音階）
      playLowTaikoAccent(now, 108, 44, 0.22, 0.78);
      playLowTaikoAccent(now + 0.13, 114, 38, 0.55, 0.95);
      playHyoshigi(now + 0.02, 1.12);
      playWafuChime(now + 0.06, [587.33, 698.46, 880.0, 1174.66, 1396.91], 0.25);
    } else if (threshold >= 30) {
      // 30コンボ：蒼炎覚醒（低音太鼓＋閃光チャイム）
      playLowTaikoAccent(now, 116, 44, 0.42, 0.85);
      playHyoshigi(now + 0.03, 1.08);
      playWafuChime(now + 0.05, [587.33, 783.99, 1046.50, 1174.66], 0.22);
    } else if (threshold >= 20) {
      // 20コンボ：紅蓮（和太鼓ドン＋和音階）
      playLowTaikoAccent(now, 122, 48, 0.36, 0.78);
      playWafuChime(now + 0.04, [523.25, 659.25, 783.99, 1046.50], 0.2);
    } else if (threshold >= 15) {
      // 15コンボ：桜嵐（拍子木＋桜音階）
      playHyoshigi(now, 1.04);
      playWafuChime(now + 0.03, [587.33, 698.46, 880.0], 0.18);
    } else if (threshold >= 10) {
      // 10コンボ：疾風（締太鼓＋拍子木）
      playLowTaikoAccent(now, 145, 62, 0.24, 0.62);
      playHyoshigi(now + 0.04, 1.0);
    } else {
      // 5コンボ：気合（凛とした拍子木）
      playHyoshigi(now, 0.96);
    }
  }

  // ずっこけ効果音（スコア30未満・技が出ないときのコミカルな「ずこっ！」音）
  playZukkoke() {
    if (!this.enabled || !this.ctx) return;
    const dest = this.getSfxDestination();
    if (!dest) return;
    const now = this.ctx.currentTime;

    // 1. 下降ピッチのコミカルなスリップスライド音（「ヒュ〜」）
    const slideOsc = this.ctx.createOscillator();
    const slideGain = this.ctx.createGain();
    slideOsc.type = 'triangle';
    slideOsc.frequency.setValueAtTime(380, now);
    slideOsc.frequency.exponentialRampToValueAtTime(75, now + 0.22);

    slideGain.gain.setValueAtTime(0.5, now);
    slideGain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

    slideOsc.connect(slideGain);
    slideGain.connect(dest);
    slideOsc.start(now);
    slideOsc.stop(now + 0.22);

    // 2. コミカルな尻もち着地・打撃「ズコッ！」（低音バウンス＋打撃音）
    const thudTime = now + 0.12;
    const thudOsc = this.ctx.createOscillator();
    const thudGain = this.ctx.createGain();
    thudOsc.type = 'sine';
    thudOsc.frequency.setValueAtTime(125, thudTime);
    thudOsc.frequency.exponentialRampToValueAtTime(35, thudTime + 0.18);

    thudGain.gain.setValueAtTime(0.7, thudTime);
    thudGain.gain.exponentialRampToValueAtTime(0.01, thudTime + 0.18);

    thudOsc.connect(thudGain);
    thudGain.connect(dest);
    thudOsc.start(thudTime);
    thudOsc.stop(thudTime + 0.18);

    // 3. ずっこけのコミカルなバネ余韻音 (Boing / Spring vibration)
    const boingOsc = this.ctx.createOscillator();
    const boingGain = this.ctx.createGain();
    boingOsc.type = 'sawtooth';
    boingOsc.frequency.setValueAtTime(180, thudTime + 0.03);
    boingOsc.frequency.exponentialRampToValueAtTime(60, thudTime + 0.24);

    boingGain.gain.setValueAtTime(0.22, thudTime + 0.03);
    boingGain.gain.exponentialRampToValueAtTime(0.005, thudTime + 0.24);

    boingOsc.connect(boingGain);
    boingGain.connect(dest);
    boingOsc.start(thudTime + 0.03);
    boingOsc.stop(thudTime + 0.24);
  }

  // 忍者煙ボンッ！効果音（盛り上げ役仲間登場時の煙の破裂音 & ポップ音）
  playNinjaPoof() {
    if (!this.enabled || !this.ctx) return;
    const dest = this.getSfxDestination();
    if (!dest) return;
    const now = this.ctx.currentTime;

    // 1. 煙の爆発ホワイトノイズ（「シュボンッ！」）
    const dur = Math.floor(this.ctx.sampleRate * 0.28);
    const buffer = this.ctx.createBuffer(1, dur, this.ctx.sampleRate);
    const d = buffer.getChannelData(0);
    for (let i = 0; i < dur; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (dur * 0.25));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(320, now + 0.26);

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.7, now);
    nGain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(dest);
    noise.start(now);

    // 2. 忍者のコミカルな「ポンッ！」胴鳴り
    const popOsc = this.ctx.createOscillator();
    const popGain = this.ctx.createGain();
    popOsc.type = 'sine';
    popOsc.frequency.setValueAtTime(320, now);
    popOsc.frequency.exponentialRampToValueAtTime(80, now + 0.16);

    popGain.gain.setValueAtTime(0.85, now);
    popGain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);

    popOsc.connect(popGain);
    popGain.connect(dest);
    popOsc.start(now);
    popOsc.stop(now + 0.16);
  }

  // 子供の男の子の気合の入った声色「えいっ！」（Gemini TTSリアルタイム少年ボイス）
  playBoyKiai() {
    this.playVoiceById('boy_kiai_ei');
  }

  // 前蹴り・コンボフィニッシュ時の気合の叫び声「えーい！！！」（Gemini TTS 熱血少年ボイス）
  playBoyKickKiai() {
    this.playVoiceById('boy_kiai_kick');
  }

  // 気合バリエーション「せいっ！」再生
  playBoySeiKiai() {
    this.playVoiceById('boy_kiai_sei');
  }

  // 師範の称賛ボイス「すばらしい！！！」（80代仙人・永井一郎風、互換性用）
  playShihanSubarashii() {
    this.playVoiceById('shihan_subarashii');
  }

  /**
   * 出来栄え（0〜100点）に応じた師範の評価音声をランダム再生
   * ５つの範囲から該当する範囲の３つのセリフからランダムに1つ選んで再生
   * @param {number} score 出来栄えスコア (0〜100)
   * @returns {{id: string, text: string, durationSec: number}} 選択されたセリフ情報
   */
  playShihanEvaluation(score) {
    if (!this.enabled) return null;

    // スコア範囲の特定（90以上, 80-89, 70-79, 50-69, 50未満）
    const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
    let targetTier = SHIHAN_EVALUATION_TIERS.find(t => clampedScore >= t.minScore && clampedScore <= t.maxScore);
    if (!targetTier) {
      targetTier = SHIHAN_EVALUATION_TIERS[SHIHAN_EVALUATION_TIERS.length - 1];
    }

    // 該当する3つのセリフからランダムに1つ選択
    const randomIndex = Math.floor(Math.random() * targetTier.lines.length);
    const selectedLine = targetTier.lines[randomIndex];

    // 音声再生（少年の声と被っても両方最後まで鳴り切る多重再生）
    this.playVoiceById(selectedLine.id);

    return selectedLine;
  }

  /**
   * ボイスIDに応じた完全多重再生（少年ボイスと師範ボイスの同時・連続再生対応）
   * 複数の音声が重なっても絶対に他方を止めず、すべて最後まで独立して再生される
   * @param {string} voiceId 
   */
  playVoiceById(voiceId) {
    if (!this.enabled) return;
    this.ensureAudioContext();

    const dest = this.getVoiceDestination();
    if (!this.ctx || !dest) return;

    // 1. 最高音質 & 完全多重再生: Web Audio API (独立したAudioBufferSourceNode)
    if (this.audioBuffers && this.audioBuffers.has(voiceId)) {
      try {
        if (this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
        // 毎回新しい独立した再生ノードを作成（既存の再生音を絶対に中断しない完全多重再生）
        const source = this.ctx.createBufferSource();
        source.buffer = this.audioBuffers.get(voiceId);
        
        const gainNode = this.ctx.createGain();
        // 音量バランス：師範1.05、少年前蹴り0.95、通常突き0.90（コンプレッサーを通るため音割れ・ハードリミッター遮断を防止）
        if (voiceId.startsWith('shihan_')) {
          gainNode.gain.setValueAtTime(1.05, this.ctx.currentTime);
        } else if (voiceId === 'boy_kiai_kick') {
          gainNode.gain.setValueAtTime(0.95, this.ctx.currentTime);
        } else {
          gainNode.gain.setValueAtTime(0.90, this.ctx.currentTime);
        }

        source.connect(gainNode);
        gainNode.connect(dest);

        source.start(0);
        return;
      } catch (err) {
        console.warn(`[SoundManager] AudioBuffer playback error for ${voiceId}, falling back:`, err);
      }
    }

    // 2. 生バッファからのオンデマンド即時デコード & 多重再生
    if (this.rawArrayBuffers && this.rawArrayBuffers.has(voiceId)) {
      try {
        const rawBuf = this.rawArrayBuffers.get(voiceId);
        this.ctx.decodeAudioData(rawBuf.slice(0)).then((decoded) => {
          this.audioBuffers.set(voiceId, decoded);
          const source = this.ctx.createBufferSource();
          source.buffer = decoded;
          const gainNode = this.ctx.createGain();
          gainNode.gain.setValueAtTime(voiceId.startsWith('shihan_') ? 1.05 : 0.95, this.ctx.currentTime);
          source.connect(gainNode);
          gainNode.connect(dest);
          source.start(0);
        }).catch(() => {});
        return;
      } catch (e) {}
    }

    // 3. オンデマンドフェッチ & Web Audio API デコード多重再生（軽量MP3）
    const voiceMeta = VOICE_SELECTION_DATA.find(v => v.id === voiceId);
    const audioUrl = voiceMeta ? voiceMeta.mp3Path : `./audio/${voiceId}.mp3`;
    if (audioUrl) {
      fetch(audioUrl).then(res => res.arrayBuffer()).then(ab => {
        this.rawArrayBuffers.set(voiceId, ab);
        return this.ctx.decodeAudioData(ab.slice(0));
      }).then(decoded => {
        this.audioBuffers.set(voiceId, decoded);
        const source = this.ctx.createBufferSource();
        source.buffer = decoded;
        const gainNode = this.ctx.createGain();
        gainNode.gain.setValueAtTime(voiceId.startsWith('shihan_') ? 1.05 : 0.95, this.ctx.currentTime);
        source.connect(gainNode);
        gainNode.connect(dest);
        source.start(0);
      }).catch(err => {
        console.warn(`[SoundManager] On-demand fetch failed for ${voiceId}:`, err);
        // 4. シンセ効果音へのフォールバック
        if (voiceId === 'boy_kiai_kick') {
          this.playKick();
        } else if (voiceId.startsWith('shihan_')) {
          this.playIppon();
        } else {
          this.playPunch();
        }
      });
      return;
    }

    // 4. 既定のシンセ効果音への安全なフォールバック
    if (voiceId === 'boy_kiai_kick') {
      this.playKick();
    } else if (voiceId.startsWith('shihan_')) {
      this.playIppon();
    } else {
      this.playPunch();
    }
  }
}

const sounds = new SoundManager();

/**
 * 道場全体の和風闘気パーティクルエンジン（オンメモリCanvas描画）
 * 書き順が正しく進むごとに「桜吹雪」「火の粉」「和風気流」「衝撃波」が追従し、
 * コンボ数に応じて道場全体へ勢いよく激しさを増していく。
 */
class DojoAuraParticleEngine {
  constructor(canvasEl, containerEl, arenaEl, boyEl) {
    this.canvas = canvasEl || null;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.container = containerEl || null;
    this.arena = arenaEl || null;
    this.boy = boyEl || null;

    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.arenaRect = null;
    this.boyCenter = { x: 0, y: 0 };

    this.particles = [];
    this.rings = [];
    this.comboCount = 0;
    this.tierIndex = 0;
    this.rafId = null;
    this.lastTimestamp = 0;
    this.lastTraceClientX = null;
    this.lastTraceClientY = null;
    this.isActive = false;

    this.reducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.pauseLoop();
        } else if (this.tierIndex > 0 || this.particles.length > 0 || this.rings.length > 0) {
          this.startLoop();
        }
      });
    }

    this.resize();
  }

  getTierConfig(tierIdx = this.tierIndex) {
    return DOJO_AURA_CONFIG.tiers[tierIdx] || DOJO_AURA_CONFIG.tiers[0];
  }

  resolveTierIndex(comboCount) {
    const tiers = DOJO_AURA_CONFIG.tiers;
    let resolved = 0;
    for (let i = 0; i < tiers.length; i++) {
      if (comboCount >= tiers[i].minCombo) {
        resolved = i;
      }
    }
    return resolved;
  }

  resize() {
    if (!this.canvas || !this.container) return;
    const rect = this.container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    this.dpr = Math.min(typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1, 2);
    this.width = rect.width;
    this.height = rect.height;

    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
    if (this.ctx) {
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    this.refreshAnchors(rect);
  }

  refreshAnchors(containerRect = null) {
    if (!this.container) return;
    const cRect = containerRect || this.container.getBoundingClientRect();
    if (!cRect.width || !cRect.height) return;

    if (this.arena) {
      const aRect = this.arena.getBoundingClientRect();
      this.arenaRect = {
        left: aRect.left - cRect.left,
        top: aRect.top - cRect.top,
        right: aRect.right - cRect.left,
        bottom: aRect.bottom - cRect.top
      };
    }

    if (this.boy) {
      const bRect = this.boy.getBoundingClientRect();
      this.boyCenter = {
        x: bRect.left - cRect.left + bRect.width * 0.5,
        y: bRect.top - cRect.top + bRect.height * 0.62
      };
    } else {
      this.boyCenter = {
        x: cRect.width * 0.5,
        y: cRect.height * 0.78
      };
    }
  }

  toLocalPoint(clientX, clientY) {
    if (!this.container) return null;
    const cRect = this.container.getBoundingClientRect();
    return {
      x: clientX - cRect.left,
      y: clientY - cRect.top
    };
  }

  setCombo(comboCount, triggerSurge = true) {
    const prevTier = this.tierIndex;
    this.comboCount = Math.max(0, comboCount || 0);
    const nextTier = this.resolveTierIndex(this.comboCount);
    this.tierIndex = nextTier;

    if (this.reducedMotion) return;

    if (triggerSurge && nextTier > prevTier && nextTier >= 1) {
      this.triggerTierSurge(nextTier);
    }

    if (nextTier > 0 || this.particles.length > 0 || this.rings.length > 0) {
      this.startLoop();
    }
  }

  // ストローク中の指・ペンの動きに追従する微小な火の粉・桜花びら
  emitTraceSpark(clientX, clientY, comboCount) {
    if (this.reducedMotion || comboCount < 1 || !this.canvas) return;
    if (this.lastTraceClientX !== null && this.lastTraceClientY !== null) {
      const moved = Math.hypot(clientX - this.lastTraceClientX, clientY - this.lastTraceClientY);
      if (moved < 18) return;
    }
    this.lastTraceClientX = clientX;
    this.lastTraceClientY = clientY;

    const pt = this.toLocalPoint(clientX, clientY);
    if (!pt) return;

    const tierCfg = this.getTierConfig();
    const spawnCount = comboCount >= 20 ? 2 : 1;
    for (let i = 0; i < spawnCount; i++) {
      const isSakura = Math.random() < 0.45;
      if (isSakura) {
        this.spawnSakura(pt.x + (Math.random() - 0.5) * 10, pt.y + (Math.random() - 0.5) * 10, tierCfg, 'stroke', 0.68);
      } else {
        this.spawnEmber(pt.x + (Math.random() - 0.5) * 8, pt.y + (Math.random() - 0.5) * 8, tierCfg, 'stroke', 0.72);
      }
    }
    this.startLoop();
  }

  resetTraceCursor() {
    this.lastTraceClientX = null;
    this.lastTraceClientY = null;
  }

  // 書き順が正しく進んだ瞬間の追従バースト（筆跡＋空手少年＋道場全体）
  triggerStrokeBurst(normPoints, canvasEl, score, comboCount) {
    if (this.reducedMotion || !this.canvas || !this.container) return;
    this.resize();

    const tierIdx = this.resolveTierIndex(Math.max(1, comboCount));
    const tierCfg = this.getTierConfig(tierIdx);
    const cRect = this.container.getBoundingClientRect();

    // 1. 筆跡に沿った桜吹雪＆火の粉バースト（書き終わり先端・中間点に追従）
    const anchorLocalPts = [];
    if (canvasEl && Array.isArray(normPoints) && normPoints.length > 0) {
      const cvRect = canvasEl.getBoundingClientRect();
      const sampleIndices = normPoints.length >= 3
        ? [Math.floor(normPoints.length * 0.5), normPoints.length - 1]
        : [normPoints.length - 1];

      sampleIndices.forEach((idx) => {
        const [nx, ny] = normPoints[idx];
        const lx = (cvRect.left - cRect.left) + (nx / GAME_CONFIG.canvasCoordinateMax) * cvRect.width;
        const ly = (cvRect.top - cRect.top) + (ny / GAME_CONFIG.canvasCoordinateMax) * cvRect.height;
        anchorLocalPts.push({ x: lx, y: ly });
      });
    } else if (this.arenaRect) {
      anchorLocalPts.push({
        x: (this.arenaRect.left + this.arenaRect.right) * 0.5,
        y: (this.arenaRect.top + this.arenaRect.bottom) * 0.5
      });
    }

    // ストローク方向ベクトルを算出して勢いに乗せる
    let dirX = 0.25;
    let dirY = -0.75;
    if (Array.isArray(normPoints) && normPoints.length >= 2) {
      const pFirst = normPoints[0];
      const pLast = normPoints[normPoints.length - 1];
      const dx = pLast[0] - pFirst[0];
      const dy = pLast[1] - pFirst[1];
      const len = Math.hypot(dx, dy);
      if (len > 2) {
        dirX = dx / len;
        dirY = dy / len;
      }
    }

    const scoreBonus = score >= 90 ? 1.35 : (score >= 80 ? 1.15 : 1.0);
    const strokeBurstTotal = Math.round((8 + Math.min(14, comboCount * 0.55)) * scoreBonus);

    for (let i = 0; i < strokeBurstTotal; i++) {
      const origin = anchorLocalPts[i % anchorLocalPts.length];
      const isSakura = Math.random() < tierCfg.sakuraRatio;
      const spreadAngle = Math.atan2(dirY, dirX) + (Math.random() - 0.5) * 2.4;
      const speed = (65 + Math.random() * 145) * tierCfg.burstScale;

      if (isSakura) {
        const p = this.spawnSakura(origin.x, origin.y, tierCfg, 'stroke', 1.0);
        if (p) {
          p.vx = Math.cos(spreadAngle) * speed * 0.78 + (Math.random() - 0.3) * 40;
          p.vy = Math.sin(spreadAngle) * speed * 0.72 - 42;
        }
      } else {
        const p = this.spawnEmber(origin.x, origin.y, tierCfg, 'stroke', 1.0);
        if (p) {
          p.vx = Math.cos(spreadAngle) * speed;
          p.vy = Math.sin(spreadAngle) * speed - 55;
        }
      }
    }

    // 高評価（88点以上）で筆跡先端から気合の和風衝撃波リング
    if (score >= 88 && anchorLocalPts.length > 0) {
      const tip = anchorLocalPts[anchorLocalPts.length - 1];
      this.rings.push({
        x: tip.x,
        y: tip.y,
        r: 6,
        maxR: 48 + Math.min(36, comboCount * 1.4),
        alpha: 0.78,
        color: tierIdx >= 5 ? '#38bdf8' : '#f97316',
        lineWidth: 2.6
      });
    }

    // 2. 主人公の構え・道場下部からも闘気の火の粉と桜吹雪が立ち昇る
    const stageBurstCount = Math.round((6 + Math.min(16, comboCount * 0.65)) * scoreBonus);
    for (let i = 0; i < stageBurstCount; i++) {
      const bx = this.boyCenter.x + (Math.random() - 0.5) * 110;
      const by = this.boyCenter.y + (Math.random() - 0.35) * 44;
      if (Math.random() < tierCfg.sakuraRatio * 0.9) {
        this.spawnSakura(bx, by, tierCfg, 'dojo', 1.0);
      } else {
        this.spawnEmber(bx, by, tierCfg, 'dojo', 1.05);
      }
    }

    this.startLoop();
  }

  // 闘気ティア昇格時の道場全体覚醒サージ（5, 10, 15, 20, 30, 40コンボで段階的に豪華化）
  triggerTierSurge(tierIdx, milestoneCfg = null) {
    if (this.reducedMotion || !this.canvas) return;
    this.resize();
    const tierCfg = this.getTierConfig(tierIdx);

    const ringColor = milestoneCfg
      ? milestoneCfg.ringColor
      : (tierIdx >= 7 ? '#facc15' : (tierIdx >= 6 ? '#67e8f9' : '#fbbf24'));
    const ringCount = milestoneCfg ? milestoneCfg.ringCount : (tierIdx >= 6 ? 2 : 1);

    for (let r = 0; r < ringCount; r++) {
      this.rings.push({
        x: this.boyCenter.x,
        y: this.boyCenter.y - 14,
        r: 12 + r * 14,
        maxR: Math.max(150, this.width * (0.44 + r * 0.15 + tierIdx * 0.03)),
        alpha: 0.88 - r * 0.14,
        color: r === 1 && tierIdx >= 7 ? '#38bdf8' : ringColor,
        lineWidth: 3.4 - r * 0.5
      });
    }

    const surgeCount = 14 + tierIdx * 7;
    for (let i = 0; i < surgeCount; i++) {
      const angle = (Math.PI * 2 * i) / surgeCount + (Math.random() - 0.5) * 0.3;
      const spd = 95 + Math.random() * 175;
      const x = this.boyCenter.x + Math.cos(angle) * 26;
      const y = this.boyCenter.y + Math.sin(angle) * 18;
      if (tierCfg.goldLeafRate > 0 && i % 4 === 0) {
        const g = this.spawnGoldLeaf(x, y, tierCfg, 'dojo', 1.2);
        if (g) {
          g.vx = Math.cos(angle) * spd * 0.85;
          g.vy = Math.sin(angle) * spd * 0.65 - 100;
        }
      } else if (Math.random() < tierCfg.sakuraRatio) {
        const p = this.spawnSakura(x, y, tierCfg, 'dojo', 1.15);
        if (p) {
          p.vx = Math.cos(angle) * spd * 0.9;
          p.vy = Math.sin(angle) * spd * 0.65 - 95;
        }
      } else {
        const p = this.spawnEmber(x, y, tierCfg, 'dojo', 1.2);
        if (p) {
          p.vx = Math.cos(angle) * spd;
          p.vy = Math.sin(angle) * spd * 0.7 - 120;
        }
      }
    }

    // 30コンボ以上で蒼雷、40コンボ以上で黄金稲妻の連撃スパーク
    if (tierIdx >= 6) {
      const bolts = tierIdx >= 7 ? 4 : 2;
      for (let b = 0; b < bolts; b++) {
        this.spawnLightning(this.boyCenter.x, this.boyCenter.y - 24, tierIdx >= 7);
      }
    }
    this.startLoop();
  }

  // 第8問クリア時：障子吹き飛ばしに合わせた左右疾風＆桜吹雪のパノラマ開放バースト
  triggerShojiBlowGust() {
    if (this.reducedMotion || !this.canvas) return;
    this.resize();
    if (!this.width || !this.height) return;

    const cx = this.width * 0.5;
    const cy = this.height * 0.34;
    const tierCfg = this.getTierConfig(Math.max(3, this.tierIndex));

    this.rings.push({
      x: cx,
      y: cy,
      r: 18,
      maxR: Math.max(220, this.width * 0.72),
      alpha: 0.75,
      color: '#fef08a',
      lineWidth: 3.6
    });

    // 左右外向きへ吹き飛ぶ桜吹雪と夜風ストリーク
    const burstCount = 34;
    for (let i = 0; i < burstCount; i++) {
      const goRight = i % 2 === 0;
      const dir = goRight ? 1 : -1;
      const ox = cx + dir * (16 + Math.random() * 48);
      const oy = this.height * (0.14 + Math.random() * 0.42);
      const spd = 210 + Math.random() * 240;

      const p = this.spawnSakura(ox, oy, tierCfg, 'dojo', 1.25);
      if (p) {
        p.vx = dir * spd;
        p.vy = -35 + (Math.random() - 0.5) * 90;
        p.life = 0.85 + Math.random() * 0.45;
      }

      if (i % 3 === 0) {
        this.particles.push({
          type: 'streak',
          source: 'dojo',
          x: ox,
          y: oy,
          vx: dir * (360 + Math.random() * 220),
          vy: (Math.random() - 0.5) * 65,
          len: 36 + Math.random() * 44,
          width: 1.8 + Math.random() * 1.4,
          color: i % 2 === 0 ? '#fef9c3' : '#e0f2fe',
          alpha: 0.58,
          age: 0,
          life: 0.38 + Math.random() * 0.18
        });
      }
    }

    this.startLoop();
  }

  spawnAmbientParticle(tierCfg) {
    if (!this.width || !this.height) return;
    const w = this.width;
    const h = this.height;

    if (tierCfg.goldLeafRate > 0 && Math.random() < tierCfg.goldLeafRate) {
      // 金箔（きんぱく）：15コンボ以上で道場に舞う和風のきらめき
      const x = Math.random() < 0.7
        ? this.boyCenter.x + (Math.random() - 0.5) * w * 0.75
        : Math.random() * w;
      const y = h * (0.45 + Math.random() * 0.58);
      this.spawnGoldLeaf(x, y, tierCfg, 'dojo', 1.0);
    } else if (Math.random() < tierCfg.sakuraRatio) {
      // 桜の花びら：左端・下端・右側から和風の旋風に乗って舞う
      const fromBottom = Math.random() < 0.62;
      const x = fromBottom ? Math.random() * w : (Math.random() < 0.5 ? -10 : w + 10);
      const y = fromBottom ? h + 8 : h * (0.25 + Math.random() * 0.75);
      this.spawnSakura(x, y, tierCfg, 'dojo', 1.0);
    } else {
      // 火の粉：主人公の足元や道場下部全体から勢いよく立ち昇る
      const nearBoy = Math.random() < 0.52;
      const x = nearBoy
        ? this.boyCenter.x + (Math.random() - 0.5) * 140
        : Math.random() * w;
      const y = nearBoy
        ? this.boyCenter.y + 18 + Math.random() * 24
        : h + 6;
      this.spawnEmber(x, y, tierCfg, 'dojo', 1.0);
    }
  }

  spawnGoldLeaf(x, y, tierCfg, source = 'dojo', scaleMult = 1.0) {
    if (this.particles.length >= 185) return null;
    const wind = Math.max(1.0, tierCfg.windSpeed || 1.2);
    const goldPalette = ['#fde047', '#facc15', '#fef08a', '#f59e0b', '#fffbeb'];
    const p = {
      type: 'goldleaf',
      source,
      x,
      y,
      vx: (Math.random() - 0.42) * 54 * wind,
      vy: -(48 + Math.random() * 72) * wind,
      size: (3.6 + Math.random() * 3.8) * scaleMult,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 5.2,
      flip: Math.random() * Math.PI * 2,
      vFlip: 4.5 + Math.random() * 5.5,
      swayPhase: Math.random() * Math.PI * 2,
      color: goldPalette[Math.floor(Math.random() * goldPalette.length)],
      alpha: 0.82 + Math.random() * 0.18,
      age: 0,
      life: 1.5 + Math.random() * 1.1
    };
    this.particles.push(p);
    return p;
  }

  spawnLightning(cx, cy, isGold = false) {
    if (this.particles.length >= 185) return null;
    const baseAngle = -Math.PI * 0.5 + (Math.random() - 0.5) * 2.4;
    const totalLen = 46 + Math.random() * 68;
    const segs = 5 + Math.floor(Math.random() * 3);
    const points = [{ x: cx + (Math.random() - 0.5) * 44, y: cy + (Math.random() - 0.5) * 32 }];
    for (let s = 1; s <= segs; s++) {
      const t = s / segs;
      const jitter = (Math.random() - 0.5) * 24;
      points.push({
        x: points[0].x + Math.cos(baseAngle) * totalLen * t + jitter,
        y: points[0].y + Math.sin(baseAngle) * totalLen * t + (Math.random() - 0.5) * 14
      });
    }
    const p = {
      type: 'lightning',
      source: 'dojo',
      x: points[0].x,
      y: points[0].y,
      points,
      color: isGold ? (Math.random() < 0.55 ? '#fde047' : '#67e8f9') : (Math.random() < 0.7 ? '#67e8f9' : '#ffffff'),
      width: isGold ? 2.4 : 1.9,
      alpha: 0.95,
      age: 0,
      life: 0.16 + Math.random() * 0.1
    };
    this.particles.push(p);
    return p;
  }

  spawnSakura(x, y, tierCfg, source = 'dojo', scaleMult = 1.0) {
    if (this.particles.length >= 185) return null;
    const palette = tierCfg.sakuraColors || ['#fbcfe8', '#f9a8d4'];
    const wind = Math.max(0.8, tierCfg.windSpeed || 1.0);
    const dir = Math.random() < 0.72 ? 1 : -1;
    const p = {
      type: 'sakura',
      source,
      x,
      y,
      vx: dir * (22 + Math.random() * 58) * wind,
      vy: -(38 + Math.random() * 68) * wind,
      size: (4.8 + Math.random() * 4.4) * scaleMult,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * (3.2 + wind * 1.4),
      flip: Math.random() * Math.PI * 2,
      vFlip: 2.5 + Math.random() * 3.8,
      swayPhase: Math.random() * Math.PI * 2,
      swayAmp: 18 + Math.random() * 26,
      color: palette[Math.floor(Math.random() * palette.length)],
      alpha: 0.75 + Math.random() * 0.25,
      age: 0,
      life: source === 'stroke' ? (0.85 + Math.random() * 0.65) : (2.2 + Math.random() * 1.8)
    };
    this.particles.push(p);
    return p;
  }

  spawnEmber(x, y, tierCfg, source = 'dojo', scaleMult = 1.0) {
    if (this.particles.length >= 185) return null;
    const palette = tierCfg.emberColors || ['#fbbf24', '#f97316'];
    const wind = Math.max(0.85, tierCfg.windSpeed || 1.0);
    const p = {
      type: 'ember',
      source,
      x,
      y,
      vx: (Math.random() - 0.45) * (42 + wind * 24),
      vy: -(82 + Math.random() * 110) * wind,
      size: (1.7 + Math.random() * 2.3) * scaleMult,
      wobblePhase: Math.random() * Math.PI * 2,
      color: palette[Math.floor(Math.random() * palette.length)],
      alpha: 0.85 + Math.random() * 0.15,
      age: 0,
      life: source === 'stroke' ? (0.55 + Math.random() * 0.45) : (1.15 + Math.random() * 1.05)
    };
    this.particles.push(p);
    return p;
  }

  spawnWindStreak(tierCfg) {
    if (this.particles.length >= 185 || !this.width || !this.height) return;
    const wind = tierCfg.windSpeed || 1.5;
    // 左右の道場余白や下部ステージに沿って気流線が走る
    const sideBias = Math.random() < 0.75;
    const x = sideBias
      ? (Math.random() < 0.5 ? Math.random() * (this.width * 0.24) : this.width - Math.random() * (this.width * 0.24))
      : Math.random() * this.width;
    const y = this.height * (0.45 + Math.random() * 0.55);
    const isGold = tierCfg.tier >= 7;
    const isBlue = tierCfg.tier === 6;
    this.particles.push({
      type: 'streak',
      source: 'dojo',
      x,
      y,
      vx: (Math.random() < 0.5 ? 1 : -1) * (18 + Math.random() * 22),
      vy: -(240 + Math.random() * 180) * (0.7 + wind * 0.25),
      len: 26 + Math.random() * 34,
      width: 1.2 + Math.random() * 1.2,
      color: isGold ? (Math.random() < 0.55 ? '#fde047' : '#67e8f9') : (isBlue ? '#67e8f9' : (Math.random() < 0.5 ? '#fda4af' : '#fbbf24')),
      alpha: 0.34 + Math.random() * 0.24,
      age: 0,
      life: 0.42 + Math.random() * 0.24
    });
  }

  startLoop() {
    if (this.rafId !== null || this.reducedMotion) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    this.isActive = true;
    this.lastTimestamp = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const tick = (now) => {
      if (!this.isActive) {
        this.rafId = null;
        return;
      }
      const dt = Math.min(0.05, Math.max(0.004, (now - this.lastTimestamp) / 1000));
      this.lastTimestamp = now;
      this.step(dt);
      this.render();

      if (this.tierIndex === 0 && this.particles.length === 0 && this.rings.length === 0) {
        this.rafId = null;
        this.isActive = false;
        if (this.ctx) {
          this.ctx.clearRect(0, 0, this.width, this.height);
        }
        return;
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  pauseLoop() {
    this.isActive = false;
    if (this.rafId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  clear() {
    this.comboCount = 0;
    this.tierIndex = 0;
    this.particles = [];
    this.rings = [];
    this.resetTraceCursor();
    this.pauseLoop();
    if (this.ctx && this.width && this.height) {
      this.ctx.clearRect(0, 0, this.width, this.height);
    }
  }

  step(dt) {
    const tierCfg = this.getTierConfig();

    // コンボティアに応じた道場全体の桜吹雪＆火の粉の自動補充
    if (tierCfg.maxAmbient > 0) {
      const ambientCount = this.particles.filter(p => p.source === 'dojo').length;
      const deficit = tierCfg.maxAmbient - ambientCount;
      if (deficit > 0) {
        const toSpawn = Math.min(deficit, Math.max(1, Math.ceil(deficit * 0.22)));
        for (let i = 0; i < toSpawn; i++) {
          this.spawnAmbientParticle(tierCfg);
        }
      }
      if (tierCfg.streakRate > 0 && Math.random() < tierCfg.streakRate) {
        this.spawnWindStreak(tierCfg);
      }
      if (tierCfg.lightningRate > 0 && Math.random() < tierCfg.lightningRate) {
        this.spawnLightning(this.boyCenter.x, this.boyCenter.y - 18, tierCfg.tier >= 7);
      }
    }

    // パーティクル更新
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.life || p.y < -40 || p.x < -50 || p.x > this.width + 50) {
        this.particles.splice(i, 1);
        continue;
      }

      if (p.type === 'sakura') {
        p.swayPhase += dt * 3.2;
        p.rot += p.vRot * dt;
        p.flip += p.vFlip * dt;
        const swayX = Math.cos(p.swayPhase) * p.swayAmp;
        p.x += (p.vx + swayX) * dt;
        p.y += p.vy * dt;
      } else if (p.type === 'goldleaf') {
        p.swayPhase += dt * 4.4;
        p.rot += p.vRot * dt;
        p.flip += p.vFlip * dt;
        p.x += (p.vx + Math.sin(p.swayPhase) * 24) * dt;
        p.y += p.vy * dt;
      } else if (p.type === 'ember') {
        p.wobblePhase += dt * 8.0;
        p.x += (p.vx + Math.sin(p.wobblePhase) * 20) * dt;
        p.y += p.vy * dt;
        p.vy *= (1 - 0.15 * dt);
      } else if (p.type === 'streak') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }

    // 衝撃波リング更新
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.r += (r.maxR - r.r) * Math.min(1, dt * 8.5) + 45 * dt;
      r.alpha -= dt * 1.9;
      if (r.alpha <= 0 || r.r >= r.maxR) {
        this.rings.splice(i, 1);
      }
    }
  }

  getCanvasVisibilityMask(x, y, source) {
    if (!this.arenaRect || source === 'stroke') return 1.0;
    const pad = 4;
    if (
      x > this.arenaRect.left + pad &&
      x < this.arenaRect.right - pad &&
      y > this.arenaRect.top + pad &&
      y < this.arenaRect.bottom - pad
    ) {
      // 書き順キャンバス内では文字の視認性を保つため控えめに透過させる
      return 0.22;
    }
    return 1.0;
  }

  render() {
    const ctx = this.ctx;
    if (!ctx || !this.width || !this.height) return;
    ctx.clearRect(0, 0, this.width, this.height);

    // 1. 衝撃波リング描画
    for (let i = 0; i < this.rings.length; i++) {
      const r = this.rings[i];
      ctx.save();
      ctx.globalAlpha = Math.max(0, r.alpha);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.lineWidth;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 2. パーティクル描画（桜花びら・火の粉・気流線）
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const progress = p.age / p.life;
      const fadeIn = Math.min(1, p.age / 0.14);
      const fadeOut = progress > 0.65 ? Math.max(0, 1 - (progress - 0.65) / 0.35) : 1;
      const mask = this.getCanvasVisibilityMask(p.x, p.y, p.source);
      const alpha = p.alpha * fadeIn * fadeOut * mask;
      if (alpha <= 0.01) continue;

      if (p.type === 'sakura') {
        const tilt = 0.38 + 0.62 * Math.abs(Math.cos(p.flip));
        const r = p.size;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, tilt);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        // 桜の花びら特有の切れ込み形状（オンメモリベクターパス）
        ctx.moveTo(0, r * 0.9);
        ctx.bezierCurveTo(-r * 0.85, r * 0.35, -r * 0.95, -r * 0.55, -r * 0.26, -r * 0.9);
        ctx.lineTo(0, -r * 0.55);
        ctx.lineTo(r * 0.26, -r * 0.9);
        ctx.bezierCurveTo(r * 0.95, -r * 0.55, r * 0.85, r * 0.35, 0, r * 0.9);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.lineWidth = 0.7;
        ctx.stroke();
        ctx.restore();
      } else if (p.type === 'ember') {
        ctx.save();
        // 外側の淡い火の粉グロー
        ctx.globalAlpha = alpha * 0.34;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2.3, 0, Math.PI * 2);
        ctx.fill();

        // 飛跡テール
        ctx.globalAlpha = alpha * 0.85;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1.2, p.size * 0.95);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x - p.vx * 0.028, p.y - p.vy * 0.028);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();

        // 高輝度コア
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.68, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (p.type === 'goldleaf') {
        const tilt = 0.2 + 0.8 * Math.abs(Math.cos(p.flip));
        const s = p.size;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, tilt);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(-s * 0.55, -s * 0.45, s * 1.1, s * 0.9);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.lineWidth = 0.6;
        ctx.strokeRect(-s * 0.55, -s * 0.45, s * 1.1, s * 0.9);
        ctx.restore();
      } else if (p.type === 'lightning') {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        p.points.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
        ctx.restore();
      } else if (p.type === 'streak') {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.width;
        ctx.lineCap = 'round';
        const norm = Math.hypot(p.vx, p.vy) || 1;
        const dx = (p.vx / norm) * p.len;
        const dy = (p.vy / norm) * p.len;
        ctx.beginPath();
        ctx.moveTo(p.x - dx, p.y - dy);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.restore();
      }
    }
  }
}

// ============================================================================
// 3. 空手少年キャラクター（インラインSVGコンポーネント & アニメーション）
// ============================================================================

function createKarateBoySVG(pose = 'idle', beltColor = '#18181B') {
  // pose: 'idle', 'seiken_zuki' ('punch'), 'shitazuki', 'uraken', 'mawashi_geri', 'age_geri' ('kick'), 'zukkoke'
  
  // 1) 正拳突き（Seiken-zuki）: 通常の基本突き技（前方に真っ直ぐ突く）
  if (pose === 'punch' || pose === 'seiken_zuki') {
    return `
      <svg class="karate-boy-svg" viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg">
        <!-- 集中線・突きの衝撃エフェクト -->
        <g stroke="#18181b" stroke-width="2.5" opacity="0.45" stroke-linecap="round">
          <line x1="20" y1="95" x2="5" y2="92" />
          <line x1="18" y1="105" x2="3" y2="108" />
          <line x1="22" y1="85" x2="8" y2="78" />
        </g>
        <!-- 下半身（踏み込み突き姿勢） -->
        <path d="M55 145 L35 185 L50 188 L70 152" fill="#ffffff" stroke="#18181b" stroke-width="4.5" stroke-linejoin="round"/>
        <path d="M95 145 L125 185 L110 188 L85 152" fill="#ffffff" stroke="#18181b" stroke-width="4.5" stroke-linejoin="round"/>
        <!-- 足（素足） -->
        <path d="M30 185 Q35 192 48 190 Q50 185 45 182 Z" fill="#ffedd5" stroke="#18181b" stroke-width="3.5"/>
        <path d="M110 185 Q120 192 132 190 Q130 185 122 182 Z" fill="#ffedd5" stroke="#18181b" stroke-width="3.5"/>
        <!-- 道着胴体（前傾姿勢） -->
        <path d="M50 100 L110 95 L102 152 L48 152 Z" fill="#ffffff" stroke="#18181b" stroke-width="4.5" stroke-linejoin="round"/>
        <!-- 道着の襟（重なり） -->
        <path d="M60 98 L85 135 L70 148" fill="none" stroke="#18181b" stroke-width="4" stroke-linecap="round"/>
        <path d="M100 96 L76 135" fill="none" stroke="#18181b" stroke-width="4" stroke-linecap="round"/>
        <!-- 帯（Belt） -->
        <rect x="46" y="138" width="58" height="13" rx="2" fill="${beltColor}" stroke="#18181b" stroke-width="3.5"/>
        <path d="M72 148 L65 170 L72 172 L77 150 Z" fill="${beltColor}" stroke="#18181b" stroke-width="3"/>
        <path d="M78 148 L86 168 L93 166 L84 150 Z" fill="${beltColor}" stroke="#18181b" stroke-width="3"/>
        <!-- 引手（左腕：腰に引いた拳） -->
        <path d="M100 105 L118 122 L112 135 L96 120" fill="#ffffff" stroke="#18181b" stroke-width="4"/>
        <circle cx="114" cy="132" r="11" fill="#ffedd5" stroke="#18181b" stroke-width="4"/>
        <!-- 正拳突き（右腕：前方に真っ直ぐ突き出された拳） -->
        <path d="M55 105 L28 102 L24 116 L54 118" fill="#ffffff" stroke="#18181b" stroke-width="4.5" stroke-linejoin="round"/>
        <rect x="10" y="94" width="22" height="24" rx="6" fill="#ffedd5" stroke="#18181b" stroke-width="4.5"/>
        <line x1="16" y1="96" x2="16" y2="114" stroke="#18181b" stroke-width="2.5"/>
        <line x1="22" y1="96" x2="22" y2="114" stroke="#18181b" stroke-width="2.5"/>
        <!-- 頭部・顔（気合いの表情） -->
        <circle cx="82" cy="62" r="32" fill="#ffedd5" stroke="#18181b" stroke-width="4.5"/>
        <path d="M50 56 Q52 30 82 28 Q112 30 114 56 Q108 42 98 42 Q90 38 82 43 Q74 38 66 42 Q58 44 50 56 Z" fill="#18181b"/>
        <path d="M62 52 L76 56" stroke="#18181b" stroke-width="5" stroke-linecap="round"/>
        <path d="M102 52 L88 56" stroke="#18181b" stroke-width="5" stroke-linecap="round"/>
        <circle cx="70" cy="62" r="6" fill="#18181b"/>
        <circle cx="94" cy="62" r="6" fill="#18181b"/>
        <circle cx="68" cy="60" r="2" fill="#ffffff"/>
        <circle cx="92" cy="60" r="2" fill="#ffffff"/>
        <path d="M76 74 Q82 82 88 74 Z" fill="#991b1b" stroke="#18181b" stroke-width="3"/>
      </svg>
    `;
  }

  // 2) 下突き（Shitazuki）: 縦（下方向）に伸びる画。腰を深く落として腹部を狙う強烈な下方向の正拳突き
  if (pose === 'shitazuki') {
    return `
      <svg class="karate-boy-svg" viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg">
        <!-- 下方向への鋭いスピード集中線 -->
        <g stroke="#1e3a8a" stroke-width="2.5" opacity="0.5" stroke-linecap="round">
          <line x1="32" y1="125" x2="26" y2="148" />
          <line x1="42" y1="130" x2="38" y2="156" />
          <line x1="52" y1="132" x2="50" y2="158" />
        </g>
        <!-- 下半身（四股立ち・深い腰落とし） -->
        <path d="M50 148 L22 178 L38 184 L64 154" fill="#ffffff" stroke="#18181b" stroke-width="4.5" stroke-linejoin="round"/>
        <path d="M96 148 L126 182 L112 186 L86 154" fill="#ffffff" stroke="#18181b" stroke-width="4.5" stroke-linejoin="round"/>
        <path d="M18 178 Q22 188 34 186 Q36 180 30 176 Z" fill="#ffedd5" stroke="#18181b" stroke-width="3.5"/>
        <path d="M112 182 Q122 190 134 188 Q132 182 124 180 Z" fill="#ffedd5" stroke="#18181b" stroke-width="3.5"/>
        <!-- 道着胴体（低重心） -->
        <path d="M46 108 L108 104 L98 155 L44 155 Z" fill="#ffffff" stroke="#18181b" stroke-width="4.5" stroke-linejoin="round"/>
        <path d="M58 106 L82 142 L68 152" fill="none" stroke="#18181b" stroke-width="4" stroke-linecap="round"/>
        <path d="M96 104 L74 142" fill="none" stroke="#18181b" stroke-width="4" stroke-linecap="round"/>
        <!-- 帯 -->
        <rect x="42" y="142" width="58" height="13" rx="2" fill="${beltColor}" stroke="#18181b" stroke-width="3.5"/>
        <path d="M68 152 L62 174 L70 176 L74 154 Z" fill="${beltColor}" stroke="#18181b" stroke-width="3"/>
        <path d="M75 152 L83 172 L90 170 L82 154 Z" fill="${beltColor}" stroke="#18181b" stroke-width="3"/>
        <!-- 左手（高い位置での水月ガード・引き手） -->
        <path d="M98 110 L115 125 L108 138 L92 124" fill="#ffffff" stroke="#18181b" stroke-width="4"/>
        <circle cx="112" cy="134" r="10" fill="#ffedd5" stroke="#18181b" stroke-width="4"/>
        <!-- 下突き（右腕：斜め下方の腹部・水月へ突き刺す拳） -->
        <path d="M52 112 L34 128 L40 142 L62 124" fill="#ffffff" stroke="#18181b" stroke-width="4.5" stroke-linejoin="round"/>
        <rect x="25" y="132" width="22" height="24" rx="6" transform="rotate(-15 36 144)" fill="#ffedd5" stroke="#18181b" stroke-width="4.5"/>
        <!-- 頭部・気迫の視線（下方を見据える鋭い眼光） -->
        <circle cx="78" cy="72" r="31" fill="#ffedd5" stroke="#18181b" stroke-width="4.5"/>
        <path d="M46 66 Q48 40 78 38 Q108 40 110 66 Q104 52 94 52 Q86 48 78 53 Q70 48 62 52 Q54 54 46 66 Z" fill="#18181b"/>
        <path d="M58 64 L72 68" stroke="#18181b" stroke-width="5" stroke-linecap="round"/>
        <path d="M98 64 L84 68" stroke="#18181b" stroke-width="5" stroke-linecap="round"/>
        <circle cx="66" cy="74" r="6" fill="#18181b"/>
        <circle cx="90" cy="74" r="6" fill="#18181b"/>
        <circle cx="64" cy="75" r="2" fill="#ffffff"/>
        <circle cx="88" cy="75" r="2" fill="#ffffff"/>
        <path d="M72 84 Q78 92 84 84 Z" fill="#991b1b" stroke="#18181b" stroke-width="3"/>
      </svg>
    `;
  }

  // 3) 裏拳（Uraken）: 交差せず長い画。半身に構えて鋭い横回転のスナップ裏拳打ち
  if (pose === 'uraken') {
    return `
      <svg class="karate-boy-svg" viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg">
        <!-- 横スイング・円弧の斬撃風切りエフェクト -->
        <g stroke="#581c87" stroke-width="3" opacity="0.45" stroke-linecap="round" fill="none">
          <path d="M15 80 Q30 65 55 60" />
          <path d="M8 92 Q28 80 50 74" />
        </g>
        <!-- 下半身（半身の猫足立ち） -->
        <path d="M60 144 L46 182 L62 186 L76 150" fill="#ffffff" stroke="#18181b" stroke-width="4.5" stroke-linejoin="round"/>
        <path d="M88 144 L114 182 L100 185 L80 150" fill="#ffffff" stroke="#18181b" stroke-width="4.5" stroke-linejoin="round"/>
        <path d="M42 182 Q46 190 58 188 Q60 182 54 180 Z" fill="#ffedd5" stroke="#18181b" stroke-width="3.5"/>
        <path d="M102 182 Q112 190 122 188 Q120 182 112 180 Z" fill="#ffedd5" stroke="#18181b" stroke-width="3.5"/>
        <!-- 道着胴体（半身に捻った姿勢） -->
        <path d="M56 100 L112 104 L102 152 L54 150 Z" fill="#ffffff" stroke="#18181b" stroke-width="4.5" stroke-linejoin="round"/>
        <rect x="52" y="136" width="54" height="13" rx="2" fill="${beltColor}" stroke="#18181b" stroke-width="3.5"/>
        <path d="M72 146 L66 168 L74 170 L78 148 Z" fill="${beltColor}" stroke="#18181b" stroke-width="3"/>
        <!-- 引手（左腕：胸前に構えるガード） -->
        <path d="M96 106 L108 122 L98 132 L86 118" fill="#ffffff" stroke="#18181b" stroke-width="4"/>
        <circle cx="104" cy="128" r="10" fill="#ffedd5" stroke="#18181b" stroke-width="4"/>
        <!-- 裏拳打ち（右腕：肘を曲げて手首のスナップで外側にスイングした裏拳） -->
        <path d="M58 104 L34 94 L22 78 L42 74 L52 94" fill="#ffffff" stroke="#18181b" stroke-width="4.5" stroke-linejoin="round"/>
        <rect x="12" y="66" width="24" height="22" rx="6" transform="rotate(20 24 77)" fill="#ffedd5" stroke="#18181b" stroke-width="4.5"/>
        <!-- 頭部・気迫の横目線 -->
        <circle cx="84" cy="62" r="31" fill="#ffedd5" stroke="#18181b" stroke-width="4.5"/>
        <path d="M52 56 Q54 30 84 28 Q114 30 116 56 Q110 42 100 42 Q92 38 84 43 Q76 38 68 42 Q60 44 52 56 Z" fill="#18181b"/>
        <path d="M66 52 L80 56" stroke="#18181b" stroke-width="5" stroke-linecap="round"/>
        <path d="M104 52 L90 56" stroke="#18181b" stroke-width="5" stroke-linecap="round"/>
        <circle cx="72" cy="62" r="6" fill="#18181b"/>
        <circle cx="96" cy="62" r="6" fill="#18181b"/>
        <circle cx="69" cy="60" r="2" fill="#ffffff"/>
        <circle cx="93" cy="60" r="2" fill="#ffffff"/>
        <path d="M78 74 Q84 82 90 74 Z" fill="#991b1b" stroke="#18181b" stroke-width="3"/>
      </svg>
    `;
  }

  // 4) 回し蹴り（Mawashi-geri）: 交差して長い画。ダイナミックな体幹回転による円弧キック
  if (pose === 'mawashi_geri') {
    return `
      <svg class="karate-boy-svg" viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg">
        <!-- 豪快な回転円弧エフェクト -->
        <g stroke="#c2410c" stroke-width="3" opacity="0.5" stroke-linecap="round" fill="none">
          <path d="M18 45 Q40 18 78 20" />
          <path d="M12 60 Q34 32 68 32" />
        </g>
        <!-- 軸足（左足・しっかり爪先立ち回転） -->
        <path d="M92 140 L98 184 L84 186 L76 146" fill="#ffffff" stroke="#18181b" stroke-width="4.5" stroke-linejoin="round"/>
        <path d="M78 186 Q86 193 98 191 Q96 183 90 181 Z" fill="#ffedd5" stroke="#18181b" stroke-width="3.5"/>
        <!-- 胴体（回転に合わせて傾斜） -->
        <path d="M62 98 L118 104 L106 152 L58 144 Z" fill="#ffffff" stroke="#18181b" stroke-width="4.5" stroke-linejoin="round"/>
        <rect x="58" y="136" width="52" height="13" rx="2" fill="${beltColor}" stroke="#18181b" stroke-width="3.5"/>
        <!-- 跳躍した右足（水平に大きく振り抜かれた回し蹴り足） -->
        <path d="M68 132 L36 92 L22 52 L38 48 L62 82 L84 125" fill="#ffffff" stroke="#18181b" stroke-width="4.5" stroke-linejoin="round"/>
        <path d="M18 52 Q12 36 28 32 Q34 40 32 50 Z" fill="#ffedd5" stroke="#18181b" stroke-width="4"/>
        <!-- 両手のガード構え -->
        <circle cx="68" cy="106" r="10" fill="#ffedd5" stroke="#18181b" stroke-width="4"/>
        <circle cx="110" cy="110" r="10" fill="#ffedd5" stroke="#18181b" stroke-width="4"/>
        <!-- 頭部（気合いの雄叫び） -->
        <circle cx="92" cy="62" r="30" fill="#ffedd5" stroke="#18181b" stroke-width="4.5"/>
        <path d="M62 56 Q65 30 92 28 Q119 30 122 56 Q115 42 107 42 Q99 38 92 43 Q83 38 75 42 Q69 44 62 56 Z" fill="#18181b"/>
        <path d="M75 54 L87 57" stroke="#18181b" stroke-width="5" stroke-linecap="round"/>
        <path d="M109 54 L97 57" stroke="#18181b" stroke-width="5" stroke-linecap="round"/>
        <circle cx="82" cy="63" r="6" fill="#18181b"/>
        <circle cx="103" cy="63" r="6" fill="#18181b"/>
        <circle cx="80" cy="61" r="2" fill="#ffffff"/>
        <circle cx="101" cy="61" r="2" fill="#ffffff"/>
        <path d="M86 75 Q92 84 98 75 Z" fill="#991b1b" stroke="#18181b" stroke-width="3"/>
      </svg>
    `;
  }

  // 5) 上蹴り（Age-geri / Kick）: 終端が上方向（ハネ）の画。天を突く高い蹴り上げ
  if (pose === 'kick' || pose === 'age_geri') {
    return `
      <svg class="karate-boy-svg" viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg">
        <!-- 上昇する鋭い蹴り上げ風切り線 -->
        <g stroke="#047857" stroke-width="2.5" opacity="0.5" stroke-linecap="round">
          <path d="M30 65 Q45 40 60 28" fill="none"/>
          <path d="M22 80 Q38 52 50 42" fill="none"/>
          <path d="M40 50 L52 24" fill="none"/>
        </g>
        <!-- 軸足（左足・しっかり踏ん張る） -->
        <path d="M95 138 L105 182 L90 185 L80 145" fill="#ffffff" stroke="#18181b" stroke-width="4.5" stroke-linejoin="round"/>
        <path d="M85 185 Q95 192 108 190 Q106 182 98 180 Z" fill="#ffedd5" stroke="#18181b" stroke-width="3.5"/>
        <!-- 胴体（蹴りに合わせて少し後ろへ傾斜） -->
        <path d="M68 98 L122 105 L108 152 L62 144 Z" fill="#ffffff" stroke="#18181b" stroke-width="4.5" stroke-linejoin="round"/>
        <rect x="62" y="136" width="52" height="13" rx="2" fill="${beltColor}" stroke="#18181b" stroke-width="3.5"/>
        <path d="M85 146 L80 168 L88 170 L92 148 Z" fill="${beltColor}" stroke="#18181b" stroke-width="3"/>
        <!-- 天空高く突き上げた前蹴り・上蹴りの右足 -->
        <path d="M72 135 L42 85 L56 75 L88 128" fill="#ffffff" stroke="#18181b" stroke-width="4.5" stroke-linejoin="round"/>
        <!-- 蹴りの足先・上向きの足刀 -->
        <path d="M38 82 Q30 55 48 50 Q56 60 52 75 Z" fill="#ffedd5" stroke="#18181b" stroke-width="4"/>
        <circle cx="70" cy="108" r="10" fill="#ffedd5" stroke="#18181b" stroke-width="4"/>
        <circle cx="112" cy="112" r="10" fill="#ffedd5" stroke="#18181b" stroke-width="4"/>
        <!-- 頭部（気迫） -->
        <circle cx="95" cy="62" r="30" fill="#ffedd5" stroke="#18181b" stroke-width="4.5"/>
        <path d="M65 56 Q68 30 95 28 Q122 30 125 56 Q118 42 110 42 Q102 38 95 43 Q86 38 78 42 Q72 44 65 56 Z" fill="#18181b"/>
        <path d="M78 54 L90 57" stroke="#18181b" stroke-width="5" stroke-linecap="round"/>
        <path d="M112 54 L100 57" stroke="#18181b" stroke-width="5" stroke-linecap="round"/>
        <circle cx="85" cy="63" r="6" fill="#18181b"/>
        <circle cx="106" cy="63" r="6" fill="#18181b"/>
        <circle cx="83" cy="61" r="2" fill="#ffffff"/>
        <circle cx="104" cy="61" r="2" fill="#ffffff"/>
        <path d="M90 75 Q96 84 102 75 Z" fill="#991b1b" stroke="#18181b" stroke-width="3"/>
      </svg>
    `;
  }

  // 6) ずっこけ（Zukkoke）: スコア30点未満。技が出ず足がもつれてコミカルに崩れる
  if (pose === 'zukkoke') {
    return `
      <svg class="karate-boy-svg" viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg">
        <!-- 汗マーク（コミカルな飛び散る汗） -->
        <g fill="#38bdf8" stroke="#0284c7" stroke-width="1.5">
          <path d="M118 38 Q128 42 122 50 Q114 48 118 38 Z" />
          <path d="M130 52 Q138 56 134 62 Q126 60 130 52 Z" />
        </g>
        <!-- ふらつく両足（もつれた足） -->
        <path d="M48 140 L28 175 L45 178 L65 145" fill="#ffffff" stroke="#18181b" stroke-width="4.5" stroke-linejoin="round"/>
        <path d="M78 140 L92 165 L118 170 L102 142" fill="#ffffff" stroke="#18181b" stroke-width="4.5" stroke-linejoin="round"/>
        <path d="M22 175 Q26 185 38 182 Q40 176 34 174 Z" fill="#ffedd5" stroke="#18181b" stroke-width="3.5"/>
        <path d="M115 168 Q122 176 132 172 Q128 166 120 166 Z" fill="#ffedd5" stroke="#18181b" stroke-width="3.5"/>
        <!-- 道着胴体（大きく右に傾斜） -->
        <path d="M52 102 L112 110 L94 154 L44 146 Z" fill="#ffffff" stroke="#18181b" stroke-width="4.5" stroke-linejoin="round"/>
        <rect x="44" y="136" width="56" height="13" rx="2" transform="rotate(8 72 142)" fill="${beltColor}" stroke="#18181b" stroke-width="3.5"/>
        <path d="M68 148 L62 168 L70 170 L74 150 Z" fill="${beltColor}" stroke="#18181b" stroke-width="3"/>
        <!-- 両腕（慌ててバタバタ泳ぐ手） -->
        <path d="M46 112 L24 104 L22 120 L44 122" fill="#ffffff" stroke="#18181b" stroke-width="4"/>
        <circle cx="20" cy="112" r="11" fill="#ffedd5" stroke="#18181b" stroke-width="4"/>
        <path d="M110 116 L134 112 L132 128 L108 126" fill="#ffffff" stroke="#18181b" stroke-width="4"/>
        <circle cx="136" cy="120" r="11" fill="#ffedd5" stroke="#18181b" stroke-width="4"/>
        <!-- 頭部（困り顔・コミカルな傾き） -->
        <circle cx="86" cy="68" r="31" fill="#ffedd5" stroke="#18181b" stroke-width="4.5"/>
        <path d="M54 62 Q56 36 86 34 Q116 36 118 62 Q112 48 102 48 Q94 44 86 49 Q78 44 70 48 Q62 50 54 62 Z" fill="#18181b"/>
        <!-- 困り眉（ハの字） -->
        <path d="M68 58 L80 54" stroke="#18181b" stroke-width="4.5" stroke-linecap="round"/>
        <path d="M104 54 L92 58" stroke="#18181b" stroke-width="4.5" stroke-linecap="round"/>
        <!-- ぐるぐる・バツ目（コミカルな目） -->
        <g stroke="#18181b" stroke-width="3.5" stroke-linecap="round">
          <line x1="68" y1="64" x2="78" y2="74" />
          <line x1="78" y1="64" x2="68" y2="74" />
          <line x1="94" y1="64" x2="104" y2="74" />
          <line x1="104" y1="64" x2="94" y2="74" />
        </g>
        <!-- 波打つ口（ずこっ〜！） -->
        <path d="M76 86 Q81 82 86 86 Q91 90 96 86" fill="none" stroke="#18181b" stroke-width="3" stroke-linecap="round"/>
      </svg>
    `;
  }

  // デフォルト: 通常構え（Kamae - 待機姿勢）
  return `
    <svg class="karate-boy-svg" viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg">
      <!-- 両足・道着ズボン -->
      <path d="M52 145 L42 182 L60 185 L74 150" fill="#ffffff" stroke="#18181b" stroke-width="4.5" stroke-linejoin="round"/>
      <path d="M88 150 L102 185 L120 182 L110 145" fill="#ffffff" stroke="#18181b" stroke-width="4.5" stroke-linejoin="round"/>
      <!-- 足（素足） -->
      <path d="M38 182 Q42 192 56 190 Q58 184 52 182 Z" fill="#ffedd5" stroke="#18181b" stroke-width="3.5"/>
      <path d="M106 182 Q112 192 124 190 Q126 184 118 182 Z" fill="#ffedd5" stroke="#18181b" stroke-width="3.5"/>
      <!-- 道着胴体 -->
      <path d="M50 102 L110 102 L102 152 L58 152 Z" fill="#ffffff" stroke="#18181b" stroke-width="4.5" stroke-linejoin="round"/>
      <!-- 道着の襟（打ち合わせ） -->
      <path d="M62 102 L80 138 L68 150" fill="none" stroke="#18181b" stroke-width="4" stroke-linecap="round"/>
      <path d="M98 102 L80 138" fill="none" stroke="#18181b" stroke-width="4" stroke-linecap="round"/>
      <!-- 帯（Belt） -->
      <rect x="54" y="138" width="52" height="13" rx="2" fill="${beltColor}" stroke="#18181b" stroke-width="3.5"/>
      <path d="M74 148 L68 168 L76 170 L80 150 Z" fill="${beltColor}" stroke="#18181b" stroke-width="3"/>
      <path d="M80 148 L87 166 L94 164 L86 150 Z" fill="${beltColor}" stroke="#18181b" stroke-width="3"/>
      <!-- 腕（構え：両拳を構える） -->
      <path d="M48 108 L34 125 L46 135 L58 122" fill="#ffffff" stroke="#18181b" stroke-width="4"/>
      <circle cx="35" cy="130" r="11" fill="#ffedd5" stroke="#18181b" stroke-width="4"/>
      <path d="M112 108 L124 130 L110 140 L98 122" fill="#ffffff" stroke="#18181b" stroke-width="4"/>
      <circle cx="122" cy="136" r="11" fill="#ffedd5" stroke="#18181b" stroke-width="4"/>
      <!-- 頭部・顔 -->
      <circle cx="80" cy="62" r="32" fill="#ffedd5" stroke="#18181b" stroke-width="4.5"/>
      <path d="M48 58 Q50 30 80 28 Q110 30 112 58 Q106 42 96 42 Q88 38 80 43 Q72 38 64 42 Q56 44 48 58 Z" fill="#18181b"/>
      <path d="M60 52 L74 57" stroke="#18181b" stroke-width="5" stroke-linecap="round"/>
      <path d="M100 52 L86 57" stroke="#18181b" stroke-width="5" stroke-linecap="round"/>
      <circle cx="68" cy="63" r="6.5" fill="#18181b"/>
      <circle cx="92" cy="63" r="6.5" fill="#18181b"/>
      <circle cx="66" cy="61" r="2.2" fill="#ffffff"/>
      <circle cx="90" cy="61" r="2.2" fill="#ffffff"/>
      <path d="M75 75 Q80 79 86 75" fill="none" stroke="#18181b" stroke-width="3" stroke-linecap="round"/>
    </svg>
  `;
}

// ============================================================================
// 3.5. 盛り上げ役仲間キャラクター（インラインSVGコンポーネント & アニメーション）
// ============================================================================

/**
 * 忍者煙エフェクト（仲間登場時に「ボンッ！」と現れる漫画風の煙雲）
 */
function createNinjaSmokeSVG() {
  return `
    <svg class="ninja-smoke-svg" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;">
      <defs>
        <radialGradient id="ninjaSmokeGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="70%" stop-color="#e2e8f0"/>
          <stop offset="100%" stop-color="#94a3b8"/>
        </radialGradient>
      </defs>
      <!-- もくもく煙雲の重なり -->
      <g fill="url(#ninjaSmokeGrad)" stroke="#334155" stroke-width="3.5" stroke-linejoin="round">
        <circle cx="60" cy="60" r="28" />
        <circle cx="38" cy="48" r="21" />
        <circle cx="82" cy="48" r="21" />
        <circle cx="34" cy="74" r="18" />
        <circle cx="86" cy="74" r="18" />
        <circle cx="60" cy="34" r="19" />
        <circle cx="60" cy="86" r="18" />
      </g>
      <!-- 煙の渦巻き線（疾走感・破裂感） -->
      <path d="M46 60 Q56 50 64 62 Q68 70 60 74" fill="none" stroke="#64748b" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M74 46 Q84 42 82 52" fill="none" stroke="#64748b" stroke-width="2.5" stroke-linecap="round"/>
      <!-- ボンッ！のコミカルな星型スパーク -->
      <polygon points="18,22 21,27 26,28 22,32 23,37 18,34 13,37 14,32 10,28 15,27" fill="#facc15" stroke="#ca8a04" stroke-width="1.5"/>
      <polygon points="102,26 104,30 109,31 105,35 106,39 102,36 98,39 99,35 95,31 100,30" fill="#facc15" stroke="#ca8a04" stroke-width="1.5"/>
      <polygon points="60,8 62,12 67,13 63,16 64,20 60,18 56,20 57,16 53,13 58,12" fill="#facc15" stroke="#ca8a04" stroke-width="1.5"/>
    </svg>
  `;
}

/**
 * 1) 白ハチマキウサギ（合計スコア100以上で登場）
 * 2足歩行・白いハチマキ・道着・少年と同じ空手技を演武
 */
function createRabbitSVG(pose = 'idle') {
  // 正拳突き
  if (pose === 'punch' || pose === 'seiken_zuki') {
    return `
      <svg class="companion-svg" viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
        <!-- 突きスピード線 -->
        <g stroke="#18181b" stroke-width="2" opacity="0.4" stroke-linecap="round">
          <line x1="16" y1="78" x2="4" y2="76" />
          <line x1="18" y1="88" x2="3" y2="90" />
        </g>
        <!-- 下半身（踏み込み） -->
        <ellipse cx="44" cy="144" rx="10" ry="7" fill="#ffffff" stroke="#18181b" stroke-width="3.5"/>
        <ellipse cx="82" cy="144" rx="10" ry="7" fill="#ffffff" stroke="#18181b" stroke-width="3.5"/>
        <!-- 道着胴体 & 黒帯 -->
        <path d="M40 92 L80 90 L75 130 L45 130 Z" fill="#ffffff" stroke="#18181b" stroke-width="3.5"/>
        <rect x="42" y="118" width="36" height="9" fill="#18181b" rx="2"/>
        <!-- 引手（左手） -->
        <circle cx="86" cy="108" r="8" fill="#ffffff" stroke="#18181b" stroke-width="3"/>
        <!-- 正拳突き（右手・前方に突き出し） -->
        <path d="M42 96 L22 92 L18 102 L40 106" fill="#ffffff" stroke="#18181b" stroke-width="3"/>
        <circle cx="16" cy="98" r="9" fill="#ffffff" stroke="#18181b" stroke-width="3.5"/>
        <!-- うさぎの耳（白＋ピンク・斜め前傾） -->
        <path d="M46 45 Q36 10 44 8 Q56 12 54 44 Z" fill="#ffffff" stroke="#18181b" stroke-width="3.5"/>
        <path d="M46 38 Q42 16 45 15 Q50 16 50 38 Z" fill="#fbcfe8"/>
        <path d="M74 45 Q84 10 76 8 Q64 12 66 44 Z" fill="#ffffff" stroke="#18181b" stroke-width="3.5"/>
        <path d="M74 38 Q78 16 75 15 Q70 16 70 38 Z" fill="#fbcfe8"/>
        <!-- 白ハチマキ（たなびく結び目） -->
        <path d="M30 46 L90 46 L90 56 L30 56 Z" fill="#ffffff" stroke="#18181b" stroke-width="3"/>
        <path d="M28 50 L12 42 L16 54 Z" fill="#ffffff" stroke="#18181b" stroke-width="2.5"/>
        <path d="M28 54 L14 62 L20 68 Z" fill="#ffffff" stroke="#18181b" stroke-width="2.5"/>
        <!-- 頭部・顔（気合） -->
        <circle cx="60" cy="62" r="24" fill="#ffffff" stroke="#18181b" stroke-width="3.5"/>
        <!-- 気合のキリッとした目 -->
        <circle cx="48" cy="60" r="4.5" fill="#18181b"/>
        <circle cx="72" cy="60" r="4.5" fill="#18181b"/>
        <circle cx="47" cy="58" r="1.5" fill="#ffffff"/>
        <circle cx="71" cy="58" r="1.5" fill="#ffffff"/>
        <path d="M44 53 L53 56" stroke="#18181b" stroke-width="3" stroke-linecap="round"/>
        <path d="M76 53 L67 56" stroke="#18181b" stroke-width="3" stroke-linecap="round"/>
        <!-- ピンクの鼻と口 -->
        <ellipse cx="60" cy="68" rx="3.5" ry="2.5" fill="#f472b6"/>
        <path d="M56 73 Q60 78 64 73 Z" fill="#991b1b" stroke="#18181b" stroke-width="2"/>
      </svg>
    `;
  }

    // 下突き
  if (pose === 'shitazuki') {
    return `
      <svg class="companion-svg" viewBox="0 0 140 180" xmlns="http://www.w3.org/2000/svg">
        <g stroke="#18181b" stroke-width="2" opacity="0.4" stroke-linecap="round">
          <line x1="36" y1="126" x2="30" y2="144" />
        </g>
        <path d="M44 118 L24 154 L40 156 L58 126" fill="#fed7aa" stroke="#18181b" stroke-width="2.6"/>
        <path d="M76 118 L104 150 L90 156 L68 126" fill="#fed7aa" stroke="#18181b" stroke-width="2.6"/>
        <path d="M38 110 L82 110 L80 128 L40 128 Z" fill="#18181b"/>
        <polygon points="60,72 92,104 60,136 28,104" fill="#dc2626" stroke="#18181b" stroke-width="2.6"/>
        <text x="60" y="111" font-size="20" font-weight="900" font-family="'Yuji Boku', serif" fill="#fbbf24" text-anchor="middle" stroke="#78350f" stroke-width="0.8">金</text>
        <path d="M32 94 L26 122 L38 124 L42 98" fill="#fed7aa" stroke="#18181b" stroke-width="2.6"/>
        <circle cx="32" cy="128" r="8.5" fill="#fed7aa" stroke="#18181b" stroke-width="2.6"/>
        <circle cx="60" cy="50" r="22" fill="#fed7aa" stroke="#18181b" stroke-width="2.6"/>
        <path d="M38 50 C38 26 82 26 82 50 Z" fill="#18181b"/>
        <circle cx="52" cy="52" r="2.5" fill="#18181b"/>
        <circle cx="68" cy="52" r="2.5" fill="#18181b"/>
      </svg>
    `;
  }

  // 裏拳
  if (pose === 'uraken') {
    return `
      <svg class="companion-svg" viewBox="0 0 140 180" xmlns="http://www.w3.org/2000/svg">
        <path d="M48 116 L34 154 L50 156 L64 124" fill="#fed7aa" stroke="#18181b" stroke-width="2.6"/>
        <path d="M78 116 L98 152 L84 156 L70 124" fill="#fed7aa" stroke="#18181b" stroke-width="2.6"/>
        <path d="M42 108 L86 108 L84 126 L44 126 Z" fill="#18181b"/>
        <polygon points="64,68 96,100 64,132 32,100" fill="#dc2626" stroke="#18181b" stroke-width="2.6"/>
        <text x="64" y="107" font-size="20" font-weight="900" font-family="'Yuji Boku', serif" fill="#fbbf24" text-anchor="middle" stroke="#78350f" stroke-width="0.8">金</text>
        <path d="M60 76 L20 64 L16 76 L54 84" fill="#fed7aa" stroke="#18181b" stroke-width="2.6"/>
        <circle cx="16" cy="68" r="8.5" fill="#fed7aa" stroke="#18181b" stroke-width="2.6"/>
        <circle cx="64" cy="46" r="22" fill="#fed7aa" stroke="#18181b" stroke-width="2.6"/>
        <path d="M42 46 C42 22 86 22 86 46 Z" fill="#18181b"/>
        <circle cx="56" cy="48" r="2.5" fill="#18181b"/>
        <circle cx="72" cy="48" r="2.5" fill="#18181b"/>
      </svg>
    `;
  }

  // 上蹴り
  if (pose === 'kick' || pose === 'age_geri') {
    return `
      <svg class="companion-svg" viewBox="0 0 140 180" xmlns="http://www.w3.org/2000/svg">
        <path d="M72 116 L66 156 L82 158 L86 122" fill="#fed7aa" stroke="#18181b" stroke-width="2.6"/>
        <path d="M50 114 L20 74 L32 66 L62 106" fill="#fed7aa" stroke="#18181b" stroke-width="2.6"/>
        <ellipse cx="18" cy="68" rx="8" ry="6" fill="#fed7aa" stroke="#18181b" stroke-width="2.6"/>
        <polygon points="68,68 100,100 68,132 36,100" fill="#dc2626" stroke="#18181b" stroke-width="2.6"/>
        <text x="68" y="107" font-size="20" font-weight="900" font-family="'Yuji Boku', serif" fill="#fbbf24" text-anchor="middle" stroke="#78350f" stroke-width="0.8">金</text>
        <circle cx="68" cy="46" r="22" fill="#fed7aa" stroke="#18181b" stroke-width="2.6"/>
        <path d="M46 46 C46 22 90 22 90 46 Z" fill="#18181b"/>
        <circle cx="60" cy="48" r="2.5" fill="#18181b"/>
        <circle cx="76" cy="48" r="2.5" fill="#18181b"/>
      </svg>
    `;
  }

  // 回し蹴り
  if (pose === 'mawashi_geri') {
    return `
      <svg class="companion-svg" viewBox="0 0 140 180" xmlns="http://www.w3.org/2000/svg">
        <path d="M78 114 L74 154 L90 156 L94 120" fill="#fed7aa" stroke="#18181b" stroke-width="2.6"/>
        <path d="M54 110 L16 88 L22 74 L62 98" fill="#fed7aa" stroke="#18181b" stroke-width="2.6"/>
        <ellipse cx="14" cy="86" rx="8" ry="6" fill="#fed7aa" stroke="#18181b" stroke-width="2.6"/>
        <polygon points="68,68 100,100 68,132 36,100" fill="#dc2626" stroke="#18181b" stroke-width="2.6"/>
        <text x="68" y="107" font-size="20" font-weight="900" font-family="'Yuji Boku', serif" fill="#fbbf24" text-anchor="middle" stroke="#78350f" stroke-width="0.8">金</text>
        <circle cx="68" cy="46" r="22" fill="#fed7aa" stroke="#18181b" stroke-width="2.6"/>
        <path d="M46 46 C46 22 90 22 90 46 Z" fill="#18181b"/>
        <circle cx="60" cy="48" r="2.5" fill="#18181b"/>
        <circle cx="76" cy="48" r="2.5" fill="#18181b"/>
      </svg>
    `;
  }

  // ずっこけ（技失敗）
  if (pose === 'zukkoke') {
    return `
      <svg class="companion-svg" viewBox="0 0 140 180" xmlns="http://www.w3.org/2000/svg">
        <g transform="rotate(18, 70, 90)">
          <path d="M44 116 L20 134 L30 144 L56 126" fill="#fed7aa" stroke="#18181b" stroke-width="2.6"/>
          <path d="M80 116 L108 134 L98 144 L72 126" fill="#fed7aa" stroke="#18181b" stroke-width="2.6"/>
          <polygon points="64,72 96,104 64,136 32,104" fill="#dc2626" stroke="#18181b" stroke-width="2.6"/>
          <text x="64" y="111" font-size="20" font-weight="900" font-family="'Yuji Boku', serif" fill="#fbbf24" text-anchor="middle" stroke="#78350f" stroke-width="0.8">金</text>
          <circle cx="64" cy="50" r="22" fill="#fed7aa" stroke="#18181b" stroke-width="2.6"/>
          <path d="M42 50 C42 26 86 26 86 50 Z" fill="#18181b"/>
          <circle cx="56" cy="52" r="4" fill="none" stroke="#18181b" stroke-width="2"/>
          <circle cx="72" cy="52" r="4" fill="none" stroke="#18181b" stroke-width="2"/>
        </g>
      </svg>
    `;
  }

  // 通常構え (idle)
  return `
    <svg class="companion-svg" viewBox="0 0 140 180" xmlns="http://www.w3.org/2000/svg">
      <path d="M46 116 L32 154 L48 156 L62 124" fill="#fed7aa" stroke="#18181b" stroke-width="2.6"/>
      <path d="M82 116 L96 154 L80 156 L66 124" fill="#fed7aa" stroke="#18181b" stroke-width="2.6"/>
      <path d="M42 108 L86 108 L84 126 L44 126 Z" fill="#18181b"/>
      <polygon points="64,68 96,100 64,132 32,100" fill="#dc2626" stroke="#18181b" stroke-width="2.6"/>
      <text x="64" y="107" font-size="20" font-weight="900" font-family="'Yuji Boku', serif" fill="#fbbf24" text-anchor="middle" stroke="#78350f" stroke-width="0.8">金</text>
      <path d="M36 88 L22 98 L28 108 L40 98" fill="#fed7aa" stroke="#18181b" stroke-width="2.6"/>
      <circle cx="22" cy="98" r="7.5" fill="#fed7aa" stroke="#18181b" stroke-width="2.6"/>
      <path d="M92 88 L106 98 L100 108 L88 98" fill="#fed7aa" stroke="#18181b" stroke-width="2.6"/>
      <circle cx="106" cy="98" r="7.5" fill="#fed7aa" stroke="#18181b" stroke-width="2.6"/>
      <circle cx="64" cy="46" r="22" fill="#fed7aa" stroke="#18181b" stroke-width="2.6"/>
      <path d="M42 46 C42 22 86 22 86 46 Z" fill="#18181b"/>
      <line x1="52" y1="42" x2="60" y2="44" stroke="#18181b" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="76" y1="42" x2="68" y2="44" stroke="#18181b" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="56" cy="48" r="2.5" fill="#18181b"/>
      <circle cx="72" cy="48" r="2.5" fill="#18181b"/>
      <path d="M58 56 Q64 60 70 56" stroke="#18181b" stroke-width="2" fill="none"/>
    </svg>
  `;
}

/**
 * 2.5) 赤ずきんの女の子（合計スコア250以上で登場）
 * 赤い頭巾マントをまとった勇敢な女の子空手家
 */
function createRedRidingHoodSVG(pose = 'idle') {
  // 正拳突き
  if (pose === 'punch' || pose === 'seiken_zuki') {
    return `
      <svg class="companion-svg" viewBox="0 0 130 170" xmlns="http://www.w3.org/2000/svg">
        <g stroke="#18181b" stroke-width="2" opacity="0.4" stroke-linecap="round">
          <line x1="20" y1="92" x2="6" y2="90" />
          <line x1="22" y1="102" x2="5" y2="104" />
        </g>
        <!-- なびく赤いマント（背面） -->
        <path d="M38 72 Q12 90 20 138 Q52 142 58 108" fill="#ef4444" stroke="#dc2626" stroke-width="3"/>
        <path d="M72 72 Q108 90 102 138 Q78 142 68 108" fill="#ef4444" stroke="#dc2626" stroke-width="3"/>
        <!-- 足 -->
        <path d="M46 118 L40 152 L54 154 L58 122" fill="#ffffff" stroke="#18181b" stroke-width="3"/>
        <path d="M68 118 L76 152 L62 154 L58 122" fill="#ffffff" stroke="#18181b" stroke-width="3"/>
        <ellipse cx="44" cy="154" rx="7" ry="4.5" fill="#fed7aa" stroke="#18181b" stroke-width="2.5"/>
        <ellipse cx="72" cy="154" rx="7" ry="4.5" fill="#fed7aa" stroke="#18181b" stroke-width="2.5"/>
        <!-- 道着胴体 & 黒帯 -->
        <path d="M42 80 L80 80 L74 122 L46 122 Z" fill="#ffffff" stroke="#18181b" stroke-width="3"/>
        <rect x="42" y="106" width="36" height="9" fill="#18181b" rx="2"/>
        <!-- 引き手と正拳突き -->
        <circle cx="82" cy="98" r="8" fill="#fed7aa" stroke="#18181b" stroke-width="2.5"/>
        <path d="M46 86 L20 82 L18 94 L44 98" fill="#ffffff" stroke="#18181b" stroke-width="2.8"/>
        <circle cx="16" cy="88" r="8.5" fill="#fed7aa" stroke="#18181b" stroke-width="3"/>
        <!-- 赤ずきんフード（頭部） -->
        <circle cx="62" cy="52" r="30" fill="#ef4444" stroke="#dc2626" stroke-width="3.5"/>
        <!-- リボン結び目（首元） -->
        <circle cx="62" cy="78" r="5" fill="#dc2626" stroke="#b91c1c" stroke-width="1.8"/>
        <path d="M60 80 L52 90 L58 92" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M64 80 L72 90 L66 92" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round"/>
        <!-- 顔 & 前髪 -->
        <circle cx="62" cy="54" r="21" fill="#fed7aa" stroke="#18181b" stroke-width="2.8"/>
        <path d="M44 48 Q54 36 62 42 Q70 36 80 48 Q72 44 62 45 Q52 44 44 48 Z" fill="#78350f"/>
        <circle cx="53" cy="54" r="3.5" fill="#18181b"/>
        <circle cx="71" cy="54" r="3.5" fill="#18181b"/>
        <circle cx="52" cy="52" r="1.2" fill="#ffffff"/>
        <circle cx="70" cy="52" r="1.2" fill="#ffffff"/>
        <ellipse cx="49" cy="60" rx="3.5" ry="2" fill="#fca5a5" opacity="0.8"/>
        <ellipse cx="75" cy="60" rx="3.5" ry="2" fill="#fca5a5" opacity="0.8"/>
        <path d="M58 64 Q62 68 66 64" fill="none" stroke="#18181b" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;
  }

  // 下突き
  if (pose === 'shitazuki') {
    return `
      <svg class="companion-svg" viewBox="0 0 130 170" xmlns="http://www.w3.org/2000/svg">
        <g stroke="#1e3a8a" stroke-width="2" opacity="0.45" stroke-linecap="round">
          <line x1="32" y1="110" x2="26" y2="128" />
          <line x1="42" y1="114" x2="36" y2="132" />
        </g>
        <path d="M38 76 Q12 94 24 142 Q52 144 58 112" fill="#ef4444" stroke="#dc2626" stroke-width="3"/>
        <path d="M72 76 Q108 94 98 142 Q78 144 68 112" fill="#ef4444" stroke="#dc2626" stroke-width="3"/>
        <path d="M46 122 L38 154 L52 156 L58 126" fill="#ffffff" stroke="#18181b" stroke-width="3"/>
        <path d="M68 122 L78 154 L64 156 L58 126" fill="#ffffff" stroke="#18181b" stroke-width="3"/>
        <ellipse cx="42" cy="156" rx="7" ry="4.5" fill="#fed7aa" stroke="#18181b" stroke-width="2.5"/>
        <ellipse cx="74" cy="156" rx="7" ry="4.5" fill="#fed7aa" stroke="#18181b" stroke-width="2.5"/>
        <path d="M42 84 L80 84 L74 126 L46 126 Z" fill="#ffffff" stroke="#18181b" stroke-width="3"/>
        <rect x="42" y="110" width="36" height="9" fill="#18181b" rx="2"/>
        <circle cx="80" cy="102" r="8" fill="#fed7aa" stroke="#18181b" stroke-width="2.5"/>
        <!-- 下突き拳 -->
        <circle cx="30" cy="122" r="8.5" fill="#fed7aa" stroke="#18181b" stroke-width="3"/>
        <circle cx="62" cy="56" r="30" fill="#ef4444" stroke="#dc2626" stroke-width="3.5"/>
        <circle cx="62" cy="82" r="5" fill="#dc2626" stroke="#b91c1c" stroke-width="1.8"/>
        <circle cx="62" cy="58" r="21" fill="#fed7aa" stroke="#18181b" stroke-width="2.8"/>
        <path d="M44 52 Q54 40 62 46 Q70 40 80 52 Q72 48 62 49 Q52 48 44 52 Z" fill="#78350f"/>
        <circle cx="53" cy="58" r="3.5" fill="#18181b"/>
        <circle cx="71" cy="58" r="3.5" fill="#18181b"/>
        <path d="M58 68 Q62 72 66 68" fill="none" stroke="#18181b" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;
  }

  // 裏拳
  if (pose === 'uraken') {
    return `
      <svg class="companion-svg" viewBox="0 0 130 170" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 70 Q28 54 52 52" fill="none" stroke="#581c87" stroke-width="2.5" opacity="0.45" stroke-linecap="round"/>
        <!-- ひるがえるマント -->
        <path d="M30 68 Q0 78 8 132 Q46 138 56 104" fill="#ef4444" stroke="#dc2626" stroke-width="3"/>
        <path d="M46 118 L40 152 L54 154 L58 122" fill="#ffffff" stroke="#18181b" stroke-width="3"/>
        <path d="M68 118 L76 152 L62 154 L58 122" fill="#ffffff" stroke="#18181b" stroke-width="3"/>
        <ellipse cx="44" cy="154" rx="7" ry="4.5" fill="#fed7aa" stroke="#18181b" stroke-width="2.5"/>
        <ellipse cx="72" cy="154" rx="7" ry="4.5" fill="#fed7aa" stroke="#18181b" stroke-width="2.5"/>
        <path d="M42 80 L80 80 L74 122 L46 122 Z" fill="#ffffff" stroke="#18181b" stroke-width="3"/>
        <rect x="42" y="106" width="36" height="9" fill="#18181b" rx="2"/>
        <!-- 裏拳スイング拳 -->
        <circle cx="14" cy="68" r="8.5" fill="#fed7aa" stroke="#18181b" stroke-width="3"/>
        <circle cx="62" cy="52" r="30" fill="#ef4444" stroke="#dc2626" stroke-width="3.5"/>
        <circle cx="62" cy="78" r="5" fill="#dc2626" stroke="#b91c1c" stroke-width="1.8"/>
        <circle cx="62" cy="54" r="21" fill="#fed7aa" stroke="#18181b" stroke-width="2.8"/>
        <path d="M44 48 Q54 36 62 42 Q70 36 80 48 Q72 44 62 45 Q52 44 44 48 Z" fill="#78350f"/>
        <circle cx="53" cy="54" r="3.5" fill="#18181b"/>
        <circle cx="71" cy="54" r="3.5" fill="#18181b"/>
        <path d="M58 64 Q62 68 66 64" fill="none" stroke="#18181b" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;
  }

  // 回し蹴り
  if (pose === 'mawashi_geri') {
    return `
      <svg class="companion-svg" viewBox="0 0 130 170" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 36 Q34 16 66 18" fill="none" stroke="#c2410c" stroke-width="2.5" opacity="0.45" stroke-linecap="round"/>
        <path d="M74 72 Q112 84 108 136 Q84 140 70 108" fill="#ef4444" stroke="#dc2626" stroke-width="3"/>
        <!-- 軸足 -->
        <path d="M68 116 L74 152 L60 154 L56 120" fill="#ffffff" stroke="#18181b" stroke-width="3"/>
        <ellipse cx="68" cy="154" rx="7" ry="4.5" fill="#fed7aa" stroke="#18181b" stroke-width="2.5"/>
        <path d="M46 80 L84 80 L76 122 L48 122 Z" fill="#ffffff" stroke="#18181b" stroke-width="3"/>
        <rect x="46" y="106" width="36" height="9" fill="#18181b" rx="2"/>
        <!-- 回し蹴り足 -->
        <path d="M50 110 L24 78 L12 48 L24 44 L44 70 L60 104" fill="#ffffff" stroke="#18181b" stroke-width="3"/>
        <ellipse cx="14" cy="46" rx="7.5" ry="5" fill="#fed7aa" stroke="#18181b" stroke-width="2.8"/>
        <circle cx="64" cy="52" r="30" fill="#ef4444" stroke="#dc2626" stroke-width="3.5"/>
        <circle cx="64" cy="78" r="5" fill="#dc2626" stroke="#b91c1c" stroke-width="1.8"/>
        <circle cx="64" cy="54" r="21" fill="#fed7aa" stroke="#18181b" stroke-width="2.8"/>
        <path d="M46 48 Q56 36 64 42 Q72 36 82 48 Q74 44 64 45 Q54 44 46 48 Z" fill="#78350f"/>
        <circle cx="55" cy="54" r="3.5" fill="#18181b"/>
        <circle cx="73" cy="54" r="3.5" fill="#18181b"/>
        <path d="M60 64 Q64 68 68 64" fill="none" stroke="#18181b" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;
  }

  // 上蹴り
  if (pose === 'kick' || pose === 'age_geri') {
    return `
      <svg class="companion-svg" viewBox="0 0 130 170" xmlns="http://www.w3.org/2000/svg">
        <path d="M22 52 Q34 30 46 22" fill="none" stroke="#047857" stroke-width="2" opacity="0.45" stroke-linecap="round"/>
        <path d="M72 72 Q108 90 102 138 Q78 142 68 108" fill="#ef4444" stroke="#dc2626" stroke-width="3"/>
        <path d="M68 116 L76 152 L62 154 L58 120" fill="#ffffff" stroke="#18181b" stroke-width="3"/>
        <ellipse cx="70" cy="154" rx="7" ry="4.5" fill="#fed7aa" stroke="#18181b" stroke-width="2.5"/>
        <path d="M44 80 L82 80 L74 122 L46 122 Z" fill="#ffffff" stroke="#18181b" stroke-width="3"/>
        <rect x="44" y="106" width="36" height="9" fill="#18181b" rx="2"/>
        <!-- 上蹴り足 -->
        <path d="M52 110 L28 68 L38 60 L62 104" fill="#ffffff" stroke="#18181b" stroke-width="3"/>
        <ellipse cx="26" cy="64" rx="5.5" ry="8" fill="#fed7aa" stroke="#18181b" stroke-width="2.8"/>
        <circle cx="62" cy="52" r="30" fill="#ef4444" stroke="#dc2626" stroke-width="3.5"/>
        <circle cx="62" cy="78" r="5" fill="#dc2626" stroke="#b91c1c" stroke-width="1.8"/>
        <circle cx="62" cy="54" r="21" fill="#fed7aa" stroke="#18181b" stroke-width="2.8"/>
        <path d="M44 48 Q54 36 62 42 Q70 36 80 48 Q72 44 62 45 Q52 44 44 48 Z" fill="#78350f"/>
        <circle cx="53" cy="54" r="3.5" fill="#18181b"/>
        <circle cx="71" cy="54" r="3.5" fill="#18181b"/>
        <path d="M58 64 Q62 68 66 64" fill="none" stroke="#18181b" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;
  }

  // ずっこけ
  if (pose === 'zukkoke') {
    return `
      <svg class="companion-svg" viewBox="0 0 130 170" xmlns="http://www.w3.org/2000/svg">
        <path d="M96 32 Q102 36 98 42 Q92 40 96 32 Z" fill="#38bdf8"/>
        <path d="M30 84 Q10 110 24 148 Q60 148 66 116" fill="#ef4444" stroke="#dc2626" stroke-width="3"/>
        <!-- もつれた足 -->
        <ellipse cx="38" cy="148" rx="7" ry="4.5" fill="#fed7aa" stroke="#18181b" stroke-width="2.5"/>
        <ellipse cx="88" cy="144" rx="7" ry="4.5" fill="#fed7aa" stroke="#18181b" stroke-width="2.5"/>
        <path d="M42 86 L80 86 L72 126 L44 126 Z" fill="#ffffff" stroke="#18181b" stroke-width="3"/>
        <rect x="40" y="112" width="38" height="9" fill="#18181b" rx="2"/>
        <circle cx="62" cy="56" r="30" fill="#ef4444" stroke="#dc2626" stroke-width="3.5"/>
        <circle cx="62" cy="82" r="5" fill="#dc2626" stroke="#b91c1c" stroke-width="1.8"/>
        <circle cx="62" cy="58" r="21" fill="#fed7aa" stroke="#18181b" stroke-width="2.8"/>
        <!-- ＞＜の困り顔 -->
        <text x="50" y="62" font-size="12" font-weight="900" fill="#18181b">&gt;</text>
        <text x="68" y="62" font-size="12" font-weight="900" fill="#18181b">&lt;</text>
        <ellipse cx="48" cy="66" rx="4" ry="2.5" fill="#fca5a5"/>
        <ellipse cx="76" cy="66" rx="4" ry="2.5" fill="#fca5a5"/>
      </svg>
    `;
  }

  // 通常構え (idle)
  return `
    <svg class="companion-svg" viewBox="0 0 130 170" xmlns="http://www.w3.org/2000/svg">
      <!-- 赤いマント（両肩の後ろにふわりと広がる） -->
      <path d="M38 72 Q12 90 20 138 Q52 142 58 108" fill="#ef4444" stroke="#dc2626" stroke-width="3"/>
      <path d="M72 72 Q108 90 102 138 Q78 142 68 108" fill="#ef4444" stroke="#dc2626" stroke-width="3"/>
      <!-- 足 -->
      <path d="M46 118 L40 152 L54 154 L58 122" fill="#ffffff" stroke="#18181b" stroke-width="3"/>
      <path d="M68 118 L76 152 L62 154 L58 122" fill="#ffffff" stroke="#18181b" stroke-width="3"/>
      <ellipse cx="44" cy="154" rx="7" ry="4.5" fill="#fed7aa" stroke="#18181b" stroke-width="2.5"/>
      <ellipse cx="72" cy="154" rx="7" ry="4.5" fill="#fed7aa" stroke="#18181b" stroke-width="2.5"/>
      <!-- 道着胴体 & 黒帯 -->
      <path d="M42 80 L80 80 L74 122 L46 122 Z" fill="#ffffff" stroke="#18181b" stroke-width="3"/>
      <rect x="42" y="106" width="36" height="9" fill="#18181b" rx="2"/>
      <!-- 両手の構え（ガード） -->
      <circle cx="36" cy="94" r="7.5" fill="#fed7aa" stroke="#18181b" stroke-width="2.5"/>
      <circle cx="84" cy="94" r="7.5" fill="#fed7aa" stroke="#18181b" stroke-width="2.5"/>
      <!-- 赤ずきんフード（頭部） -->
      <circle cx="62" cy="52" r="30" fill="#ef4444" stroke="#dc2626" stroke-width="3.5"/>
      <!-- リボン結び目（首元） -->
      <circle cx="62" cy="78" r="5" fill="#dc2626" stroke="#b91c1c" stroke-width="1.8"/>
      <path d="M60 80 L52 90 L58 92" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M64 80 L72 90 L66 92" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round"/>
      <!-- 顔 & 前髪 -->
      <circle cx="62" cy="54" r="21" fill="#fed7aa" stroke="#18181b" stroke-width="2.8"/>
      <path d="M44 48 Q54 36 62 42 Q70 36 80 48 Q72 44 62 45 Q52 44 44 48 Z" fill="#78350f"/>
      <circle cx="53" cy="54" r="3.5" fill="#18181b"/>
      <circle cx="71" cy="54" r="3.5" fill="#18181b"/>
      <circle cx="52" cy="52" r="1.2" fill="#ffffff"/>
      <circle cx="70" cy="52" r="1.2" fill="#ffffff"/>
      <ellipse cx="49" cy="60" rx="3.5" ry="2" fill="#fca5a5" opacity="0.8"/>
      <ellipse cx="75" cy="60" rx="3.5" ry="2" fill="#fca5a5" opacity="0.8"/>
      <path d="M58 64 Q62 68 66 64" fill="none" stroke="#18181b" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;
}

/**
 * 3.5) オオカミ（合計スコア350以上で登場）
 * カメの約2倍サイズ、迫力満点の童話オオカミ空手家
 */
function createWolfSVG(pose = 'idle') {
  // 正拳突き
  if (pose === 'punch' || pose === 'seiken_zuki') {
    return `
      <svg class="companion-svg" viewBox="0 0 150 210" xmlns="http://www.w3.org/2000/svg">
        <g stroke="#18181b" stroke-width="2.5" opacity="0.4" stroke-linecap="round">
          <line x1="20" y1="105" x2="4" y2="103" />
          <line x1="22" y1="118" x2="3" y2="120" />
        </g>
        <!-- ふさふさの狼尻尾 -->
        <path d="M105 130 Q145 125 142 85 Q125 90 108 116 Z" fill="#475569" stroke="#1e293b" stroke-width="3.5"/>
        <!-- 足 -->
        <path d="M52 144 L44 194 L62 196 L68 150" fill="#ffffff" stroke="#18181b" stroke-width="3.8"/>
        <path d="M82 144 L92 194 L74 196 L68 150" fill="#ffffff" stroke="#18181b" stroke-width="3.8"/>
        <ellipse cx="50" cy="196" rx="10" ry="6" fill="#475569" stroke="#18181b" stroke-width="3"/>
        <ellipse cx="88" cy="196" rx="10" ry="6" fill="#475569" stroke="#18181b" stroke-width="3"/>
        <!-- 道着胴体 & 黒帯 -->
        <path d="M46 94 L98 94 L90 150 L52 150 Z" fill="#ffffff" stroke="#18181b" stroke-width="3.8"/>
        <rect x="46" y="132" width="46" height="11" fill="#0f172a" rx="2"/>
        <!-- 引き手と大正拳突き（鋭い爪つき狼パンチ） -->
        <circle cx="102" cy="116" r="10" fill="#475569" stroke="#18181b" stroke-width="3"/>
        <path d="M50 102 L18 96 L14 112 L46 116" fill="#ffffff" stroke="#18181b" stroke-width="3.5"/>
        <circle cx="12" cy="104" r="12" fill="#475569" stroke="#18181b" stroke-width="3.5"/>
        <!-- 鋭い爪 -->
        <polygon points="4,96 0,92 5,100" fill="#f8fafc"/>
        <polygon points="2,104 -3,104 2,109" fill="#f8fafc"/>
        <polygon points="4,112 0,116 5,110" fill="#f8fafc"/>
        <!-- 狼の耳 -->
        <polygon points="46,38 34,10 56,22" fill="#475569" stroke="#18181b" stroke-width="3"/>
        <polygon points="48,34 38,15 54,24" fill="#f472b6"/>
        <polygon points="86,38 98,10 76,22" fill="#475569" stroke="#18181b" stroke-width="3"/>
        <polygon points="84,34 94,15 78,24" fill="#f472b6"/>
        <!-- 白ハチマキ -->
        <rect x="36" y="34" width="62" height="8" fill="#ffffff" stroke="#18181b" stroke-width="2.5" rx="1"/>
        <!-- 頭部 -->
        <circle cx="68" cy="58" r="28" fill="#475569" stroke="#18181b" stroke-width="3.8"/>
        <!-- マズル（白い口元 & 鼻） -->
        <ellipse cx="68" cy="68" rx="17" ry="13" fill="#f1f5f9" stroke="#18181b" stroke-width="2.5"/>
        <polygon points="68,60 62,66 74,66" fill="#18181b"/>
        <!-- 鋭い目 & キバ -->
        <polygon points="52,48 62,54 54,56" fill="#facc15" stroke="#18181b" stroke-width="1.5"/>
        <circle cx="56" cy="53" r="2.5" fill="#18181b"/>
        <polygon points="84,48 74,54 82,56" fill="#facc15" stroke="#18181b" stroke-width="1.5"/>
        <circle cx="80" cy="53" r="2.5" fill="#18181b"/>
        <!-- 鋭いキバ -->
        <polygon points="60,72 63,80 66,72" fill="#ffffff" stroke="#18181b" stroke-width="1.5"/>
        <polygon points="70,72 73,80 76,72" fill="#ffffff" stroke="#18181b" stroke-width="1.5"/>
      </svg>
    `;
  }

  // 下突き
  if (pose === 'shitazuki') {
    return `
      <svg class="companion-svg" viewBox="0 0 150 210" xmlns="http://www.w3.org/2000/svg">
        <g stroke="#1e3a8a" stroke-width="2.5" opacity="0.45" stroke-linecap="round">
          <line x1="38" y1="125" x2="30" y2="150" />
          <line x1="50" y1="130" x2="42" y2="155" />
        </g>
        <path d="M105 136 Q145 130 142 90 Q125 95 108 122 Z" fill="#475569" stroke="#1e293b" stroke-width="3.5"/>
        <path d="M52 148 L42 196 L60 198 L68 154" fill="#ffffff" stroke="#18181b" stroke-width="3.8"/>
        <path d="M82 148 L94 196 L76 198 L68 154" fill="#ffffff" stroke="#18181b" stroke-width="3.8"/>
        <ellipse cx="48" cy="198" rx="10" ry="6" fill="#475569" stroke="#18181b" stroke-width="3"/>
        <ellipse cx="90" cy="198" rx="10" ry="6" fill="#475569" stroke="#18181b" stroke-width="3"/>
        <path d="M46 98 L98 98 L90 154 L52 154 Z" fill="#ffffff" stroke="#18181b" stroke-width="3.8"/>
        <rect x="46" y="136" width="46" height="11" fill="#0f172a" rx="2"/>
        <circle cx="100" cy="120" r="10" fill="#475569" stroke="#18181b" stroke-width="3"/>
        <!-- 下突き狼爪 -->
        <circle cx="34" cy="144" r="12" fill="#475569" stroke="#18181b" stroke-width="3.5"/>
        <polygon points="46,42 34,14 56,26" fill="#475569" stroke="#18181b" stroke-width="3"/>
        <polygon points="48,38 38,19 54,28" fill="#f472b6"/>
        <polygon points="86,42 98,14 76,26" fill="#475569" stroke="#18181b" stroke-width="3"/>
        <polygon points="84,38 94,19 78,28" fill="#f472b6"/>
        <rect x="36" y="38" width="62" height="8" fill="#ffffff" stroke="#18181b" stroke-width="2.5" rx="1"/>
        <circle cx="68" cy="62" r="28" fill="#475569" stroke="#18181b" stroke-width="3.8"/>
        <ellipse cx="68" cy="72" rx="17" ry="13" fill="#f1f5f9" stroke="#18181b" stroke-width="2.5"/>
        <polygon points="68,64 62,70 74,70" fill="#18181b"/>
        <polygon points="52,52 62,58 54,60" fill="#facc15" stroke="#18181b" stroke-width="1.5"/>
        <circle cx="56" cy="57" r="2.5" fill="#18181b"/>
        <polygon points="84,52 74,58 82,60" fill="#facc15" stroke="#18181b" stroke-width="1.5"/>
        <circle cx="80" cy="57" r="2.5" fill="#18181b"/>
        <polygon points="60,76 63,84 66,76" fill="#ffffff" stroke="#18181b" stroke-width="1.5"/>
        <polygon points="70,76 73,84 76,76" fill="#ffffff" stroke="#18181b" stroke-width="1.5"/>
      </svg>
    `;
  }

  // 裏拳
  if (pose === 'uraken') {
    return `
      <svg class="companion-svg" viewBox="0 0 150 210" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 74 Q30 56 62 52" fill="none" stroke="#581c87" stroke-width="2.5" opacity="0.45" stroke-linecap="round"/>
        <path d="M105 130 Q145 110 148 68 Q125 80 108 116 Z" fill="#475569" stroke="#1e293b" stroke-width="3.5"/>
        <path d="M52 144 L44 194 L62 196 L68 150" fill="#ffffff" stroke="#18181b" stroke-width="3.8"/>
        <path d="M82 144 L92 194 L74 196 L68 150" fill="#ffffff" stroke="#18181b" stroke-width="3.8"/>
        <ellipse cx="50" cy="196" rx="10" ry="6" fill="#475569" stroke="#18181b" stroke-width="3"/>
        <ellipse cx="88" cy="196" rx="10" ry="6" fill="#475569" stroke="#18181b" stroke-width="3"/>
        <path d="M46 94 L98 94 L90 150 L52 150 Z" fill="#ffffff" stroke="#18181b" stroke-width="3.8"/>
        <rect x="46" y="132" width="46" height="11" fill="#0f172a" rx="2"/>
        <!-- 豪快な裏拳スイング -->
        <circle cx="12" cy="74" r="12" fill="#475569" stroke="#18181b" stroke-width="3.5"/>
        <polygon points="46,38 34,10 56,22" fill="#475569" stroke="#18181b" stroke-width="3"/>
        <polygon points="48,34 38,15 54,24" fill="#f472b6"/>
        <polygon points="86,38 98,10 76,22" fill="#475569" stroke="#18181b" stroke-width="3"/>
        <polygon points="84,34 94,15 78,24" fill="#f472b6"/>
        <rect x="36" y="34" width="62" height="8" fill="#ffffff" stroke="#18181b" stroke-width="2.5" rx="1"/>
        <circle cx="68" cy="58" r="28" fill="#475569" stroke="#18181b" stroke-width="3.8"/>
        <ellipse cx="68" cy="68" rx="17" ry="13" fill="#f1f5f9" stroke="#18181b" stroke-width="2.5"/>
        <polygon points="68,60 62,66 74,66" fill="#18181b"/>
        <polygon points="52,48 62,54 54,56" fill="#facc15" stroke="#18181b" stroke-width="1.5"/>
        <circle cx="56" cy="53" r="2.5" fill="#18181b"/>
        <polygon points="84,48 74,54 82,56" fill="#facc15" stroke="#18181b" stroke-width="1.5"/>
        <circle cx="80" cy="53" r="2.5" fill="#18181b"/>
      </svg>
    `;
  }

  // 回し蹴り
  if (pose === 'mawashi_geri') {
    return `
      <svg class="companion-svg" viewBox="0 0 150 210" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 44 Q40 18 78 20" fill="none" stroke="#c2410c" stroke-width="2.5" opacity="0.45" stroke-linecap="round"/>
        <!-- 豪快に回転する尻尾 -->
        <path d="M102 120 Q142 80 120 40 Q105 70 95 106 Z" fill="#475569" stroke="#1e293b" stroke-width="3.5"/>
        <!-- 軸足 -->
        <path d="M80 144 L88 194 L70 196 L65 150" fill="#ffffff" stroke="#18181b" stroke-width="3.8"/>
        <ellipse cx="84" cy="196" rx="10" ry="6" fill="#475569" stroke="#18181b" stroke-width="3"/>
        <path d="M50 94 L102 94 L92 150 L56 150 Z" fill="#ffffff" stroke="#18181b" stroke-width="3.8"/>
        <rect x="50" y="132" width="46" height="11" fill="#0f172a" rx="2"/>
        <!-- 狼の強烈な回し蹴り足 -->
        <path d="M58 136 L28 92 L12 54 L28 48 L52 82 L76 128" fill="#ffffff" stroke="#18181b" stroke-width="3.8"/>
        <ellipse cx="14" cy="52" rx="11" ry="7" fill="#475569" stroke="#18181b" stroke-width="3.5"/>
        <polygon points="48,38 36,10 58,22" fill="#475569" stroke="#18181b" stroke-width="3"/>
        <polygon points="88,38 100,10 78,22" fill="#475569" stroke="#18181b" stroke-width="3"/>
        <rect x="38" y="34" width="62" height="8" fill="#ffffff" stroke="#18181b" stroke-width="2.5" rx="1"/>
        <circle cx="70" cy="58" r="28" fill="#475569" stroke="#18181b" stroke-width="3.8"/>
        <ellipse cx="70" cy="68" rx="17" ry="13" fill="#f1f5f9" stroke="#18181b" stroke-width="2.5"/>
        <polygon points="70,60 64,66 76,66" fill="#18181b"/>
        <circle cx="58" cy="53" r="2.5" fill="#18181b"/>
        <circle cx="82" cy="53" r="2.5" fill="#18181b"/>
      </svg>
    `;
  }

  // 上蹴り
  if (pose === 'kick' || pose === 'age_geri') {
    return `
      <svg class="companion-svg" viewBox="0 0 150 210" xmlns="http://www.w3.org/2000/svg">
        <path d="M24 64 Q40 36 56 26" fill="none" stroke="#047857" stroke-width="2" opacity="0.45" stroke-linecap="round"/>
        <path d="M105 130 Q145 125 142 85 Q125 90 108 116 Z" fill="#475569" stroke="#1e293b" stroke-width="3.5"/>
        <path d="M82 144 L92 194 L74 196 L68 150" fill="#ffffff" stroke="#18181b" stroke-width="3.8"/>
        <ellipse cx="88" cy="196" rx="10" ry="6" fill="#475569" stroke="#18181b" stroke-width="3"/>
        <path d="M48 94 L100 94 L90 150 L54 150 Z" fill="#ffffff" stroke="#18181b" stroke-width="3.8"/>
        <rect x="48" y="132" width="46" height="11" fill="#0f172a" rx="2"/>
        <!-- 天を突く上蹴り足 -->
        <path d="M58 136 L30 76 L44 64 L76 126" fill="#ffffff" stroke="#18181b" stroke-width="3.8"/>
        <ellipse cx="28" cy="70" rx="8" ry="12" fill="#475569" stroke="#18181b" stroke-width="3.5"/>
        <polygon points="46,38 34,10 56,22" fill="#475569" stroke="#18181b" stroke-width="3"/>
        <polygon points="86,38 98,10 76,22" fill="#475569" stroke="#18181b" stroke-width="3"/>
        <rect x="36" y="34" width="62" height="8" fill="#ffffff" stroke="#18181b" stroke-width="2.5" rx="1"/>
        <circle cx="68" cy="58" r="28" fill="#475569" stroke="#18181b" stroke-width="3.8"/>
        <ellipse cx="68" cy="68" rx="17" ry="13" fill="#f1f5f9" stroke="#18181b" stroke-width="2.5"/>
        <polygon points="68,60 62,66 74,66" fill="#18181b"/>
        <circle cx="56" cy="53" r="2.5" fill="#18181b"/>
        <circle cx="80" cy="53" r="2.5" fill="#18181b"/>
      </svg>
    `;
  }

  // ずっこけ（尻尾を踏んでワオーンと転倒）
  if (pose === 'zukkoke') {
    return `
      <svg class="companion-svg" viewBox="0 0 150 210" xmlns="http://www.w3.org/2000/svg">
        <path d="M110 38 Q118 42 114 50 Q106 48 110 38 Z" fill="#38bdf8"/>
        <!-- 足がもつれて転倒 -->
        <path d="M42 142 L22 184 L40 188 L60 148" fill="#ffffff" stroke="#18181b" stroke-width="3.8"/>
        <path d="M72 142 L88 174 L114 180 L96 144" fill="#ffffff" stroke="#18181b" stroke-width="3.8"/>
        <ellipse cx="24" cy="184" rx="10" ry="6" fill="#475569" stroke="#18181b" stroke-width="3"/>
        <ellipse cx="108" cy="178" rx="10" ry="6" fill="#475569" stroke="#18181b" stroke-width="3"/>
        <path d="M44 98 L96 98 L86 150 L48 150 Z" fill="#ffffff" stroke="#18181b" stroke-width="3.8"/>
        <rect x="44" y="134" width="46" height="11" fill="#0f172a" rx="2"/>
        <polygon points="46,38 34,10 56,22" fill="#475569" stroke="#18181b" stroke-width="3"/>
        <polygon points="86,38 98,10 76,22" fill="#475569" stroke="#18181b" stroke-width="3"/>
        <circle cx="68" cy="58" r="28" fill="#475569" stroke="#18181b" stroke-width="3.8"/>
        <ellipse cx="68" cy="68" rx="17" ry="13" fill="#f1f5f9" stroke="#18181b" stroke-width="2.5"/>
        <!-- ＸＸのコミカル目 -->
        <text x="50" y="56" font-size="12" font-weight="900" fill="#18181b">X</text>
        <text x="74" y="56" font-size="12" font-weight="900" fill="#18181b">X</text>
        <ellipse cx="68" cy="74" rx="6" ry="7" fill="#18181b"/>
      </svg>
    `;
  }

  // 通常構え (idle)
  return `
    <svg class="companion-svg" viewBox="0 0 150 210" xmlns="http://www.w3.org/2000/svg">
      <!-- ふさふさの狼尻尾 -->
      <path d="M105 130 Q145 125 142 85 Q125 90 108 116 Z" fill="#475569" stroke="#1e293b" stroke-width="3.5"/>
      <!-- 足 -->
      <path d="M52 144 L44 194 L62 196 L68 150" fill="#ffffff" stroke="#18181b" stroke-width="3.8"/>
      <path d="M82 144 L92 194 L74 196 L68 150" fill="#ffffff" stroke="#18181b" stroke-width="3.8"/>
      <ellipse cx="50" cy="196" rx="10" ry="6" fill="#475569" stroke="#18181b" stroke-width="3"/>
      <ellipse cx="88" cy="196" rx="10" ry="6" fill="#475569" stroke="#18181b" stroke-width="3"/>
      <!-- 道着胴体 & 黒帯 -->
      <path d="M46 94 L98 94 L90 150 L52 150 Z" fill="#ffffff" stroke="#18181b" stroke-width="3.8"/>
      <rect x="46" y="132" width="46" height="11" fill="#0f172a" rx="2"/>
      <!-- 両手の構え（ガード） -->
      <circle cx="38" cy="116" r="10.5" fill="#475569" stroke="#18181b" stroke-width="3"/>
      <circle cx="104" cy="116" r="10.5" fill="#475569" stroke="#18181b" stroke-width="3"/>
      <!-- 鋭い爪 -->
      <polygon points="30,110 26,106 31,114" fill="#f8fafc"/>
      <polygon points="112,110 116,106 111,114" fill="#f8fafc"/>
      <!-- 狼の耳 -->
      <polygon points="46,38 34,10 56,22" fill="#475569" stroke="#18181b" stroke-width="3"/>
      <polygon points="48,34 38,15 54,24" fill="#f472b6"/>
      <polygon points="86,38 98,10 76,22" fill="#475569" stroke="#18181b" stroke-width="3"/>
      <polygon points="84,34 94,15 78,24" fill="#f472b6"/>
      <!-- 白ハチマキ -->
      <rect x="36" y="34" width="62" height="8" fill="#ffffff" stroke="#18181b" stroke-width="2.5" rx="1"/>
      <path d="M34 38 L18 30 L22 42 Z" fill="#ffffff" stroke="#18181b" stroke-width="2"/>
      <!-- 頭部 -->
      <circle cx="68" cy="58" r="28" fill="#475569" stroke="#18181b" stroke-width="3.8"/>
      <!-- マズル（白い口元 & 鼻） -->
      <ellipse cx="68" cy="68" rx="17" ry="13" fill="#f1f5f9" stroke="#18181b" stroke-width="2.5"/>
      <polygon points="68,60 62,66 74,66" fill="#18181b"/>
      <!-- 鋭い目 & キバ -->
      <polygon points="52,48 62,54 54,56" fill="#facc15" stroke="#18181b" stroke-width="1.5"/>
      <circle cx="56" cy="53" r="2.5" fill="#18181b"/>
      <polygon points="84,48 74,54 82,56" fill="#facc15" stroke="#18181b" stroke-width="1.5"/>
      <circle cx="80" cy="53" r="2.5" fill="#18181b"/>
      <polygon points="60,72 63,80 66,72" fill="#ffffff" stroke="#18181b" stroke-width="1.5"/>
      <polygon points="70,72 73,80 76,72" fill="#ffffff" stroke="#18181b" stroke-width="1.5"/>
    </svg>
  `;
}

function createMonkeySVG(pose = 'idle') {
  return `
    <svg viewBox="0 0 100 150" xmlns="http://www.w3.org/2000/svg" class="companion-svg companion-monkey-svg ${pose}">
      <circle cx="50" cy="50" r="28" fill="#a16207" stroke="#18181b" stroke-width="3"/>
      <ellipse cx="50" cy="55" rx="20" ry="16" fill="#fbcfe8" stroke="#18181b" stroke-width="2"/>
      <circle cx="42" cy="48" r="3.5" fill="#18181b"/>
      <circle cx="58" cy="48" r="3.5" fill="#18181b"/>
      <path d="M44 60 Q50 68 56 60" fill="none" stroke="#18181b" stroke-width="2.5" stroke-linecap="round"/>
      <rect x="25" y="76" width="50" height="48" rx="6" fill="#ffffff" stroke="#18181b" stroke-width="3"/>
      <rect x="25" y="98" width="50" height="8" fill="#18181b"/>
    </svg>
  `;
}

/**
 * 仲間キャラクターSVGディスパッチャー
 */
function createCompanionSVG(companionId, pose = 'idle') {
  switch (companionId) {
    case 'rabbit':
      return createRabbitSVG(pose);
    case 'kintaro':
      return createKintaroSVG(pose);
    case 'turtle':
      return createTurtleSVG(pose);
    case 'red_riding_hood':
      return createRedRidingHoodSVG(pose);
    case 'girl':
      return createGirlKaratekaSVG(pose);
    case 'wolf':
      return createWolfSVG(pose);
    case 'boy_ally':
      return createBoyAllyKaratekaSVG(pose);
    case 'monkey':
      return createMonkeySVG(pose);
    default:
      return '';
  }
}

// ============================================================================
// 4. 空手技の幾何形状解析アルゴリズム（Stroke Karate Move Classification）
// ============================================================================

/**
 * 2つの線分 (p1-p2) と (p3-p4) の交差判定
 */
function checkSegmentsIntersect(p1, p2, p3, p4) {
  function ccw(a, b, c) {
    return (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0]);
  }
  return (ccw(p1, p3, p4) !== ccw(p2, p3, p4)) && (ccw(p1, p2, p3) !== ccw(p1, p2, p4));
}

/**
 * 点列の自己交差（ループ・クロス）検出
 */
function detectStrokeSelfIntersection(pts) {
  if (!pts || pts.length < 4) return false;
  const step = Math.max(1, Math.floor(pts.length / 32));
  const sampled = [];
  for (let i = 0; i < pts.length; i += step) sampled.push(pts[i]);
  if (sampled[sampled.length - 1] !== pts[pts.length - 1]) sampled.push(pts[pts.length - 1]);

  for (let i = 0; i < sampled.length - 1; i++) {
    for (let j = i + 2; j < sampled.length - 1; j++) {
      if (Math.abs(i - j) <= 1) continue;
      if (checkSegmentsIntersect(sampled[i], sampled[i + 1], sampled[j], sampled[j + 1])) {
        return true;
      }
    }
  }
  return false;
}

/**
 * 終端が上方向を向いているか判定（ハネ・上向きの反転検出）
 */
function detectStrokeUpwardEnd(pts) {
  if (!pts || pts.length < 3) return false;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let maxIdx = 0;
  for (let i = 0; i < pts.length; i++) {
    if (pts[i][0] < minX) minX = pts[i][0];
    if (pts[i][0] > maxX) maxX = pts[i][0];
    if (pts[i][1] < minY) minY = pts[i][1];
    if (pts[i][1] > maxY) {
      maxY = pts[i][1];
      maxIdx = i;
    }
  }
  const spanX = maxX - minX;
  const spanY = maxY - minY;

  // 横一文字の線（まの1/2画目、あ1画目など）は上向きハネではない
  if (spanX > spanY * 1.5) {
    return false;
  }

  const endPt = pts[pts.length - 1];
  const reboundY = maxY - endPt[1];

  // 最下点から終端への明らかな反転・跳ね上がり (3.8px以上上に戻る)
  if (reboundY >= 3.8 && maxIdx < pts.length - 1) {
    return true;
  }

  // 末尾ベクトルの上向き成分チェック
  const tailIdx = Math.max(0, pts.length - Math.min(6, Math.floor(pts.length * 0.25)));
  const tailStart = pts[tailIdx];
  const tailDy = endPt[1] - tailStart[1];
  if (tailDy < -3.5 && spanY > 15) {
    return true;
  }

  return false;
}

/**
 * 縦（下方向）に伸びるか判定
 */
function detectStrokeVerticalDown(pts) {
  if (!pts || pts.length < 2) return false;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p[0] < minX) minX = p[0];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const startPt = pts[0];
  const endPt = pts[pts.length - 1];
  const netDy = endPt[1] - startPt[1];

  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }

  // 短い点（か3画目など len < 35, spanY < 28）や長大なジグザグ（そなど len > 120）は除外
  if (spanY < 28 || netDy < 25 || len < 35 || len > 120) return false;

  // 下向きに伸び、縦の広がりが横より大きい（ハネや自己交差がない純粋な縦線）
  return (spanY >= spanX * 1.15 && !detectStrokeUpwardEnd(pts) && !detectStrokeSelfIntersection(pts));
}

/**
 * ストロークの出来栄えスコアとお手本座標点列の幾何形状に応じた空手技の判定
 * 
 * @param {Array<[number, number]>} pts お手本の座標点列
 * @param {number} score 出来栄え得点 (0〜100)
 * @returns {{id: string, name: string, pattern: number, patternLabel: string, desc: string}}
 */
export function classifyKarateStroke(pts, score = 100) {
  // スコア30点未満の場合：技が出ない（ずっこける）
  if (score < 30) {
    return {
      id: 'zukkoke',
      name: 'ずっこけ',
      pattern: 0,
      patternLabel: '技不発',
      desc: 'スコア30点未満'
    };
  }

  if (!pts || pts.length < 2) {
    return {
      id: 'seiken_zuki',
      name: '正拳突き',
      pattern: 5,
      patternLabel: 'パターン5',
      desc: '基本打撃'
    };
  }

  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }

  const selfCross = detectStrokeSelfIntersection(pts);
  const upward = detectStrokeUpwardEnd(pts);
  const vertDown = detectStrokeVerticalDown(pts);

  // 1) 縦（下方向）に伸びる場合（例：「い」2画目、「た」2画目、「か」2画目）
  if (vertDown) {
    return {
      id: 'shitazuki',
      name: '下突き',
      pattern: 1,
      patternLabel: 'パターン1',
      desc: '縦・下方向'
    };
  }

  // 2) 交差せず長い場合（例：「ひ」1画目 len=237、「え」2画目 len=191、「そ」1画目 len=253）
  if (!selfCross && len >= 170) {
    return {
      id: 'uraken',
      name: '裏拳',
      pattern: 2,
      patternLabel: 'パターン2',
      desc: '交差せず長い'
    };
  }

  // 3) 交差して長い場合（例：「あ」3画目 len=198、「お」2画目 len=225、「す」2画目 len=147）
  if (selfCross && len >= 135) {
    return {
      id: 'mawashi_geri',
      name: '回し蹴り',
      pattern: 3,
      patternLabel: 'パターン3',
      desc: '交差して長い'
    };
  }

  // 4) 終わりが上方向を向いている場合（例：「も」1画目、「し」1画目、「は」1画目、「い」1画目、「か」1画目）
  if (upward) {
    return {
      id: 'age_geri',
      name: '上蹴り',
      pattern: 4,
      patternLabel: 'パターン4',
      desc: '終わりが上向き'
    };
  }

  // 5) 上記いずれにも該当しない場合（例：「あ」1画目、「か」3画目、「こ」1/2画目、「ま」1/2画目）
  return {
    id: 'seiken_zuki',
    name: '正拳突き',
    pattern: 5,
    patternLabel: 'パターン5',
    desc: '通常・基本'
  };
}

// ============================================================================
// 4. ストローク類似度判定アルゴリズム (Polyline Similarity Evaluation)
// ============================================================================

/**
 * 点列のリサンプリング（等間隔にN点を抽出）
 */
function resamplePolyline(points, n = 32) {
  if (!points || points.length === 0) return [];
  if (points.length === 1) return Array(n).fill(points[0]);

  // 全長を計算
  const distances = [0];
  let totalLength = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0];
    const dy = points[i][1] - points[i - 1][1];
    totalLength += Math.hypot(dx, dy);
    distances.push(totalLength);
  }

  if (totalLength === 0) return Array(n).fill(points[0]);

  const step = totalLength / (n - 1);
  const resampled = [points[0]];

  let currentDist = 0;
  let segIdx = 0;

  for (let i = 1; i < n - 1; i++) {
    currentDist += step;
    while (segIdx < distances.length - 1 && distances[segIdx + 1] < currentDist) {
      segIdx++;
    }
    const dStart = distances[segIdx];
    const dEnd = distances[segIdx + 1];
    const segLen = dEnd - dStart;
    const t = segLen > 0 ? (currentDist - dStart) / segLen : 0;

    const p0 = points[segIdx];
    const p1 = points[segIdx + 1] || p0;
    resampled.push([
      p0[0] + (p1[0] - p0[0]) * t,
      p0[1] + (p1[1] - p0[1]) * t
    ]);
  }

  resampled.push(points[points.length - 1]);
  return resampled;
}

// 清音（標準ひらがな46文字）の定義
export const SEION_CHARS = new Set([
  "あ","い","う","え","お",
  "か","き","く","け","こ",
  "さ","し","す","せ","そ",
  "た","ち","つ","て","と",
  "な","に","ぬ","ね","の",
  "は","ひ","ふ","へ","ほ",
  "ま","み","む","め","も",
  "や","ゆ","よ",
  "ら","り","る","れ","ろ",
  "わ","を","ん"
]);

/**
 * ユーザーの描いたストロークと正解ストロークの類似度スコア（0〜100押忍）を算出
 * スマホでの指描き・タッチ操作に配慮した寛容で優しい採点設計
 * 半濁点「゜」（丸）等の閉ループストロークは、時計回り・反時計回りのどちらで描いても公平に同一基準で採点
 * @param {Array<[number, number]>} userPoints ユーザーの座標点列 (0..109空間)
 * @param {Array<[number, number]>} targetPoints お手本の座標点列 (0..109空間)
 * @returns {{ score: number, details: Object }}
 */
export function evaluateStroke(userPoints, targetPoints, diff = DIFFICULTY_PRESETS.normal, customTolerance = DIFFICULTY_PRESETS.normal.tolerance) {
  if (!userPoints || userPoints.length < 2 || !targetPoints || targetPoints.length < 2) {
    return { score: diff.minScore, reason: "みじかすぎるよ" };
  }

  const targetStart = targetPoints[0];
  const targetEnd = targetPoints[targetPoints.length - 1];

  // 閉ループ（半濁点゜の丸など）の判定：始点と終点が一致または至近距離にあるストローク
  const strokeEndpointDist = Math.hypot(targetStart[0] - targetEnd[0], targetStart[1] - targetEnd[1]);
  const isClosedLoop = targetPoints.length >= 8 && strokeEndpointDist < 5.0;

  if (isClosedLoop) {
    // 半濁点「゜」などの閉ループ図形：
    // 時計回り・反時計回りのどちら回りで描いても、また円のどの位置（上・下・左右）から
    // 描き始めた場合でも、形状の幾何品質に基づき公平に同等スコアとなるよう位相アライメント＆両方向評価を実施
    const ring = targetPoints.slice(0, targetPoints.length - 1);
    let bestIdx = 0;
    let bestDist = Infinity;
    const userStart = userPoints[0];
    for (let i = 0; i < ring.length; i++) {
      const d = Math.hypot(ring[i][0] - userStart[0], ring[i][1] - userStart[1]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }

    // 時計回り（CW）候補パスの生成
    const rotCW = [...ring.slice(bestIdx), ...ring.slice(0, bestIdx), ring[bestIdx]];

    // 反時計回り（CCW）候補パスの生成
    const rotCCW = [ring[bestIdx]];
    for (let step = 1; step < ring.length; step++) {
      const idx = (bestIdx - step + ring.length) % ring.length;
      rotCCW.push(ring[idx]);
    }
    rotCCW.push(ring[bestIdx]);

    // 両方向で評価を実施
    const evalCW = evaluateSingleStroke(userPoints, rotCW, diff, customTolerance);
    const evalCCW = evaluateSingleStroke(userPoints, rotCCW, diff, customTolerance);

    // より高得点の方（同点の場合は平均幾何誤差が小さい方）を採用
    if (evalCW.score > evalCCW.score) {
      return evalCW;
    } else if (evalCCW.score > evalCW.score) {
      return evalCCW;
    } else {
      return evalCW.avgError <= evalCCW.avgError ? evalCW : evalCCW;
    }
  }

  // 通常のストローク（開曲線）
  // 1. 始点と終点の方向チェック（逆向きになぞっていないか）
  const userStart = userPoints[0];
  const userEnd = userPoints[userPoints.length - 1];

  const distStartToStart = Math.hypot(userStart[0] - targetStart[0], userStart[1] - targetStart[1]);
  const distStartToEnd = Math.hypot(userStart[0] - targetEnd[0], userStart[1] - targetEnd[1]);
  const distEndToStart = Math.hypot(userEnd[0] - targetStart[0], userEnd[1] - targetStart[1]);

  // ストロークの直線距離（短い点・はね等は逆向き誤判定を防止）
  const strokeLen = strokeEndpointDist;

  // 明確に逆向きに引かれた場合のみ警告
  const isReversed = strokeLen > 18 && (distStartToEnd < 16) && (distEndToStart < 16) && (distStartToStart > 22);
  if (isReversed) {
    return {
      score: Math.max(diff.minScore, 40),
      isReversed: true,
      reason: "ぎゃくむき 押忍！"
    };
  }

  return evaluateSingleStroke(userPoints, targetPoints, diff, customTolerance);
}

/**
 * 単一方向パスに対する幾何誤差・スコア算出サブルーチン
 */
function evaluateSingleStroke(userPoints, targetPoints, diff, customTolerance) {
  const userStart = userPoints[0];
  const userEnd = userPoints[userPoints.length - 1];
  const targetStart = targetPoints[0];
  const targetEnd = targetPoints[targetPoints.length - 1];

  const distStartToStart = Math.hypot(userStart[0] - targetStart[0], userStart[1] - targetStart[1]);
  const distEndToEnd = Math.hypot(userEnd[0] - targetEnd[0], userEnd[1] - targetEnd[1]);
  const strokeLen = Math.hypot(targetStart[0] - targetEnd[0], targetStart[1] - targetEnd[1]);

  // 2. 両者を等間隔にリサンプリング
  const N = 32;
  const sampledUser = resamplePolyline(userPoints, N);
  const sampledTarget = resamplePolyline(targetPoints, N);

  // 3. 点対点の平均ユークリッド距離
  let totalError = 0;
  let maxError = 0;
  for (let i = 0; i < N; i++) {
    const err = Math.hypot(
      sampledUser[i][0] - sampledTarget[i][0],
      sampledUser[i][1] - sampledTarget[i][1]
    );
    totalError += err;
    if (err > maxError) maxError = err;
  }
  const avgError = totalError / N;

  // 4. 始点・終点の一致精度
  const startError = distStartToStart;
  const endError = distEndToEnd;

  // 5. 設定難易度と許容誤差（スライダー）による判定計算
  let tol = customTolerance !== undefined && customTolerance !== null ? customTolerance : diff.tolerance;
  // 濁点・半濁点機能：短いストローク（濁点゛の点、半濁点゜の丸等）の許容度ボーナス
  if (DAKUTEN_FEATURE_CONFIG.enabled && strokeLen < 16) {
    tol = Math.max(tol, tol * DAKUTEN_FEATURE_CONFIG.shortStrokeToleranceBonus);
  }
  const effectiveAvg = Math.max(0, avgError - tol);
  const effectiveStart = Math.max(0, startError - (tol > 0 ? tol * 1.2 : 0));
  const effectiveEnd = Math.max(0, endError - (tol > 0 ? tol * 1.2 : 0));
  const effectiveMax = Math.max(0, maxError - (tol > 0 ? tol * 1.8 : 0));

  const startWeight = diff.startPenalty !== undefined ? diff.startPenalty : 0.4;
  const endWeight = diff.endPenalty !== undefined ? diff.endPenalty : 0.35;
  const maxWeight = diff.maxPenalty !== undefined ? diff.maxPenalty : 0.2;

  const penalty = (effectiveAvg * diff.penaltyMult) +
                  (effectiveStart * startWeight) +
                  (effectiveEnd * endWeight) +
                  (effectiveMax * maxWeight);
  let score = Math.round(100 - penalty);

  // 難易度ごとの最低保証スコア
  score = Math.max(diff.minScore, Math.min(100, score));

  return {
    score,
    avgError,
    startError,
    endError,
    isReversed: false
  };
}

// ============================================================================
// 5. ゲームメインクラス（状態管理 & UIバインディング）
// ============================================================================

export class KakijunOsuGame {
  constructor() {
    this.strokeData = null;       // hiragana_strokes.jsonの辞書データ
    this.hiraganaList = [];       // 全出題可能文字一覧
    this.availableHiraganaList = []; // 現在のフィルター（清音のみ / 全文字）一覧
    this.includeDakutenAndSmall = DAKUTEN_FEATURE_CONFIG.enabled && DAKUTEN_FEATURE_CONFIG.defaultIncludeInQuiz; // 濁点・半濁点の出題設定
    this.currentQuestionIndex = 0;// 現在の問題番号 (0..9)
    this.totalScore = 0;          // 累計スコア（押忍）
    this.currentWord = "";        // 現在出題中の文字列（最大5文字）
    this.currentCharIndexInWord = 0; // 単語内の現在書いている文字位置 (0-indexed)
    this.wordCharScores = [];     // 単語を構成する各文字の出来栄え得点配列 (0〜100)
    this.currentCharStrokeScores = []; // 現在の文字の各ストローク判定点数配列 (0〜100)
    this.currentChar = "";        // 現在出題中の文字
    this.currentStrokeIndex = 0;  // 現在なぞるべきストローク番号 (0-indexed)
    this.currentStrokes = [];     // 現在の文字のストローク情報配列
    this.isDrawing = false;
    this.userCurrentStrokePoints = []; // 現在描画中の座標列 (SVG座標系)
    this.userCompletedStrokes = [];    // 描画済みストローク配列 (描画保持用)
    this.svgDocCache = {};             // SVGテキストキャッシュ
    this.debugMode = false;            // 座標点列青線デバッグモード
    this.currentDifficulty = 'normal'; // 難易度設定（初期プリセット: ふつう）
    this.customTolerance = DIFFICULTY_PRESETS.normal.tolerance; // 許容誤差スライダー値 (初期値: ふつう 1.0)
    this.currentQuestionScore = 0;     // 現在の問題で獲得したスコア
    this.isInputBlocked = true;        // アニメーション中・文字遷移中の入力制御フラグ（誤検知防止）
    this.strokeComboCount = 0;         // 高判定の連続ストロークコンボ数（格闘ゲーム風コンボ演出用）
    this.lastComboMilestoneReached = 0; // 直近で発動したコンボ節目（5, 10, 15, 20, 30, 40）
    this.comboMilestoneTimer = null;
    this.unlockedCompanions = new Set(); // 画面上に解放済みの仲間キャラクターIDセット
    this.usedWordsInGame = new Set();  // 同一ゲーム内での単語重複防止セット
    this.recentWordsHistory = [];      // 直近ゲームをまたいだ重複抑制履歴
    this.lastSelectedWord = "";        // 直前に出題した単語（2回連続出題の完全防止）
    this.lastAnnouncedBeltName = GAME_CONFIG.beltRanks[0].name; // 帯昇段検知用
    this.lastAnnouncedBeltMinScore = GAME_CONFIG.beltRanks[0].minScore;
    this.promotionCutinTimer = null;
    this.shojiBlowAwayTimer = null;
    this.leaderboardEntries = [];
    this.lastLeaderboardEntryId = null;

    // DOM要素
    this.dom = {};
  }

  // 背景での入力制御（アニメーション中や文字遷移中の誤検知防止・中央ストローク領域のグレーアウト連動）
  setInputBlocked(blocked) {
    this.isInputBlocked = blocked;
    if (this.dom.canvas) {
      this.dom.canvas.style.pointerEvents = blocked ? 'none' : 'auto';
    }
    if (this.dom.canvasArena) {
      this.dom.canvasArena.classList.toggle('input-blocked', blocked);
    }
  }

  async init() {
    this.bindDOM();
    this.setKarateBoyPose('idle');
    this.setInputBlocked(true); // 初期ロード中・出題アニメーション中はグレーアウト
    sounds.init(); // 少年ボイス音声（AudioBuffer）の事前プリロードを即時開始
    this.initCanvas();
    this.bindEvents();
    this.restoreProgress();
    this.updateScoreDisplay({ announcePromotion: false });
    this.updateCompanionsVisibility(false); // 初期表示時は煙アニメーション無しで復元表示
    this.initServiceWorker();
    this.initPWAInstall();

    // データの読み込み
    await this.loadHiraganaData();

    // タイトル画面を表示（「かいし！」ボタンでゲーム開始）
    if (this.dom.titleScreen) {
      this.dom.titleScreen.classList.remove('hidden', 'fade-out');
    }
  }

  bindDOM() {
    // ゲームタイトル画面
    this.dom.titleScreen = document.getElementById('title-screen');
    this.dom.titleLeaderboardList = document.getElementById('title-leaderboard-list');
    this.dom.transitionCurtain = document.getElementById('screen-transition-curtain');
    this.dom.btnStartGame = document.getElementById('btn-start-game');
    this.dom.btnReturnTitle = document.getElementById('btn-return-title');
    this.dom.btnSettingsToTitle = document.getElementById('btn-settings-to-title');

    this.dom.questionLabel = document.getElementById('question-label');
    this.dom.scoreNumber = document.getElementById('score-number');
    this.dom.beltBadge = document.getElementById('belt-badge');
    this.dom.beltColorBar = document.getElementById('belt-color-bar');
    this.dom.beltName = document.getElementById('belt-name');
    
    this.dom.wordBoardRow = document.getElementById('word-board-row');
    this.dom.canvasArena = document.getElementById('canvas-arena');
    this.dom.watermarkContainer = document.getElementById('watermark-container');
    this.dom.strokeNumbersOverlay = document.getElementById('stroke-numbers-overlay');
    this.dom.canvas = document.getElementById('drawing-canvas');
    this.dom.ctx = this.dom.canvas.getContext('2d');

    this.dom.evaluationToast = document.getElementById('evaluation-toast');
    this.dom.toastText = document.getElementById('toast-text');
    this.dom.actionEffectBubble = document.getElementById('action-effect-bubble');

    this.dom.characterStage = document.querySelector('.character-stage');
    this.dom.karateBoyContainer = document.getElementById('karate-boy-container');
    this.dom.dojoEnvBackdrop = document.getElementById('dojo-env-backdrop');
    this.dom.dojoMoon = document.getElementById('dojo-moon');
    this.dom.dojoShojiWindParticles = document.getElementById('dojo-shoji-wind-particles');
    this.dom.dojoSpiritBackdrop = document.getElementById('dojo-spirit-backdrop');
    this.dom.dojoAuraCanvas = document.getElementById('dojo-aura-canvas');
    this.dom.comboMilestoneBanner = document.getElementById('combo-milestone-banner');
    this.dom.appContainer = document.getElementById('app-container');
    this.dom.promotionOverlay = document.getElementById('promotion-cutin-overlay');
    this.dom.promotionInkParticles = document.getElementById('promotion-ink-particles');
    this.dom.promotionBeltStripe = document.getElementById('promotion-belt-stripe');
    this.dom.promotionBeltBanner = document.getElementById('promotion-belt-banner');
    this.dom.promotionBeltSwatch = document.getElementById('promotion-belt-swatch');
    this.dom.promotionBeltName = document.getElementById('promotion-belt-name');
    this.dom.actionDebugBadge = document.getElementById('action-debug-badge');

    // 道場全体の和風闘気パーティクルエンジン初期化
    this.dojoAura = new DojoAuraParticleEngine(
      this.dom.dojoAuraCanvas,
      this.dom.appContainer,
      this.dom.canvasArena,
      this.dom.karateBoyContainer
    );

    // 盛り上げ役仲間キャラクターコンテナ
    this.dom.companions = {
      rabbit: document.getElementById('companion-rabbit'),
      kintaro: document.getElementById('companion-kintaro'),
      turtle: document.getElementById('companion-turtle'),
      red_riding_hood: document.getElementById('companion-red_riding_hood'),
      girl: document.getElementById('companion-girl'),
      wolf: document.getElementById('companion-wolf'),
      boy_ally: document.getElementById('companion-boy_ally'),
      monkey: document.getElementById('companion-monkey')
    };

    // セッション別仲間解放計画 & スロット割り当ての初期化
    this.setupCompanionSessionPlan();
    
    this.dom.btnRetry = document.getElementById('btn-retry');
    this.dom.btnSettings = document.getElementById('btn-settings');
    this.dom.btnSound = document.getElementById('btn-sound');
    this.dom.btnInstall = document.getElementById('btn-install');

    // 設定モーダル（漢字使用OK）
    this.dom.settingsModal = document.getElementById('settings-modal');
    this.dom.btnCloseSettings = document.getElementById('btn-close-settings');
    this.dom.btnSaveSettings = document.getElementById('btn-save-settings');
    this.dom.diffBtns = document.querySelectorAll('.diff-btn');
    this.dom.diffDescription = document.getElementById('diff-description');
    this.dom.settingSound = document.getElementById('setting-sound');
    this.dom.settingDebug = document.getElementById('setting-debug');

    // リザルトモーダル
    this.dom.resultModal = document.getElementById('result-modal');
    this.dom.finalScoreNumber = document.getElementById('final-score-number');
    this.dom.bestScoreNumber = document.getElementById('best-score-number');
    this.dom.finalBeltBadge = document.getElementById('final-belt-badge');
    this.dom.finalBeltColorBar = document.getElementById('final-belt-color-bar');
    this.dom.finalBeltName = document.getElementById('final-belt-name');
    this.dom.btnRestart = document.getElementById('btn-restart');
    this.dom.resultQuestionsList = document.getElementById('result-questions-list');
    this.dom.offlineBanner = document.getElementById('offline-banner');
  }

  /**
   * 2列目から5列目までのキャラクターを縦方向に均等配置
   * 画面・端末サイズ（スマホ〜タブレット）ごとに異なるステージ領域の高さを動的に計測し、
   * 青丸領域の広い空間を上方向へ積極的に活用して等間隔で綺麗に並ぶようCSSカスタムプロパティを更新
   */
  updateCharacterStageVerticalLayout() {
    if (!this.dom.characterStage) return;
    const stageH = this.dom.characterStage.clientHeight;
    if (!stageH || stageH <= 0) return;

    const isSmall = window.innerWidth <= 380;
    // 5列目（男の子・女の子）の表示高さ（大画面144px, 小画面120px）
    const row5Height = isSmall ? 120 : 144;
    // 最上段（5列目）の頭頂部がステージ上端（ストローク領域直下）から少し余白（小画面6px, 通常10px）を空けた位置
    const topMargin = isSmall ? 6 : 10;
    // 5列目の底辺位置（青丸領域の広い空間を十分に活かし、ストローク領域直下付近まで引き上げる）
    const maxRow5Bottom = Math.max(isSmall ? 165 : 195, stageH - row5Height - topMargin);

    // 最下段（2列目：ウサギ・カメ）の底位置（主人公の足元付近、小画面14px, 通常16px〜ステージ高の4.5%）
    const minRow2Bottom = isSmall ? 14 : Math.max(16, Math.round(stageH * 0.045));

    // 2列目から5列目までの総スパンを3等分して均等ステップを算出
    const totalSpan = maxRow5Bottom - minRow2Bottom;
    const step = Math.max(28, totalSpan / 3);

    const row2Bottom = Math.round(minRow2Bottom);
    const row3Bottom = Math.round(minRow2Bottom + step);
    const row4Bottom = Math.round(minRow2Bottom + step * 2);
    const row5Bottom = Math.round(maxRow5Bottom);

    this.dom.characterStage.style.setProperty('--row2-bottom', `${row2Bottom}px`);
    this.dom.characterStage.style.setProperty('--row3-bottom', `${row3Bottom}px`);
    this.dom.characterStage.style.setProperty('--row4-bottom', `${row4Bottom}px`);
    this.dom.characterStage.style.setProperty('--row5-bottom', `${row5Bottom}px`);
  }

  // キャンバスのDPI調整 & ステージレイアウトの動的最適化
  initCanvas() {
    const updateSize = () => {
      const rect = this.dom.canvasArena.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.dom.canvas.width = rect.width * dpr;
      this.dom.canvas.height = rect.height * dpr;
      this.dom.canvas.style.width = `${rect.width}px`;
      this.dom.canvas.style.height = `${rect.height}px`;
      this.dom.ctx.scale(dpr, dpr);
      this.redrawCanvas();
      this.updateCharacterStageVerticalLayout();
      if (this.dojoAura) {
        this.dojoAura.resize();
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    window.addEventListener('orientationchange', () => {
      setTimeout(updateSize, 100);
    });

    if (window.ResizeObserver && this.dom.characterStage) {
      const ro = new ResizeObserver(() => {
        this.updateCharacterStageVerticalLayout();
        if (this.dojoAura) {
          this.dojoAura.resize();
        }
      });
      ro.observe(this.dom.characterStage);
    }
  }

  bindEvents() {
    // iOS Safari / 各ブラウザ向けオーディオ即時アンロック
    const unlockHandler = () => {
      sounds.unlockAudioContext();
    };
    window.addEventListener('pointerdown', unlockHandler, { passive: true, once: true });
    window.addEventListener('touchstart', unlockHandler, { passive: true, once: true });

    // 描画イベント（PointerEventでスマホ・PC統一）
    const canvas = this.dom.canvas;

    const startDraw = (e) => {
      if (this.isInputBlocked) return;
      e.preventDefault();
      sounds.unlockAudioContext();
      this.isDrawing = true;
      if (this.dojoAura) {
        this.dojoAura.resetTraceCursor();
      }
      const pt = this.getCanvasPoint(e);
      this.userCurrentStrokePoints = [pt];
      this.redrawCanvas();
    };

    const moveDraw = (e) => {
      if (this.isInputBlocked || !this.isDrawing) return;
      e.preventDefault();
      const pt = this.getCanvasPoint(e);
      const last = this.userCurrentStrokePoints[this.userCurrentStrokePoints.length - 1];
      // 微小移動のノイズ除去
      if (!last || Math.hypot(pt[0] - last[0], pt[1] - last[1]) > 0.5) {
        this.userCurrentStrokePoints.push(pt);
        this.redrawCanvas();
        // 闘気発動中（コンボ1以上）は筆跡の動きに火の粉・桜花びらが追従
        if (this.dojoAura && this.strokeComboCount >= 1 && typeof e.clientX === 'number' && typeof e.clientY === 'number') {
          this.dojoAura.emitTraceSpark(e.clientX, e.clientY, this.strokeComboCount);
        }
      }
    };

    const endDraw = (e) => {
      if (!this.isDrawing) return;
      e.preventDefault();
      this.isDrawing = false;
      if (this.dojoAura) {
        this.dojoAura.resetTraceCursor();
      }
      if (this.isInputBlocked) {
        this.userCurrentStrokePoints = [];
        this.redrawCanvas();
        return;
      }
      this.onStrokeComplete();
    };

    canvas.addEventListener('pointerdown', startDraw);
    canvas.addEventListener('pointermove', moveDraw);
    canvas.addEventListener('pointerup', endDraw);
    canvas.addEventListener('pointercancel', endDraw);
    canvas.addEventListener('pointerleave', endDraw);

    // 下部ボタン
    this.dom.btnRetry.addEventListener('click', () => {
      this.resetCurrentCharacter();
    });

    if (this.dom.btnSettings) {
      this.dom.btnSettings.addEventListener('click', () => {
        this.openSettingsModal();
      });
    }

    if (this.dom.btnCloseSettings) {
      this.dom.btnCloseSettings.addEventListener('click', () => {
        this.closeSettingsModal();
      });
    }

    if (this.dom.btnSaveSettings) {
      this.dom.btnSaveSettings.addEventListener('click', () => {
        this.saveSettingsFromModal();
      });
    }

    // 難易度プリセットボタン群
    if (this.dom.diffBtns) {
      this.dom.diffBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const diffKey = btn.dataset.diff;
          if (diffKey && DIFFICULTY_PRESETS[diffKey]) {
            this.currentDifficulty = diffKey;
            const diff = DIFFICULTY_PRESETS[diffKey];
            this.customTolerance = diff.tolerance;
            this.updateDifficultyUI();
          }
        });
      });
    }

    if (this.dom.btnSound) {
      this.dom.btnSound.addEventListener('click', () => {
        sounds.enabled = !sounds.enabled;
        this.dom.btnSound.textContent = sounds.enabled ? 'おと：ON' : 'おと：OFF';
        if (this.dom.settingSound) {
          this.dom.settingSound.checked = sounds.enabled;
        }
        sounds.syncBgmState();
        this.saveProgress();
      });
    }

    // 設定モーダル内の効果音・BGM ON/OFFトグル
    if (this.dom.settingSound) {
      this.dom.settingSound.addEventListener('change', () => {
        sounds.enabled = this.dom.settingSound.checked;
        if (this.dom.btnSound) {
          this.dom.btnSound.textContent = sounds.enabled ? 'おと：ON' : 'おと：OFF';
        }
        if (sounds.enabled) {
          sounds.init();
          sounds.playPunch();
        }
        sounds.syncBgmState();
      });
    }

    if (this.dom.btnRestart) {
      this.dom.btnRestart.addEventListener('click', () => {
        this.dom.resultModal.classList.remove('active');
        this.restartGame();
      });
    }

    // ゲームタイトル画面：「かいし！」ボタンでメインゲームへ遷移
    if (this.dom.btnStartGame) {
      this.dom.btnStartGame.addEventListener('click', () => {
        this.startGameFromTitle();
      });
    }

    // タイトル画面へ戻るボタン（リザルト画面より）
    if (this.dom.btnReturnTitle) {
      this.dom.btnReturnTitle.addEventListener('click', () => {
        this.showTitleScreen();
      });
    }

    // タイトル画面へ戻るボタン（設定モーダルより）
    if (this.dom.btnSettingsToTitle) {
      this.dom.btnSettingsToTitle.addEventListener('click', () => {
        this.closeSettingsModal();
        this.showTitleScreen();
      });
    }

    // オフライン検知
    window.addEventListener('online', () => this.updateOnlineStatus());
    window.addEventListener('offline', () => this.updateOnlineStatus());
    this.updateOnlineStatus();
  }

  // 画面タッチ座標から0..109のSVG正規化座標へ変換
  getCanvasPoint(e) {
    const rect = this.dom.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // 0..109空間へマッピング
    const normX = (x / rect.width) * GAME_CONFIG.canvasCoordinateMax;
    const normY = (y / rect.height) * GAME_CONFIG.canvasCoordinateMax;
    return [normX, normY];
  }

  // 0..109空間から画面ピクセル座標へ変換
  toScreenPoint(normX, normY) {
    const rect = this.dom.canvas.getBoundingClientRect();
    return [
      (normX / GAME_CONFIG.canvasCoordinateMax) * rect.width,
      (normY / GAME_CONFIG.canvasCoordinateMax) * rect.height
    ];
  }

  // 出題文字リストのフィルタリング（清音のみ / 濁点・半濁点含む）
  updateAvailableList() {
    if (!this.strokeData) return;
    const all = Object.keys(this.strokeData);
    const allowDakuten = DAKUTEN_FEATURE_CONFIG.enabled && this.includeDakutenAndSmall;
    if (allowDakuten) {
      this.availableHiraganaList = all;
    } else {
      const seionList = all.filter(c => SEION_CHARS.has(c));
      this.availableHiraganaList = seionList.length > 0 ? seionList : all;
    }
  }

  // ひらがなデータのロード
  async loadHiraganaData() {
    try {
      // 共通ハーネスルール5: 相対パス指定
      const res = await fetch('./hiragana_strokes.json');
      this.strokeData = await res.json();
      this.hiraganaList = Object.keys(this.strokeData);
      this.updateAvailableList();
    } catch (err) {
      console.error('hiragana_strokes.json load error:', err);
      // フォールバック用の基本データ
      this.strokeData = {
        "あ": {
          "hex": "03042",
          "strokes": [
            { "number_pos": [22.5, 35.0], "points": [[31, 33], [72, 30]] },
            { "number_pos": [41.5, 19.0], "points": [[50, 18], [49, 90]] },
            { "number_pos": [57.5, 42.0], "points": [[65, 44], [35, 88], [25, 77], [65, 50], [88, 70], [66, 94]] }
          ]
        }
      };
      this.hiraganaList = ["あ"];
      this.updateAvailableList();
    }
  }

  // 出題・文字遷移に関するすべての非同期タイマーを完全停止（重複出題・非同期競合防止）
  clearAllQuestionTimers() {
    if (this.slideInInputTimer) {
      clearTimeout(this.slideInInputTimer);
      this.slideInInputTimer = null;
    }
    if (this.charBreakTimer) {
      clearTimeout(this.charBreakTimer);
      this.charBreakTimer = null;
    }
    if (this.nextCharTimer) {
      clearTimeout(this.nextCharTimer);
      this.nextCharTimer = null;
    }
    if (this.unblockInputTimer) {
      clearTimeout(this.unblockInputTimer);
      this.unblockInputTimer = null;
    }
    if (this.shihanTimer) {
      clearTimeout(this.shihanTimer);
      this.shihanTimer = null;
    }
    if (this.wordSlideOutTimer) {
      clearTimeout(this.wordSlideOutTimer);
      this.wordSlideOutTimer = null;
    }
    if (this.nextQuestionTimer) {
      clearTimeout(this.nextQuestionTimer);
      this.nextQuestionTimer = null;
    }
    if (this.shojiBlowAwayTimer) {
      clearTimeout(this.shojiBlowAwayTimer);
      this.shojiBlowAwayTimer = null;
    }
  }

  // 問題開始（出題文字列：5文字以内）
  async startQuestion(qIndex, forceWord = null) {
    // 既存のタイマーを全て確実に破棄して前問の非同期処理が混入するのを防止
    this.clearAllQuestionTimers();
    this.setInputBlocked(true);

    this.currentQuestionIndex = qIndex;
    this.currentQuestionScore = 0;
    // 第一問から第十問への経過に応じた道場環境（障子の揺れ・時間帯・月の昇り）を更新
    this.updateDojoEnvironment(qIndex);
    // 第一問から第二問など、問題移行時もコンボ数は途切れず継続
    this.updateFlameAura();

    // 表示更新: 「第一問」〜「第十問」
    const kanjiNum = KANJI_NUMBERS[qIndex] || (qIndex + 1);
    this.dom.questionLabel.textContent = `第${kanjiNum}問`;

    let selectedWord = "";
    if (forceWord && typeof forceWord === 'string' && forceWord.length > 0) {
      selectedWord = forceWord.slice(0, 5);
    } else {
      // 第1問〜第2問: 2文字、第3問〜第4問: 3文字、第5問〜第7問: 4文字、第8問〜第10問: 5文字から選定
      const candidates = getQuizCandidateWordsForQuestion(
        qIndex,
        this.includeDakutenAndSmall,
        this.usedWordsInGame,
        this.recentWordsHistory,
        this.lastSelectedWord || this.currentWord
      );
      const randIndex = Math.floor(Math.random() * candidates.length);
      selectedWord = candidates[randIndex];
    }

    if (selectedWord) {
      this.usedWordsInGame.add(selectedWord);
      this.lastSelectedWord = selectedWord;
      this.recentWordsHistory = [
        ...this.recentWordsHistory.filter(w => w !== selectedWord),
        selectedWord
      ].slice(-24);
    }

    this.currentWord = selectedWord;
    this.currentCharIndexInWord = 0;
    this.wordCharScores = [];
    this.currentQuestionCharHistory = [];

    // 板割りスロットDOMを構築し、画面外右から中央へスライドイン
    this.buildWordBoardSlots(this.currentWord);

    // 単語の1文字目をセットアップ
    await this.loadCharacterInWord(0);

    // 和太鼓の開始合図
    sounds.playTaiko();
    this.saveProgress();

    // 出題文字列が画面中央に到着して静止したタイミング（0.45秒）でベールを解除し入力解放
    this.slideInInputTimer = setTimeout(() => {
      this.setInputBlocked(false);
      this.slideInInputTimer = null;
    }, 450);
  }

  // 出題文字列（最大5文字）の板割りスロットDOMを構築
  buildWordBoardSlots(word) {
    if (!this.dom.wordBoardRow) return;
    this.dom.wordBoardRow.innerHTML = '';
    this.dom.wordBoardRow.classList.remove('slide-in', 'slide-out');

    // 強制リフローによるアニメーションの確実な再実行
    void this.dom.wordBoardRow.offsetWidth;

    for (let i = 0; i < word.length; i++) {
      const slot = document.createElement('div');
      slot.className = `board-slot ${i === 0 ? 'active-slot' : ''}`;
      slot.dataset.slotIndex = i;

      // 各文字の出来栄え点バッジ（文字の上あたりに表示・例: 「75」）
      const scoreBadge = document.createElement('div');
      scoreBadge.className = 'slot-score-badge';
      scoreBadge.dataset.slotIndex = i;
      slot.appendChild(scoreBadge);

      // ユーザー手書き筆跡表示用キャンバス（120x120 高精細）
      const canvas = document.createElement('canvas');
      canvas.className = 'slot-char-canvas';
      canvas.width = 120;
      canvas.height = 120;
      slot.appendChild(canvas);

      // 試割り用木の板（自然木目・節テクスチャ＋打撃フラッシュ＋衝撃波＋亀裂SVG＋上下2分割）
      const wood = document.createElement('div');
      wood.className = 'board-wood';
      wood.style.setProperty('--wood-bg-x', `${(i * 31) % 70 + 15}%`);
      wood.innerHTML = `
        <div class="board-flash"></div>
        <div class="board-shockwave"></div>
        <svg class="board-crack-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M 0 50 L 18 46 L 34 54 L 50 47 L 67 55 L 84 48 L 100 51" fill="none" stroke="#fffbeb" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.95" />
          <path d="M 0 50 L 18 46 L 34 54 L 50 47 L 67 55 L 84 48 L 100 51" fill="none" stroke="#451a03" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M 34 54 L 41 64 M 50 47 L 45 36 M 67 55 L 72 66" fill="none" stroke="#451a03" stroke-width="1.2" stroke-linecap="round" />
        </svg>
        <div class="board-half top-half"></div>
        <div class="board-half bottom-half"></div>
      `;
      slot.appendChild(wood);

      this.dom.wordBoardRow.appendChild(slot);
    }

    // 画面外右から中央へ流れてくるアニメーション開始
    this.dom.wordBoardRow.classList.add('slide-in');
    sounds.playSwoosh();
  }

  // 各文字スロット上部に確定した出来栄え点（例: 「75」）を表示
  showSlotCharScore(slotIndex, score) {
    if (!this.dom.wordBoardRow) return;
    const slot = this.dom.wordBoardRow.querySelector(`[data-slot-index="${slotIndex}"]`);
    if (!slot) return;
    const badge = slot.querySelector('.slot-score-badge');
    if (!badge) return;

    badge.textContent = score.toString();
    badge.className = 'slot-score-badge show';
    if (score === 100) {
      badge.classList.add('perfect');
    } else if (score >= 80) {
      badge.classList.add('high');
    }
  }

  // 問題クリア時：ユーザーが書いた文字列が画面中央から左方向へ逃げるアニメーション（出題時と同じ0.65秒）
  slideOutWordRow() {
    if (!this.dom.wordBoardRow) return;
    this.dom.wordBoardRow.classList.remove('slide-in');
    this.dom.wordBoardRow.classList.add('slide-out');
    sounds.playSwoosh();
  }

  // 単語内の指定文字をメインキャンバスにセットアップ
  async loadCharacterInWord(charIndex) {
    if (charIndex >= this.currentWord.length) return;

    // 前の文字ロードや非同期競合を破棄するためのセッションID
    this.charSessionId = (this.charSessionId || 0) + 1;
    const currentSession = this.charSessionId;

    this.currentCharIndexInWord = charIndex;
    this.currentChar = this.currentWord[charIndex];
    this.currentStrokeIndex = 0;
    this.currentCharStrokeScores = [];
    this.userCompletedStrokes = [];
    this.userCurrentStrokePoints = [];

    // キャンバスとオーバーレイ、透かしコンテナを即座に確実に単一化・完全クリア
    if (this.dom.watermarkContainer) {
      this.dom.watermarkContainer.replaceChildren();
    }
    if (this.dom.strokeNumbersOverlay) {
      this.dom.strokeNumbersOverlay.replaceChildren();
    }
    this.currentStrokes = [];
    this.redrawCanvas();

    // スロットのハイライト更新 & 残留バーストのクリア
    if (this.dom.wordBoardRow) {
      const slots = this.dom.wordBoardRow.querySelectorAll('.board-slot');
      slots.forEach((s, idx) => {
        const oldBurst = s.querySelector('.slot-hit-burst');
        if (oldBurst) oldBurst.remove();
        if (idx === charIndex) {
          s.classList.add('active-slot');
        } else {
          s.classList.remove('active-slot');
        }
      });
    }

    const charInfo = (this.strokeData && this.strokeData[this.currentChar])
      ? this.strokeData[this.currentChar]
      : null;

    if (charInfo) {
      this.currentStrokes = charInfo.strokes;
      await this.renderWatermarkSVG(charInfo.hex, currentSession);
      if (this.charSessionId !== currentSession) return;
      this.renderStrokeNumberTags();
    } else {
      console.warn(`Stroke data missing for character: ${this.currentChar}`);
    }

    if (this.charSessionId !== currentSession) return;

    this.redrawCanvas();
    this.setKarateBoyPose('idle');
    this.updateCharacterStageVerticalLayout();
  }

  // ユーザーが書き終えた文字ストロークをスロット内のミニキャンバスに描画
  renderSlotHandwriting(slotIndex, completedStrokes) {
    if (!this.dom.wordBoardRow) return;
    const slot = this.dom.wordBoardRow.querySelector(`[data-slot-index="${slotIndex}"]`);
    if (!slot) return;
    const canvas = slot.querySelector('.slot-char-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 120, 120);

    const scale = 120 / GAME_CONFIG.canvasCoordinateMax;
    const baseWidth = scale * 8.5;

    for (const stroke of completedStrokes) {
      if (!stroke || stroke.length < 2) continue;
      ctx.save();
      ctx.strokeStyle = '#111111';
      ctx.fillStyle = '#111111';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = baseWidth;

      const screenPts = stroke.map(p => [
        (p[0] / GAME_CONFIG.canvasCoordinateMax) * 120,
        (p[1] / GAME_CONFIG.canvasCoordinateMax) * 120
      ]);

      ctx.beginPath();
      ctx.moveTo(screenPts[0][0], screenPts[0][1]);
      for (let i = 1; i < screenPts.length - 1; i++) {
        const xc = (screenPts[i][0] + screenPts[i + 1][0]) / 2;
        const yc = (screenPts[i][1] + screenPts[i + 1][1]) / 2;
        ctx.quadraticCurveTo(screenPts[i][0], screenPts[i][1], xc, yc);
      }
      ctx.lineTo(screenPts[screenPts.length - 1][0], screenPts[screenPts.length - 1][1]);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 指定スロットの板割りアニメーション（シェイク効果＋木片・紙吹雪パーティクル＋効果音）を発動
  triggerBoardBreak(slotIndex) {
    if (!this.dom.wordBoardRow) return;
    const slot = this.dom.wordBoardRow.querySelector(`[data-slot-index="${slotIndex}"]`);
    if (!slot) return;
    const wood = slot.querySelector('.board-wood');
    if (!wood) return;

    // 1. スロット強シェイク＆ボード列衝撃シェイク効果
    slot.classList.remove('slot-impact-shake', 'board-breaking-shake');
    void slot.offsetWidth;
    slot.classList.add('board-breaking-shake');
    setTimeout(() => slot.classList.remove('board-breaking-shake'), 380);

    const boardSection = this.dom.wordBoardRow.closest('.word-board-section');
    if (boardSection) {
      boardSection.classList.remove('board-row-shake');
      void boardSection.offsetWidth;
      boardSection.classList.add('board-row-shake');
      setTimeout(() => boardSection.classList.remove('board-row-shake'), 340);
    }

    // 2. 板の亀裂・フラッシュ・衝撃波・上下分裂アニメーション発動
    wood.classList.add('breaking');
    sounds.playWoodBreak();
    this.triggerShojiRattle();

    // 3. 木片＆紙吹雪パーティクルを発射
    this.spawnBoardBreakParticles(slot);

    // 板が割れる際、バースト図形も破片とともに素早くフェードアウト
    const burst = slot.querySelector('.slot-hit-burst');
    if (burst) {
      setTimeout(() => {
        burst.classList.add('fade-out');
        setTimeout(() => burst.remove(), 200);
      }, 250);
    }

    setTimeout(() => {
      wood.classList.add('broken');
      slot.classList.add('revealed');
      slot.classList.remove('active-slot');
    }, 560);
  }

  // 第一問〜第十問の経過に応じた道場背景（空の色・障子の開閉と揺れ・昇る月・竹の揺れ）を更新
  updateDojoEnvironment(qIndex) {
    const envEl = this.dom.dojoEnvBackdrop || (typeof document !== 'undefined' ? document.getElementById('dojo-env-backdrop') : null);
    const appEl = this.dom.appContainer || (typeof document !== 'undefined' ? document.getElementById('app-container') : null);
    if (!envEl) return;

    const clamped = Math.max(0, Math.min(DOJO_ENVIRONMENT_CONFIG.length - 1, qIndex || 0));
    const cfg = DOJO_ENVIRONMENT_CONFIG[clamped] || DOJO_ENVIRONMENT_CONFIG[0];

    envEl.classList.remove(
      'env-phase-1', 'env-phase-2', 'env-phase-3', 'env-phase-4', 'env-phase-5',
      'shoji-sway-1', 'shoji-sway-2', 'shoji-sway-3', 'shoji-sway-4',
      'bamboo-sway-1', 'bamboo-sway-2', 'bamboo-sway-3', 'bamboo-sway-4'
    );
    envEl.classList.add(cfg.skyClass);
    if (cfg.shojiSway > 0) {
      envEl.classList.add(`shoji-sway-${cfg.shojiSway}`);
    }
    if (cfg.bambooSway > 0) {
      envEl.classList.add(`bamboo-sway-${cfg.bambooSway}`);
    }

    // 第9・10問では吹き飛んだ後の開放状態を維持し、第8問以前は障子を復帰させる
    if (cfg.shojiBlownAway) {
      envEl.classList.add('shoji-blown-away');
    } else {
      envEl.classList.remove('shoji-blown-away', 'shoji-blowing');
      const moonEl = this.dom.dojoMoon || (typeof document !== 'undefined' ? document.getElementById('dojo-moon') : null);
      if (moonEl) moonEl.classList.remove('moon-vista-bloom');
    }

    envEl.style.setProperty('--shoji-open', cfg.shojiOpen.toString());
    envEl.style.setProperty('--moon-progress', cfg.moonProgress.toString());
    envEl.style.setProperty('--moon-opacity', cfg.moonOpacity.toString());
    envEl.style.setProperty('--stars-opacity', cfg.starsOpacity.toString());

    if (appEl) {
      appEl.classList.toggle('env-night-mode', !!cfg.nightMode);
    }
  }

  // 板割りなどの衝撃で障子がガタッと揺れる演出
  triggerShojiRattle() {
    const envEl = this.dom.dojoEnvBackdrop || (typeof document !== 'undefined' ? document.getElementById('dojo-env-backdrop') : null);
    if (!envEl) return;
    if (envEl.classList.contains('shoji-blown-away') || envEl.classList.contains('shoji-blowing')) return;
    if (this.shojiRattleTimer) {
      clearTimeout(this.shojiRattleTimer);
      this.shojiRattleTimer = null;
    }
    envEl.classList.remove('shoji-impact-rattle');
    void envEl.offsetWidth;
    envEl.classList.add('shoji-impact-rattle');
    this.shojiRattleTimer = setTimeout(() => {
      envEl.classList.remove('shoji-impact-rattle');
      this.shojiRattleTimer = null;
    }, 360);
  }

  // 第8問クリア時：障子が左右に吹き飛ばされ、満月と夜空の視界がぱっと開ける演出
  triggerShojiBlowAway() {
    const envEl = this.dom.dojoEnvBackdrop || (typeof document !== 'undefined' ? document.getElementById('dojo-env-backdrop') : null);
    if (!envEl) return;

    if (this.shojiRattleTimer) {
      clearTimeout(this.shojiRattleTimer);
      this.shojiRattleTimer = null;
    }
    if (this.shojiBlowAwayTimer) {
      clearTimeout(this.shojiBlowAwayTimer);
      this.shojiBlowAwayTimer = null;
    }

    envEl.classList.remove('shoji-impact-rattle', 'shoji-blowing', 'shoji-blown-away');
    // 視界が一気に開け、星空と満月が鮮やかに浮かび上がる（フェーズ5相当へ先行シフト）
    envEl.classList.remove('env-phase-1', 'env-phase-2', 'env-phase-3', 'env-phase-4');
    envEl.classList.add('env-phase-5');
    envEl.style.setProperty('--moon-progress', '0.94');
    envEl.style.setProperty('--moon-opacity', '1');
    envEl.style.setProperty('--stars-opacity', '0.96');

    const moonEl = this.dom.dojoMoon || (typeof document !== 'undefined' ? document.getElementById('dojo-moon') : null);
    if (moonEl) {
      moonEl.classList.remove('moon-vista-bloom');
      void moonEl.offsetWidth;
      moonEl.classList.add('moon-vista-bloom');
    }

    this.spawnShojiBlowParticles();

    void envEl.offsetWidth;
    envEl.classList.add('shoji-blowing', 'shoji-blown-away');

    if (this.dojoAura) {
      this.dojoAura.triggerShojiBlowGust();
    }
    sounds.playShojiBlowAway();

    this.shojiBlowAwayTimer = setTimeout(() => {
      envEl.classList.remove('shoji-blowing');
      envEl.style.setProperty('--shoji-open', '2.80');
      this.shojiBlowAwayTimer = null;
    }, 920);
  }

  // 障子が吹き飛ぶ際の和紙片・組子木片・疾風ストリークを左右へ散らす
  spawnShojiBlowParticles() {
    const container = this.dom.dojoShojiWindParticles || (typeof document !== 'undefined' ? document.getElementById('dojo-shoji-wind-particles') : null);
    if (!container) return;
    container.replaceChildren();

    const total = 26;
    for (let i = 0; i < total; i++) {
      const el = document.createElement('span');
      const goRight = i % 2 === 0;
      const dir = goRight ? 1 : -1;
      const isWind = i % 4 === 0;
      const isWood = !isWind && i % 5 === 2;

      el.className = isWind ? 'shoji-wind-streak' : (isWood ? 'shoji-wood-scrap' : 'shoji-washi-scrap');

      const startX = 50 + dir * (6 + Math.random() * 22);
      const startY = 10 + Math.random() * 78;
      const tx = dir * (130 + Math.random() * 190);
      const ty = (Math.random() - 0.55) * 90;
      const rot = dir * (110 + Math.random() * 240);
      const dur = isWind ? (0.45 + Math.random() * 0.2).toFixed(2) : (0.68 + Math.random() * 0.3).toFixed(2);
      const delay = (Math.random() * 0.1).toFixed(3);

      el.style.setProperty('--x', `${startX.toFixed(1)}%`);
      el.style.setProperty('--y', `${startY.toFixed(1)}%`);
      el.style.setProperty('--tx', `${tx.toFixed(1)}px`);
      el.style.setProperty('--ty', `${ty.toFixed(1)}px`);
      el.style.setProperty('--rot', `${rot.toFixed(0)}deg`);
      el.style.setProperty('--dur', `${dur}s`);
      el.style.setProperty('--delay', `${delay}s`);

      if (isWind) {
        el.style.setProperty('--w', `${(58 + Math.random() * 64).toFixed(0)}px`);
        el.style.setProperty('--h', `${(2 + Math.random() * 2).toFixed(1)}px`);
      } else if (isWood) {
        el.style.setProperty('--w', `${(16 + Math.random() * 14).toFixed(0)}px`);
        el.style.setProperty('--h', `${(3.5 + Math.random() * 2).toFixed(1)}px`);
      } else {
        el.style.setProperty('--w', `${(11 + Math.random() * 10).toFixed(0)}px`);
        el.style.setProperty('--h', `${(8 + Math.random() * 9).toFixed(0)}px`);
      }

      container.appendChild(el);
    }

    setTimeout(() => {
      if (container && container.parentNode) {
        container.replaceChildren();
      }
    }, 1150);
  }

  // 障子吹き飛ばし演出とパーティクルのクリーンアップ
  clearShojiBlowEffects() {
    if (this.shojiBlowAwayTimer) {
      clearTimeout(this.shojiBlowAwayTimer);
      this.shojiBlowAwayTimer = null;
    }
    const envEl = this.dom.dojoEnvBackdrop || (typeof document !== 'undefined' ? document.getElementById('dojo-env-backdrop') : null);
    if (envEl) {
      envEl.classList.remove('shoji-blowing', 'shoji-blown-away', 'shoji-impact-rattle');
    }
    const moonEl = this.dom.dojoMoon || (typeof document !== 'undefined' ? document.getElementById('dojo-moon') : null);
    if (moonEl) {
      moonEl.classList.remove('moon-vista-bloom');
    }
    const container = this.dom.dojoShojiWindParticles || (typeof document !== 'undefined' ? document.getElementById('dojo-shoji-wind-particles') : null);
    if (container) {
      container.replaceChildren();
    }
  }

  // 板割り時の木片スプリンター＆紙吹雪パーティクル生成
  spawnBoardBreakParticles(slot) {
    if (!slot) return;
    const existing = slot.querySelector('.board-break-particles');
    if (existing) existing.remove();

    const layer = document.createElement('div');
    layer.className = 'board-break-particles';
    layer.setAttribute('aria-hidden', 'true');

    const woodColors = ['#dcb98a', '#c4955e', '#9e6d3b', '#e7c89b', '#7b4f26'];
    const confettiColors = ['#fbbf24', '#ef4444', '#fef08a', '#ffffff', '#f97316'];

    // 木の破片（8片）＋ 紙吹雪（10枚）の計18パーティクルを全方位へ飛ばす
    const totalCount = 18;
    for (let i = 0; i < totalCount; i++) {
      const isWood = i < 8;
      const p = document.createElement('span');
      p.className = `board-particle ${isWood ? 'wood-splinter' : 'confetti-chip'}`;

      // 均等角度ベース＋ランダムゆらぎでバランスの良い飛散分布を生成
      const baseAngle = (Math.PI * 2 * i) / totalCount;
      const angle = baseAngle + (Math.random() - 0.5) * 0.45;
      const dist = isWood
        ? 30 + Math.random() * 34
        : 36 + Math.random() * 42;
      const tx = Math.cos(angle) * dist;
      const ty = Math.sin(angle) * dist - 8; // やや上向きに弾け飛ぶ
      const rot = (Math.random() > 0.5 ? 1 : -1) * (140 + Math.random() * 260);
      const dur = isWood
        ? (0.46 + Math.random() * 0.16).toFixed(2)
        : (0.54 + Math.random() * 0.2).toFixed(2);
      const delay = (Math.random() * 0.05).toFixed(3);

      p.style.setProperty('--tx', `${tx.toFixed(1)}px`);
      p.style.setProperty('--ty', `${ty.toFixed(1)}px`);
      p.style.setProperty('--rot', `${rot.toFixed(0)}deg`);
      p.style.setProperty('--dur', `${dur}s`);
      p.style.setProperty('--delay', `${delay}s`);

      if (isWood) {
        p.style.setProperty('--w', `${(7 + Math.random() * 6).toFixed(1)}px`);
        p.style.setProperty('--h', `${(3 + Math.random() * 2.5).toFixed(1)}px`);
        p.style.backgroundColor = woodColors[i % woodColors.length];
      } else {
        p.style.setProperty('--w', `${(5 + Math.random() * 4).toFixed(1)}px`);
        p.style.setProperty('--h', `${(4 + Math.random() * 3.5).toFixed(1)}px`);
        p.style.backgroundColor = confettiColors[i % confettiColors.length];
      }

      layer.appendChild(p);
    }

    slot.appendChild(layer);
    setTimeout(() => {
      if (layer.parentNode) layer.remove();
    }, 820);
  }

  // 透かしSVGファイルの読み込みとインライン埋め込み（確実に単一文字のみ表示）
  async renderWatermarkSVG(hex, expectedSession = null) {
    if (expectedSession !== null && this.charSessionId !== expectedSession) return;

    // 事前クリア
    if (this.dom.watermarkContainer) {
      this.dom.watermarkContainer.replaceChildren();
    }

    let svgText = this.svgDocCache[hex];

    if (!svgText) {
      try {
        const res = await fetch(`./hiragana/${hex}.svg`);
        svgText = await res.text();
        this.svgDocCache[hex] = svgText;
      } catch (e) {
        console.warn(`SVG fetch failed for ${hex}, using fallback outline:`, e);
      }
    }

    if (expectedSession !== null && this.charSessionId !== expectedSession) return;

    if (svgText && this.dom.watermarkContainer) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgText, 'image/svg+xml');
      const svgEl = doc.querySelector('svg');
      if (svgEl) {
        // 余計な要素（番号テキストなど）を非表示にし、ストロークパスのみ抽出
        const numbersGroup = svgEl.querySelector('[id*="StrokeNumbers"]');
        if (numbersGroup) numbersGroup.remove();

        svgEl.setAttribute('viewBox', '0 0 109 109');
        svgEl.setAttribute('width', '100%');
        svgEl.setAttribute('height', '100%');

        // replaceChildren で確実に単一のSVG要素のみを保持（複数文字の同時表示を完全防止）
        this.dom.watermarkContainer.replaceChildren(svgEl);
      }
    }
    this.updateActiveStrokeHighlight();
  }

  // 画数番号タグ ①②③ の配置（各ストロークの始点上に配置・確実に単一文字分のみ配置）
  renderStrokeNumberTags() {
    if (!this.dom.strokeNumbersOverlay) return;
    this.dom.strokeNumbersOverlay.replaceChildren();

    if (!this.currentStrokes || !Array.isArray(this.currentStrokes)) return;

    this.currentStrokes.forEach((stroke, idx) => {
      const tag = document.createElement('div');
      tag.className = `stroke-number-tag ${idx === 0 ? 'active' : ''}`;
      // 丸数字文字
      const circleChars = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];
      tag.textContent = circleChars[idx] || (idx + 1);

      // 各ストロークの始点上（points[0]）を％位置に変換
      const startPt = (stroke.points && stroke.points.length > 0) ? stroke.points[0] : stroke.number_pos;
      if (!startPt || startPt.length < 2) return;
      const [nx, ny] = startPt;
      const leftPercent = (nx / GAME_CONFIG.canvasCoordinateMax) * 100;
      const topPercent = (ny / GAME_CONFIG.canvasCoordinateMax) * 100;

      tag.style.left = `${leftPercent}%`;
      tag.style.top = `${topPercent}%`;
      tag.dataset.strokeIndex = idx;

      this.dom.strokeNumbersOverlay.appendChild(tag);
    });
  }

  // 現在描くべきストロークのハイライト
  updateActiveStrokeHighlight() {
    // 画数タグの更新
    const tags = this.dom.strokeNumbersOverlay.querySelectorAll('.stroke-number-tag');
    tags.forEach((tag, idx) => {
      tag.classList.remove('active', 'done');
      if (idx < this.currentStrokeIndex) {
        tag.classList.add('done');
      } else if (idx === this.currentStrokeIndex) {
        tag.classList.add('active');
      }
    });

    // 透かしSVGのパスの更新
    const svgPaths = this.dom.watermarkContainer.querySelectorAll('path');
    svgPaths.forEach((path, idx) => {
      path.classList.remove('active-stroke', 'completed-stroke');
      if (idx < this.currentStrokeIndex) {
        path.classList.add('completed-stroke');
      } else if (idx === this.currentStrokeIndex) {
        path.classList.add('active-stroke');
      }
    });
  }

  // ストローク描画完了時の判定処理
  onStrokeComplete() {
    // 濁点・半濁点などの極小ストロークやタップに対応（2点の場合は補間、1点タップも許容）
    const targetStroke = this.currentStrokes[this.currentStrokeIndex];
    if (this.userCurrentStrokePoints.length < 2) {
      if (this.userCurrentStrokePoints.length === 1 && targetStroke && targetStroke.points) {
        const p0 = this.userCurrentStrokePoints[0];
        this.userCurrentStrokePoints = [p0, [p0[0] + 0.5, p0[1] + 0.5], [p0[0] + 1.0, p0[1] + 1.0]];
      } else {
        this.userCurrentStrokePoints = [];
        this.redrawCanvas();
        return;
      }
    } else if (this.userCurrentStrokePoints.length === 2) {
      const p0 = this.userCurrentStrokePoints[0];
      const p1 = this.userCurrentStrokePoints[1];
      this.userCurrentStrokePoints = [p0, [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2], p1];
    }
    if (!targetStroke) return;

    // 出来栄え評価（難易度・許容誤差を適用した優しい判定）
    const evalResult = evaluateStroke(
      this.userCurrentStrokePoints,
      targetStroke.points,
      this.getDifficultyConfig(),
      this.customTolerance
    );
    const score = evalResult.score;

    // ストローク得点を集計配列に記録（※途中のストロークに対する点数は全体スコアに計上しない）
    this.currentCharStrokeScores.push(score);

    // 描画済みストロークとして保存
    this.userCompletedStrokes.push([...this.userCurrentStrokePoints]);
    this.userCurrentStrokePoints = [];
    this.redrawCanvas();

    // 画面上部の板（現在書いている文字に対応するスロット）上にパンチ・キック打撃衝撃バクハツ図形と出来栄え得点（0〜100）を表示
    this.showStrokeHitBurst(this.currentCharIndexInWord, score);

    // コンボ判定：70点以上の出来栄え点でコンボ加算・継続、70点未満でリセット
    if (score >= 70) {
      this.strokeComboCount++;
    } else {
      this.strokeComboCount = 0;
    }
    // 連続高判定（コンボ）時の炎オーラエフェクト＆道場全体闘気パーティクルを更新
    this.updateFlameAura();

    // 書き順が正しく進んだ瞬間、筆跡と空手少年から桜吹雪・火の粉の闘気バーストを追従発生
    if (score >= 70 && this.dojoAura) {
      const drawnPts = this.userCompletedStrokes[this.userCompletedStrokes.length - 1] || [];
      this.dojoAura.triggerStrokeBurst(drawnPts, this.dom.canvas, score, this.strokeComboCount);
    }

    // 空手少年の技アニメーション実行（お手本の形状解析と出来栄えスコアに応じた技判定）
    this.performKarateAction(score, this.currentStrokeIndex + 1, this.currentStrokes.length, targetStroke.points);

    // 次の画数へ、または文字完成
    this.currentStrokeIndex++;
    this.updateActiveStrokeHighlight();

    if (this.currentStrokeIndex >= this.currentStrokes.length) {
      // 文字完成時：次の文字への遷移中やスライド逃走中の誤検知・誤操作を防ぐため即座に入力を遮断
      this.setInputBlocked(true);

      // 各文字の平均スコアを算出
      const charAvgScore = Math.max(0, Math.min(100, Math.round(
        this.currentCharStrokeScores.reduce((a, b) => a + b, 0) / (this.currentCharStrokeScores.length || 1)
      )));
      this.wordCharScores.push(charAvgScore);

      const currentCharIdx = this.currentCharIndexInWord;
      const isWordComplete = currentCharIdx + 1 >= this.currentWord.length;

      // 最後のストロークのスコアをユーザーがしっかり確認できるよう時間的余裕（800ms）を確保した後に板割り演出を実行
      this.charBreakTimer = setTimeout(() => {
        this.charBreakTimer = null;
        // ユーザーの筆跡をスロット内のミニキャンバスに転写描画
        this.renderSlotHandwriting(currentCharIdx, this.userCompletedStrokes);

        // 各文字の出来栄え点を文字の上あたりに表示（例: 「75」）
        this.showSlotCharScore(currentCharIdx, charAvgScore);

        // 記録用：手書きPNG画像データと文字スコアを保存
        this.recordCharacterHistory(currentCharIdx, this.currentChar, charAvgScore, this.userCompletedStrokes);

        // 当該スロットの杉板が真っ二つに割れる演出
        this.triggerBoardBreak(currentCharIdx);

        // 二文字目以降へ続くか、または単語全体のすべての板が割れたかの判定
        if (!isWordComplete) {
          // 次の文字の準備：板割り演出中にベールの裏で先行読み込み・DOM構築
          const nextCharIdx = currentCharIdx + 1;
          this.nextCharTimer = setTimeout(async () => {
            this.nextCharTimer = null;
            await this.loadCharacterInWord(nextCharIdx);
          }, 120);

          // 板が割れて破片が飛び散るタイミング（450ms後）でベール解除・即座に入力可能化
          this.unblockInputTimer = setTimeout(() => {
            this.unblockInputTimer = null;
            this.setInputBlocked(false);
          }, 450);
        } else {
          // 当該問題の板がすべて割れたとき（出題された文字列をすべて書いたとき）
          // 第8問（0-indexed 7）クリア時は障子が左右に吹き飛び、背景の月・星空がぱっと開ける
          if (this.currentQuestionIndex === 7) {
            this.triggerShojiBlowAway();
          }

          // 文字列に対する出来栄えを0〜100点で評価（各文字点数の平均）してスコアに加算
          const wordScore = Math.max(0, Math.min(100, Math.round(
            this.wordCharScores.reduce((a, b) => a + b, 0) / (this.wordCharScores.length || 1)
          )));
          this.totalScore += wordScore;
          this.updateScoreDisplay();

          // 第一問〜第十問の履歴に保存（結果画面一覧表示用）
          this.recordQuestionHistory(this.currentQuestionIndex, this.currentWord, wordScore);

          // 板が真っ二つに割れた余韻（600ms）の後に師範の評価セリフを開始
          this.shihanTimer = setTimeout(() => {
            this.shihanTimer = null;
            this.setKarateBoyPose('punch');

            // 師範（80代仙人・永井一郎風）の評価音声：出来栄え（0〜100点）の5つの範囲から3つのセリフをランダム選択して再生
            const shihanEval = sounds.playShihanEvaluation(wordScore);
            const speechText = shihanEval ? shihanEval.text : 'すばらし〜いっ！！！';
            const durationSec = shihanEval ? shihanEval.durationSec : 1.5;

            // 師範のセリフをアクションエフェクト吹き出しで表示
            this.showActionEffect(speechText);

            // 師範のセリフを最後までしっかり聞き取れるよう、音声の長さに合わせた余韻（duration + 0.35秒）を動的確保
            const waitMs = Math.max(900, Math.round(durationSec * 1000 + 350));
            this.wordSlideOutTimer = setTimeout(() => {
              this.wordSlideOutTimer = null;
              this.slideOutWordRow();

              // スライドアウト完了後に次の問題へ
              this.nextQuestionTimer = setTimeout(() => {
                this.nextQuestionTimer = null;
                this.setKarateBoyPose('idle');
                this.nextQuestion();
              }, 550);
            }, waitMs);
          }, 600);
        }
      }, 800);
    }
  }

  // 空手技のアニメーションと演出（ストローク形状とスコアに応じた技の分類実行）
  performKarateAction(score, strokeNumber, totalStrokes = 1, targetPoints = null) {
    // 技の分類判定（スコア30未満はずっこけ、30以上はお手本の幾何形状解析）
    const action = classifyKarateStroke(targetPoints, score);
    const pose = action.id; // 'zukkoke', 'shitazuki', 'uraken', 'mawashi_geri', 'age_geri', 'seiken_zuki'

    // 画面下部の技判定デバッグバッジに判定結果を表示
    if (this.dom.actionDebugBadge) {
      this.dom.actionDebugBadge.className = `action-debug-badge ${action.id}`;
      this.dom.actionDebugBadge.textContent = `【技判定】 ${action.patternLabel}: ${action.name}（${action.desc}） スコア:${Math.round(score)}点`;
    }

    let effectText = 'えいっ！';
    let durationMs = 700;

    if (action.id === 'zukkoke') {
      // スコア30点未満: 技がでない（ずっこける）
      effectText = 'ずこっ！';
      durationMs = 850;
      sounds.playZukkoke();
    } else if (action.id === 'shitazuki') {
      // 1) 縦（下方向）: 下突き
      effectText = '下突き！';
      durationMs = 700;
      sounds.playPunch();
      sounds.playBoyKiai();
    } else if (action.id === 'uraken') {
      // 2) 交差せず長い: 裏拳
      effectText = '裏拳！';
      durationMs = 750;
      sounds.playPunch();
      sounds.playBoySeiKiai();
    } else if (action.id === 'mawashi_geri') {
      // 3) 交差して長い: 回し蹴り
      effectText = '回し蹴り！';
      durationMs = 800;
      sounds.playKick();
      sounds.playBoyKickKiai();
    } else if (action.id === 'age_geri') {
      // 4) 終わりが上方向: 上蹴り
      effectText = '上蹴り！';
      durationMs = 800;
      sounds.playKick();
      sounds.playBoyKickKiai();
    } else {
      // 5) いずれにも非該当: 正拳突き
      effectText = '正拳突き！';
      durationMs = 700;
      sounds.playPunch();
      sounds.playBoyKiai();
    }

    this.setKarateBoyPose(pose);
    this.showActionEffect(effectText);

    // 技終了後に通常の構えに戻る
    if (this.actionResetTimer) clearTimeout(this.actionResetTimer);
    this.actionResetTimer = setTimeout(() => {
      this.setKarateBoyPose('idle');
    }, durationMs);
  }

  // 連続高判定コンボ数に応じた闘気・炎エフェクトと足元バッジの更新
  // コンボ数に応じた和風オーラ段階とバッジアイコンを解決（2, 5, 10, 15, 20, 30, 40コンボ）
  getComboVisualTier(count) {
    if (count >= 40) return { tierClass: 'flame-tier-god-gold',    icon: '🐉' };
    if (count >= 30) return { tierClass: 'flame-tier-large-blue',  icon: '⚡' };
    if (count >= 20) return { tierClass: 'flame-tier-large-red',   icon: '💮' };
    if (count >= 15) return { tierClass: 'flame-tier-sakura-gold', icon: '🌪️' };
    if (count >= 10) return { tierClass: 'flame-tier-mid-red',     icon: '🔥' };
    if (count >= 5)  return { tierClass: 'flame-tier-kiai-red',    icon: '🌸' };
    return { tierClass: 'flame-tier-small-red', icon: '🔥' };
  }

  // 5, 10, 15, 20, 30, 40コンボの節目達成時に和風掛け声バナー＆音＆衝撃波を発動
  triggerComboMilestoneEffect(milestone) {
    if (!milestone) return;
    const banner = this.dom.comboMilestoneBanner || (typeof document !== 'undefined' ? document.getElementById('combo-milestone-banner') : null);
    if (banner) {
      if (this.comboMilestoneTimer) {
        clearTimeout(this.comboMilestoneTimer);
        this.comboMilestoneTimer = null;
      }
      const sealEl = banner.querySelector('.milestone-seal');
      const subEl = banner.querySelector('.milestone-sub');
      const titleEl = banner.querySelector('.milestone-title');
      if (sealEl) sealEl.textContent = milestone.seal;
      if (subEl) subEl.textContent = milestone.sub;
      if (titleEl) titleEl.textContent = milestone.title;

      banner.className = `combo-milestone-banner ${milestone.themeClass}`;
      void banner.offsetWidth;
      banner.classList.add('active');
      banner.setAttribute('aria-hidden', 'false');

      this.comboMilestoneTimer = setTimeout(() => {
        this.comboMilestoneTimer = null;
        banner.classList.remove('active');
        banner.setAttribute('aria-hidden', 'true');
      }, 1380);
    }

    if (this.dojoAura) {
      const tierIdx = this.dojoAura.resolveTierIndex(milestone.threshold);
      this.dojoAura.triggerTierSurge(tierIdx, milestone);
    }
    sounds.playComboMilestone(milestone.threshold);
  }

  // コンボ数に応じた炎・和風オーラ段階切り替え（5, 10, 15, 20, 30, 40コンボで段階強化）
  updateFlameAura() {
    const flameEl = document.getElementById('character-flame-aura');
    const boyContainer = this.dom.karateBoyContainer;
    const badgeEl = document.getElementById('character-combo-badge');
    if (!flameEl || !boyContainer) return;

    const count = this.strokeComboCount;
    if (count === 0) {
      this.lastComboMilestoneReached = 0;
    }

    // 前のティアクラスを全削除
    const tierClasses = [
      'active',
      'flame-tier-small-red',
      'flame-tier-kiai-red',
      'flame-tier-mid-red',
      'flame-tier-sakura-gold',
      'flame-tier-large-red',
      'flame-tier-large-blue',
      'flame-tier-god-gold'
    ];
    flameEl.classList.remove(...tierClasses);
    boyContainer.classList.remove('has-flame', ...tierClasses);
    if (badgeEl) {
      badgeEl.classList.remove(...tierClasses);
    }

    // 道場全体の和風闘気背景＆パーティクルエンジンを更新（1, 5, 10, 15, 20, 30, 40コンボで段階的に激化）
    const backdropEl = this.dom.dojoSpiritBackdrop || (typeof document !== 'undefined' ? document.getElementById('dojo-spirit-backdrop') : null);
    if (backdropEl) {
      backdropEl.classList.remove('aura-tier-1', 'aura-tier-2', 'aura-tier-3', 'aura-tier-4', 'aura-tier-5', 'aura-tier-6', 'aura-tier-7');
      if (this.dojoAura) {
        const dojoTierIdx = this.dojoAura.resolveTierIndex(count);
        const dojoTierCfg = this.dojoAura.getTierConfig(dojoTierIdx);
        if (dojoTierCfg && dojoTierCfg.className) {
          backdropEl.classList.add(dojoTierCfg.className);
        }
      }
    }
    // 5, 10, 15, 20, 30, 40コンボのマイルストーン到達判定
    let crossedMilestone = null;
    for (let i = COMBO_MILESTONES_CONFIG.length - 1; i >= 0; i--) {
      const m = COMBO_MILESTONES_CONFIG[i];
      if (count >= m.threshold && this.lastComboMilestoneReached < m.threshold) {
        crossedMilestone = m;
        this.lastComboMilestoneReached = m.threshold;
        break;
      }
    }

    if (this.dojoAura) {
      this.dojoAura.setCombo(count, !crossedMilestone);
    }
    if (crossedMilestone) {
      this.triggerComboMilestoneEffect(crossedMilestone);
    }

    if (count >= 2) {
      flameEl.classList.add('active');
      boyContainer.classList.add('has-flame');

      const visual = this.getComboVisualTier(count);
      const currentTier = visual.tierClass;

      flameEl.classList.add(currentTier);
      boyContainer.classList.add(currentTier);

      // 主人公キャラクターの足元に「🌸XXれんぞく！」を表示（最前面）
      if (badgeEl) {
        badgeEl.classList.add('active', currentTier);
        const iconEl = badgeEl.querySelector('.combo-icon');
        const textEl = badgeEl.querySelector('.combo-text');
        if (iconEl) iconEl.textContent = visual.icon;
        if (textEl) {
          textEl.textContent = `${count}れんぞく！`;
        } else {
          badgeEl.textContent = `${visual.icon}${count}れんぞく！`;
        }

        // ポップアップアニメーションを再トリガー
        badgeEl.classList.remove('pop');
        void badgeEl.offsetWidth; // 強制リフロー
        badgeEl.classList.add('pop');
      }
    } else {
      if (badgeEl) {
        badgeEl.classList.remove('active', 'pop');
      }
    }
  }

  setKarateBoyPose(pose) {
    let flameClass = '';
    const count = this.strokeComboCount;
    if (count >= 2) {
      const visual = this.getComboVisualTier(count);
      flameClass = ` has-flame ${visual.tierClass}`;
    }
    this.dom.karateBoyContainer.className = `karate-boy-container ${pose}${flameClass}`;
    
    // スプライトシート対応ハーネス
    if (GAME_CONFIG.spriteConfig && GAME_CONFIG.spriteConfig.useSpriteSheet) {
      let spriteEl = this.dom.karateBoyContainer.querySelector('.karate-boy-sprite');
      if (spriteEl) {
        spriteEl.className = `karate-boy-sprite ${pose}`;
      } else {
        const newSprite = document.createElement('div');
        newSprite.className = `karate-boy-sprite ${pose}`;
        newSprite.setAttribute('role', 'img');
        newSprite.setAttribute('aria-label', '空手少年');
        this.dom.karateBoyContainer.appendChild(newSprite);
      }
    } else if (GAME_CONFIG.imagePaths && GAME_CONFIG.imagePaths.useCustomImages) {
      const imgPath = GAME_CONFIG.imagePaths[pose] || GAME_CONFIG.imagePaths.idle;
      let imgEl = this.dom.karateBoyContainer.querySelector('img');
      if (imgEl) {
        imgEl.src = imgPath;
      } else {
        const newImg = document.createElement('img');
        newImg.src = imgPath;
        newImg.alt = "空手キャラクター";
        newImg.style.width = '100%';
        newImg.style.height = '100%';
        newImg.style.objectFit = 'contain';
        this.dom.karateBoyContainer.appendChild(newImg);
      }
    } else {
      const currentBelt = this.getCurrentBelt();
      const svgMarkup = createKarateBoySVG(pose, currentBelt.color);
      let svgEl = this.dom.karateBoyContainer.querySelector('.karate-boy-svg');
      if (svgEl) {
        svgEl.outerHTML = svgMarkup;
      } else {
        const temp = document.createElement('div');
        temp.innerHTML = svgMarkup;
        if (temp.firstElementChild) {
          this.dom.karateBoyContainer.appendChild(temp.firstElementChild);
        }
      }
    }

    // 盛り上げ役仲間キャラクターにも同一の技ポーズを同期適用
    this.updateAllCompanionsPose(pose);
  }

  /**
   * 盛り上げ役仲間キャラクターの表示・解放更新
   * 合計押忍（スコア）に応じて、忍者の煙「ボンッ！」とともに登場
   * 100以上: 白ハチマキウサギ (左下足元)
   * 150以上: 三匹のこぶた (左端・ウサギ横)
   * 200以上: 赤ハチマキカメ (右下足元)
   * 250以上: 赤ずきんの女の子 (右側・カメ横)
  /**
   * 累積スコアに応じた仲間キャラクターの解放計画と配置スロットをセットアップ
   * - 100点: 女の子（左背後・固定）
   * - 200点: 男の子（右背後・固定）
   * - 300, 400, 500, 600, 700, 850点: 他6体をランダム選抜
   * - サイズカテゴリごとのスロット位置ランダム割り当て:
   *   1) うさぎ・かめ (slot-cat1-left / slot-cat1-right)
   *   2) 金太郎・赤ずきん (slot-cat2-left / slot-cat2-right)
   *   3) オオカミ・サル (slot-cat3-left / slot-cat3-right)
   */
  setupCompanionSessionPlan() {
    const plan = {
      girl: { id: 'girl', name: '女の子空手家', score: 100, slotClass: 'slot-fixed-girl' },
      boy_ally: { id: 'boy_ally', name: '男の子空手家', score: 200, slotClass: 'slot-fixed-boy_ally' }
    };

    // 登場スコア間隔（300, 400, 500, 600, 700, 850点）
    const otherMilestones = [300, 400, 500, 600, 700, 850];
    const otherIds = ['rabbit', 'turtle', 'kintaro', 'red_riding_hood', 'wolf', 'monkey'];

    // Fisher-Yatesシャッフルで6体の登場順をランダム化
    const shuffledOthers = [...otherIds];
    for (let i = shuffledOthers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledOthers[i], shuffledOthers[j]] = [shuffledOthers[j], shuffledOthers[i]];
    }

    shuffledOthers.forEach((id, idx) => {
      plan[id] = { id, score: otherMilestones[idx], slotClass: '' };
    });

    // サイズ別スロットのランダム割り当て
    // パターン1: うさぎ、かめ (2スロット)
    const cat1Slots = ['slot-cat1-left', 'slot-cat1-right'];
    if (Math.random() < 0.5) {
      plan.rabbit.slotClass = cat1Slots[0];
      plan.turtle.slotClass = cat1Slots[1];
    } else {
      plan.rabbit.slotClass = cat1Slots[1];
      plan.turtle.slotClass = cat1Slots[0];
    }

    // パターン2: 金太郎と赤ずきん (2スロット)
    const cat2Slots = ['slot-cat2-left', 'slot-cat2-right'];
    if (Math.random() < 0.5) {
      plan.kintaro.slotClass = cat2Slots[0];
      plan.red_riding_hood.slotClass = cat2Slots[1];
    } else {
      plan.kintaro.slotClass = cat2Slots[1];
      plan.red_riding_hood.slotClass = cat2Slots[0];
    }

    // パターン3: オオカミとサル (左右2スロット)
    const cat3Slots = ['slot-cat3-left', 'slot-cat3-right'];
    if (Math.random() < 0.5) {
      plan.wolf.slotClass = cat3Slots[0];
      plan.monkey.slotClass = cat3Slots[1];
    } else {
      plan.wolf.slotClass = cat3Slots[1];
      plan.monkey.slotClass = cat3Slots[0];
    }

    // キャラクター前後関係（前面・背面）の階層定義:
    // 最前面（1列目）：主人公キャラクター (z-index: 30)
    // 2列目：ウサギとカメ (z-index: 20〜21 出現順)
    // 3列目：金太郎と赤ずきん (z-index: 15〜16 出現順)
    // 4列目：オオカミとサル (z-index: 10〜11 出現順)
    // 5列目：男の子と女の子 (z-index: 5〜6 出現順: 100点で女の子、200点で男の子)

    // 5列目: 女の子 (100点: 先行) -> 5, 男の子 (200点: 後発) -> 6
    plan.girl.zIndex = 5;
    plan.boy_ally.zIndex = 6;

    // 2列目: ウサギとカメ (出現スコア順に 20, 21)
    const row2 = [plan.rabbit, plan.turtle].sort((a, b) => a.score - b.score);
    row2[0].zIndex = 20;
    row2[1].zIndex = 21;

    // 3列目: 金太郎と赤ずきん (出現スコア順に 15, 16)
    const row3 = [plan.kintaro, plan.red_riding_hood].sort((a, b) => a.score - b.score);
    row3[0].zIndex = 15;
    row3[1].zIndex = 16;

    // 4列目: オオカミとサル (出現スコア順に 10, 11)
    const row4 = [plan.wolf, plan.monkey].sort((a, b) => a.score - b.score);
    row4[0].zIndex = 10;
    row4[1].zIndex = 11;

    this.sessionCompanionPlan = plan;

    // DOM要素にスロットクラスおよび前後関係z-indexを反映
    const allSlotClasses = [
      'slot-fixed-girl', 'slot-fixed-boy_ally',
      'slot-cat1-left', 'slot-cat1-right',
      'slot-cat2-left', 'slot-cat2-right',
      'slot-cat3-left', 'slot-cat3-right', 'slot-cat3-flank'
    ];

    if (this.dom.companions) {
      Object.keys(plan).forEach(id => {
        const el = this.dom.companions[id];
        if (el) {
          allSlotClasses.forEach(c => el.classList.remove(c));
          if (plan[id].slotClass) {
            el.classList.add(plan[id].slotClass);
          }
          if (plan[id].zIndex) {
            el.style.zIndex = plan[id].zIndex;
          }
        }
      });
    }

    return plan;
  }

  /**
   * スコアに応じた盛り上げ役仲間の解放・表示更新
   */
  updateCompanionsVisibility(animateNew = true) {
    if (!this.dom.companions) return;
    if (!this.sessionCompanionPlan) {
      this.setupCompanionSessionPlan();
    }

    let newlyUnlockedCount = 0;
    Object.keys(this.sessionCompanionPlan).forEach(companionId => {
      const cfg = this.sessionCompanionPlan[companionId];
      const el = this.dom.companions[companionId];
      if (!el) return;

      const shouldBeVisible = this.totalScore >= cfg.score;
      const isAlreadyUnlocked = this.unlockedCompanions.has(companionId);

      if (shouldBeVisible) {
        if (!isAlreadyUnlocked) {
          this.unlockedCompanions.add(companionId);
          el.classList.remove('hidden');
          this.setCompanionPose(companionId, 'idle');
          if (animateNew) {
            newlyUnlockedCount++;
            el.classList.remove('pop-in');
            void el.offsetWidth; // リフロー発生
            el.classList.add('pop-in');
            this.triggerNinjaSmokeAt(el);
            setTimeout(() => {
              el.classList.remove('pop-in');
            }, 600);
          }
        } else {
          el.classList.remove('hidden');
        }
      } else {
        this.unlockedCompanions.delete(companionId);
        el.classList.add('hidden');
        el.classList.remove('pop-in');
      }
    });

    if (animateNew && newlyUnlockedCount > 0) {
      sounds.playNinjaPoof();
    }
  }

  /**
   * 指定した仲間要素の位置に忍者の煙エフェクトを発生
   */
  triggerNinjaSmokeAt(targetElement) {
    if (!targetElement) return;
    const appContainer = document.getElementById('app-container') || document.body;
    const appRect = appContainer.getBoundingClientRect();
    const elemRect = targetElement.getBoundingClientRect();

    const smoke = document.createElement('div');
    smoke.className = 'ninja-smoke-effect';
    smoke.innerHTML = createNinjaSmokeSVG();

    // targetElementの中心座標をappContainer内の相対座標として計算
    const cx = (elemRect.left + elemRect.width / 2) - appRect.left;
    const cy = (elemRect.top + elemRect.height / 2) - appRect.top;

    smoke.style.left = `${cx}px`;
    smoke.style.top = `${cy}px`;
    smoke.style.zIndex = '30';

    appContainer.appendChild(smoke);
    setTimeout(() => {
      if (smoke && smoke.parentNode) {
        smoke.parentNode.removeChild(smoke);
      }
    }, 800);
  }

  /**
   * 個別の仲間キャラクターに技ポーズを設定
   */
  setCompanionPose(companionId, pose) {
    if (!this.dom.companions) return;
    const el = this.dom.companions[companionId];
    if (!el) return;

    const plan = this.sessionCompanionPlan && this.sessionCompanionPlan[companionId];
    const slotClass = plan ? plan.slotClass : '';
    const isHidden = el.classList.contains('hidden') ? 'hidden' : '';
    const isPopIn = el.classList.contains('pop-in') ? 'pop-in' : '';

    el.className = `companion-container companion-${companionId} ${slotClass} ${pose} ${isHidden} ${isPopIn}`.replace(/\s+/g, ' ').trim();
    if (plan && plan.zIndex) {
      el.style.zIndex = plan.zIndex;
    }
    const cfg = GAME_CONFIG.companionConfig && GAME_CONFIG.companionConfig[companionId];

    // スプライトシート対応（全仲間キャラクター共通）
    if (cfg && cfg.spriteConfig && cfg.spriteConfig.useSpriteSheet) {
      let spriteEl = el.querySelector(`.companion-sprite, .${companionId}-sprite`);
      if (spriteEl) {
        spriteEl.className = `companion-sprite ${companionId}-sprite ${pose}`;
      } else {
        el.innerHTML = `<div class="companion-sprite ${companionId}-sprite ${pose}" role="img" aria-label="${cfg.name}"></div>`;
      }
    } else if (GAME_CONFIG.companionConfig && GAME_CONFIG.companionConfig.useCustomImages && cfg && cfg.images) {
      // 個別画像差し替え対応ハーネス（共通ハーネスルール1 & 2）
      const imgPath = cfg.images[pose] || cfg.images.idle;
      el.innerHTML = `<img src="${imgPath}" alt="${cfg.name}" style="width:100%;height:100%;object-fit:contain;" />`;
    } else {
      el.innerHTML = createCompanionSVG(companionId, pose);
    }
  }

  /**
   * 解放済みのすべての仲間に少年と同一の技ポーズを同期適用
   */
  updateAllCompanionsPose(pose) {
    if (!this.unlockedCompanions) return;
    this.unlockedCompanions.forEach(companionId => {
      this.setCompanionPose(companionId, pose);
    });
  }

  // ストローク完了時：画面上部の対応する板スロット上に漫画風打撃衝撃バクハツ図形と出来栄え得点（0〜100）を表示
  showStrokeHitBurst(slotIndex, score) {
    if (!this.dom.wordBoardRow) return;
    const slots = this.dom.wordBoardRow.querySelectorAll('.board-slot');
    const slot = slots[slotIndex];
    if (!slot) return;

    // 既存のバーストがあれば即座にクリア
    const oldBurst = slot.querySelector('.slot-hit-burst');
    if (oldBurst) oldBurst.remove();

    // 板スロットの打撃振動インパクトアニメーション実行（手応え演出）
    slot.classList.remove('slot-impact-shake');
    void slot.offsetWidth; // 強制リフローでアニメーションを確実再実行
    slot.classList.add('slot-impact-shake');

    // バクハツ図形DOM生成（SVG漫画風多重星型爆発＋中央の太字得点）
    const burst = document.createElement('div');
    burst.className = 'slot-hit-burst';

    const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
    const scoreClass = clampedScore === 100 ? 'perfect-score' : '';

    burst.innerHTML = `
      <svg class="hit-burst-svg" viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <filter id="burst-shadow-${slotIndex}" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="1.5" dy="2.5" stdDeviation="2" flood-color="rgba(0,0,0,0.4)" />
          </filter>
          <linearGradient id="burst-outer-grad-${slotIndex}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ef4444" />
            <stop offset="45%" stop-color="#f97316" />
            <stop offset="100%" stop-color="#dc2626" />
          </linearGradient>
          <linearGradient id="burst-inner-grad-${slotIndex}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#fef08a" />
            <stop offset="55%" stop-color="#facc15" />
            <stop offset="100%" stop-color="#fb923c" />
          </linearGradient>
        </defs>
        <!-- 外側の尖った赤い衝撃波トゲ（漫画風アシンメトリー爆発） -->
        <polygon points="50,2 62,24 88,10 76,34 98,38 80,50 98,64 78,68 94,84 68,78 62,98 48,80 28,96 34,70 6,78 22,54 2,40 24,34 12,12 38,22"
                 fill="url(#burst-outer-grad-${slotIndex})" stroke="#991b1b" stroke-width="2.2" stroke-linejoin="round"
                 filter="url(#burst-shadow-${slotIndex})" />
        <!-- 内側の重ねられた黄色い炸裂星 -->
        <polygon points="50,14 60,30 80,20 72,40 88,43 74,52 86,64 70,66 82,80 63,74 59,90 48,74 34,88 38,66 16,72 28,54 12,42 30,37 20,20 40,28"
                 fill="url(#burst-inner-grad-${slotIndex})" stroke="#c2410c" stroke-width="1.5" stroke-linejoin="round" />
      </svg>
      <span class="burst-score-text ${scoreClass}">${clampedScore}</span>
    `;

    slot.appendChild(burst);

    // 通常ストローク時：一定時間（1100ms）後に滑らかにフェードアウト
    setTimeout(() => {
      if (burst && burst.parentNode && !slot.querySelector('.board-wood.breaking')) {
        burst.classList.add('fade-out');
        setTimeout(() => {
          if (burst && burst.parentNode) burst.remove();
        }, 220);
      }
    }, 1100);
  }

  showActionEffect(text) {
    this.dom.actionEffectBubble.textContent = text;
    this.dom.actionEffectBubble.classList.add('show');
    setTimeout(() => {
      this.dom.actionEffectBubble.classList.remove('show');
    }, 900);
  }

  showEvaluationToast(score, customReason) {
    let evalItem = GAME_CONFIG.evaluations.find(e => score >= e.min) || GAME_CONFIG.evaluations[GAME_CONFIG.evaluations.length - 1];
    
    this.dom.evaluationToast.className = `evaluation-toast show ${evalItem.class}`;
    this.dom.toastText.textContent = customReason || `${evalItem.text} +${score}押忍！`;

    setTimeout(() => {
      this.dom.evaluationToast.classList.remove('show');
    }, 1200);
  }

  // スコア表示・段位更新
  updateScoreDisplay(options = {}) {
    const { announcePromotion = true } = options;
    this.dom.scoreNumber.textContent = this.totalScore;

    // 帯ランクの更新（黒枠付き角丸長方形・帯色塗りつぶし・文字色自動調整）
    const belt = this.getCurrentBelt();
    if (this.dom.beltName) {
      this.dom.beltName.textContent = belt.name;
    }
    if (this.dom.beltBadge) {
      this.dom.beltBadge.style.backgroundColor = belt.color;
      this.dom.beltBadge.style.color = belt.textColor;
      this.dom.beltBadge.style.borderColor = "#18181b";
    }
    if (this.dom.beltColorBar) {
      this.dom.beltColorBar.style.backgroundColor = belt.color;
      this.dom.beltColorBar.style.borderColor = belt.border;
    }

    // 帯ランクが上位へ上がった際に全画面「しょうだん！」カットインを発動
    if (announcePromotion && belt.minScore > this.lastAnnouncedBeltMinScore) {
      this.triggerBeltPromotionCutin(belt);
    }
    this.lastAnnouncedBeltName = belt.name;
    this.lastAnnouncedBeltMinScore = belt.minScore;

    // スコア増減に応じた盛り上げ役仲間の解放・表示更新
    this.updateCompanionsVisibility(true);

    this.saveProgress();
  }

  // 帯昇段時の全画面「しょうだん！」毛筆カットイン＋墨汁飛び散り演出
  triggerBeltPromotionCutin(belt) {
    const overlay = this.dom.promotionOverlay || (typeof document !== 'undefined' ? document.getElementById('promotion-cutin-overlay') : null);
    if (!overlay || !belt) return;

    if (this.promotionCutinTimer) {
      clearTimeout(this.promotionCutinTimer);
      this.promotionCutinTimer = null;
    }

    if (this.dom.promotionBeltName) {
      this.dom.promotionBeltName.textContent = belt.name;
    }
    if (this.dom.promotionBeltStripe) {
      this.dom.promotionBeltStripe.style.backgroundColor = belt.color;
    }
    if (this.dom.promotionBeltBanner) {
      this.dom.promotionBeltBanner.style.backgroundColor = belt.color;
      this.dom.promotionBeltBanner.style.color = belt.textColor;
      this.dom.promotionBeltBanner.style.borderColor = '#18181b';
    }
    if (this.dom.promotionBeltSwatch) {
      this.dom.promotionBeltSwatch.style.backgroundColor = belt.border || belt.color;
    }

    this.spawnPromotionInkSplashes(belt);

    overlay.classList.remove('active');
    void overlay.offsetWidth; // 再発火リフロー
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');

    // 昇段インパクトシェイク＆和風昇段ファンファーレ
    if (this.dom.appContainer) {
      this.dom.appContainer.classList.remove('promotion-impact-shake');
      void this.dom.appContainer.offsetWidth;
      this.dom.appContainer.classList.add('promotion-impact-shake');
      setTimeout(() => {
        if (this.dom.appContainer) {
          this.dom.appContainer.classList.remove('promotion-impact-shake');
        }
      }, 380);
    }

    sounds.playPromotionRankUp();

    this.promotionCutinTimer = setTimeout(() => {
      this.clearPromotionCutin();
    }, 1680);
  }

  // 墨汁の飛沫ドット＆筆はねストリークを放射状に生成
  spawnPromotionInkSplashes(belt) {
    const container = this.dom.promotionInkParticles || (typeof document !== 'undefined' ? document.getElementById('promotion-ink-particles') : null);
    if (!container) return;
    container.replaceChildren();

    const total = 30;
    for (let i = 0; i < total; i++) {
      const drop = document.createElement('span');
      const isStreak = i % 3 === 0;
      const isBeltAccent = i % 6 === 5;
      drop.className = `promotion-ink-drop${isStreak ? ' ink-streak' : ''}${isBeltAccent ? ' belt-accent' : ''}`;

      const baseAngle = (Math.PI * 2 * i) / total + (Math.random() - 0.5) * 0.35;
      const dist = 110 + Math.random() * 190;
      const tx = Math.cos(baseAngle) * dist;
      const ty = Math.sin(baseAngle) * (dist * 0.68);
      const deg = (baseAngle * 180) / Math.PI;
      const dur = (0.62 + Math.random() * 0.45).toFixed(2);
      const delay = (0.04 + Math.random() * 0.09).toFixed(3);
      const scale = (0.7 + Math.random() * 0.9).toFixed(2);

      if (isStreak) {
        drop.style.width = `${(18 + Math.random() * 24).toFixed(0)}px`;
        drop.style.height = `${(4 + Math.random() * 4).toFixed(1)}px`;
      } else {
        const size = (6 + Math.random() * 14).toFixed(1);
        drop.style.width = `${size}px`;
        drop.style.height = `${(parseFloat(size) * (0.75 + Math.random() * 0.4)).toFixed(1)}px`;
      }

      if (isBeltAccent && belt && belt.color) {
        drop.style.backgroundColor = belt.minScore >= 700 ? '#fbbf24' : belt.color;
      }

      drop.style.setProperty('--tx', `${tx.toFixed(1)}px`);
      drop.style.setProperty('--ty', `${ty.toFixed(1)}px`);
      drop.style.setProperty('--rot', `${deg.toFixed(0)}deg`);
      drop.style.setProperty('--scale', scale);
      drop.style.setProperty('--dur', `${dur}s`);
      drop.style.setProperty('--delay', `${delay}s`);

      container.appendChild(drop);
    }
  }

  clearPromotionCutin() {
    if (this.promotionCutinTimer) {
      clearTimeout(this.promotionCutinTimer);
      this.promotionCutinTimer = null;
    }
    const overlay = this.dom.promotionOverlay || (typeof document !== 'undefined' ? document.getElementById('promotion-cutin-overlay') : null);
    if (overlay) {
      overlay.classList.remove('active');
      overlay.setAttribute('aria-hidden', 'true');
    }
    if (this.dom.promotionInkParticles) {
      this.dom.promotionInkParticles.replaceChildren();
    }
  }

  getCurrentBelt() {
    const ranks = GAME_CONFIG.beltRanks;
    let current = ranks[0];
    for (let r of ranks) {
      if (this.totalScore >= r.minScore) {
        current = r;
      }
    }
    return current;
  }

  // キャンバスの再描画（墨汁・毛筆風ストローク）
  redrawCanvas() {
    const ctx = this.dom.ctx;
    const rect = this.dom.canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    // 透かし文字（stroke-width: 9.5 in 109座標）と同等〜やや太めのスケール連動線幅
    const scale = rect.width / GAME_CONFIG.canvasCoordinateMax;
    const strokeWidth = scale * 10.8; // 約30〜32pxの重厚な毛筆ストローク

    // 完了済みストロークを描画（黒墨色）
    for (const strokePoints of this.userCompletedStrokes) {
      this.drawBrushStroke(ctx, strokePoints, '#111111', strokeWidth);
    }

    // 現在ドラッグ中のストロークを描画
    if (this.userCurrentStrokePoints.length > 0) {
      this.drawBrushStroke(ctx, this.userCurrentStrokePoints, '#18181b', strokeWidth);
    }

    // デバッグモードON時: JSONの正解座標点列を青線・ドットでオーバーレイ描画
    if (this.debugMode) {
      this.drawDebugPoints(ctx);
    }
  }

  // 毛筆のような滑らかで味のある描画（やや太め）
  drawBrushStroke(ctx, normPoints, color, baseWidth) {
    if (!normPoints || normPoints.length < 2) return;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const screenPoints = normPoints.map(p => this.toScreenPoint(p[0], p[1]));

    ctx.lineWidth = baseWidth;
    ctx.beginPath();
    ctx.moveTo(screenPoints[0][0], screenPoints[0][1]);

    // 2次ベジェ曲線で角を丸め、滑らかな筆跡を表現
    for (let i = 1; i < screenPoints.length - 1; i++) {
      const xc = (screenPoints[i][0] + screenPoints[i + 1][0]) / 2;
      const yc = (screenPoints[i][1] + screenPoints[i + 1][1]) / 2;
      ctx.quadraticCurveTo(screenPoints[i][0], screenPoints[i][1], xc, yc);
    }

    const last = screenPoints[screenPoints.length - 1];
    ctx.lineTo(last[0], last[1]);
    ctx.stroke();

    ctx.restore();
  }

  // デバッグ用：JSONから読み込んだ座標点列（points）を青線・ドットで表示
  drawDebugPoints(ctx) {
    if (!this.debugMode || !this.currentStrokes) return;

    ctx.save();
    this.currentStrokes.forEach((stroke, sIdx) => {
      const isActive = sIdx === this.currentStrokeIndex;
      const isCompleted = sIdx < this.currentStrokeIndex;
      const points = stroke.points;
      if (!points || points.length === 0) return;

      const screenPts = points.map(p => this.toScreenPoint(p[0], p[1]));

      // 1. 青線（正解ポリライン）
      ctx.beginPath();
      ctx.moveTo(screenPts[0][0], screenPts[0][1]);
      for (let i = 1; i < screenPts.length; i++) {
        ctx.lineTo(screenPts[i][0], screenPts[i][1]);
      }
      ctx.strokeStyle = isActive ? '#2563eb' : (isCompleted ? '#93c5fd' : '#60a5fa');
      ctx.lineWidth = isActive ? 3.5 : 2;
      ctx.setLineDash(isActive ? [] : [4, 4]);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.setLineDash([]);

      // 2. 各サンプリング点（青いドット）
      for (let i = 0; i < screenPts.length; i++) {
        const [px, py] = screenPts[i];
        ctx.beginPath();
        ctx.arc(px, py, isActive ? 3.5 : 2.5, 0, Math.PI * 2);
        ctx.fillStyle = isActive ? '#1d4ed8' : '#3b82f6';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // 3. 始点マーカー（強調リングと「画数・始」ラベル）
      const [sx, sy] = screenPts[0];
      ctx.beginPath();
      ctx.arc(sx, sy, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#eff6ff';
      ctx.fill();
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = '#1e40af';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`[${sIdx + 1}画目始点]`, sx, sy - 8);

      // 4. 終点マーカー
      const [ex, ey] = screenPts[screenPts.length - 1];
      ctx.beginPath();
      ctx.rect(ex - 4, ey - 4, 8, 8);
      ctx.fillStyle = '#1e3a8a';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.textBaseline = 'top';
      ctx.fillText(`[終]`, ex, ey + 8);
    });
    ctx.restore();
  }

  // 難易度設定の取得
  getDifficultyConfig() {
    return DIFFICULTY_PRESETS[this.currentDifficulty] || DIFFICULTY_PRESETS.normal;
  }

  // 設定モーダルの表示（保護者・指導者用・漢字使用OK）
  openSettingsModal() {
    if (!this.dom.settingsModal) return;
    this.setInputBlocked(true);
    this.updateDifficultyUI();
    if (this.dom.settingSound) {
      this.dom.settingSound.checked = sounds.enabled;
    }
    if (this.dom.settingDebug) {
      this.dom.settingDebug.checked = this.debugMode;
    }
    this.dom.settingsModal.classList.add('active');
  }

  closeSettingsModal() {
    if (!this.dom.settingsModal) return;
    this.dom.settingsModal.classList.remove('active');
    this.setInputBlocked(false);
  }

  updateDifficultyUI() {
    if (!this.dom.diffBtns) return;
    this.dom.diffBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.diff === this.currentDifficulty);
    });
    const diff = this.getDifficultyConfig();
    if (this.dom.diffDescription) {
      this.dom.diffDescription.textContent = diff.hint;
    }
  }

  saveSettingsFromModal() {
    const diff = this.getDifficultyConfig();
    this.customTolerance = diff.tolerance;
    if (this.dom.settingSound) {
      sounds.enabled = this.dom.settingSound.checked;
      if (this.dom.btnSound) {
        this.dom.btnSound.textContent = sounds.enabled ? 'おと：ON' : 'おと：OFF';
      }
      sounds.syncBgmState();
    }
    if (this.dom.settingDebug) {
      this.debugMode = this.dom.settingDebug.checked;
    }

    this.updateAvailableList();
    this.redrawCanvas();
    this.saveProgress();
    this.closeSettingsModal();
  }

  // 現在の文字をかきなおし
  resetCurrentCharacter() {
    this.currentStrokeIndex = 0;
    this.currentCharStrokeScores = [];
    this.userCompletedStrokes = [];
    this.userCurrentStrokePoints = [];
    this.strokeComboCount = 0;
    this.lastComboMilestoneReached = 0;
    this.updateFlameAura();
    this.updateActiveStrokeHighlight();
    this.redrawCanvas();
    this.setKarateBoyPose('idle');
    this.setInputBlocked(false);
    // スロット上の打撃バーストをクリア
    if (this.dom.wordBoardRow) {
      const bursts = this.dom.wordBoardRow.querySelectorAll('.slot-hit-burst');
      bursts.forEach(b => b.remove());
    }
  }

  // つぎのもんだいへ
  nextQuestion() {
    if (this.currentQuestionIndex + 1 < GAME_CONFIG.totalQuestions) {
      this.startQuestion(this.currentQuestionIndex + 1);
    } else {
      this.endGame();
    }
  }

  // 第十問完了・ゲーム終了処理（ひらがな化）
  endGame() {
    // スピナー表示（input-blocked）を確実に解除し、キャンバス描画のみ遮断
    this.setInputBlocked(false);
    this.isInputBlocked = true;
    if (this.dom.canvas) {
      this.dom.canvas.style.pointerEvents = 'none';
    }

    sounds.playIppon();
    const belt = this.getCurrentBelt();

    // 最高記録・タイトル画面リーダーボード（TOP 5）の更新（localStorage安全アクセス：共通ハーネスルール3）
    let bestScore = this.totalScore;
    try {
      const storedBest = parseInt(localStorage.getItem('kakijun_osu_best_score') || '0', 10);
      bestScore = Math.max(storedBest, this.totalScore);
      localStorage.setItem('kakijun_osu_best_score', bestScore.toString());
    } catch (e) {
      console.warn('localStorage save failed in endGame:', e);
    }
    if ((this.gameQuestionsHistory && this.gameQuestionsHistory.length > 0) || this.totalScore > 0) {
      this.recordLeaderboardScore(this.totalScore, belt);
    }

    if (this.dom.finalScoreNumber) {
      this.dom.finalScoreNumber.textContent = `${this.totalScore} 押忍！`;
    }
    if (this.dom.bestScoreNumber) {
      this.dom.bestScoreNumber.textContent = `さいこうきろく: ${bestScore} 押忍！`;
    }
    if (this.dom.finalBeltName) {
      this.dom.finalBeltName.textContent = belt.name;
    }
    if (this.dom.finalBeltColorBar) {
      this.dom.finalBeltColorBar.style.backgroundColor = belt.color;
      this.dom.finalBeltColorBar.style.borderColor = belt.border;
    }
    if (this.dom.finalBeltBadge) {
      this.dom.finalBeltBadge.style.backgroundColor = belt.color;
      this.dom.finalBeltBadge.style.color = belt.textColor;
      this.dom.finalBeltBadge.style.borderColor = '#18181b';
    }

    // 結果画面に第一問〜第十問の書いた文字列とスコアを一覧表示
    this.renderResultQuestionsList();

    if (this.dom.resultModal) {
      this.dom.resultModal.classList.add('active');
    }
  }

  // 各文字の筆跡とスコアを一時保存
  recordCharacterHistory(slotIndex, char, score, completedStrokes) {
    if (!this.currentQuestionCharHistory) {
      this.currentQuestionCharHistory = [];
    }
    let dataUrl = '';
    if (this.dom.wordBoardRow) {
      const slot = this.dom.wordBoardRow.querySelector(`[data-slot-index="${slotIndex}"]`);
      if (slot) {
        const canvas = slot.querySelector('.slot-char-canvas');
        if (canvas) {
          try {
            dataUrl = canvas.toDataURL('image/png');
          } catch (e) {
            console.warn('Canvas toDataURL failed:', e);
          }
        }
      }
    }

    this.currentQuestionCharHistory.push({
      char,
      score,
      dataUrl,
      strokes: JSON.parse(JSON.stringify(completedStrokes || []))
    });
  }

  // 1問完了時にその問題のデータ（第一問〜第十問）を履歴に追加
  recordQuestionHistory(qIndex, word, wordScore) {
    if (!this.gameQuestionsHistory) {
      this.gameQuestionsHistory = [];
    }
    const kanjiNum = KANJI_NUMBERS[qIndex] || (qIndex + 1);
    this.gameQuestionsHistory.push({
      qIndex,
      qLabel: `第${kanjiNum}問`,
      word,
      wordScore,
      characters: [...(this.currentQuestionCharHistory || [])]
    });
    this.currentQuestionCharHistory = [];
  }

  // 結果画面に第一問〜第十問の書いた文字列とスコアを一覧表示
  renderResultQuestionsList() {
    if (!this.dom.resultQuestionsList) return;
    this.dom.resultQuestionsList.innerHTML = '';

    const history = Array.isArray(this.gameQuestionsHistory) ? this.gameQuestionsHistory : [];

    history.forEach((q) => {
      const card = document.createElement('div');
      card.className = 'result-q-card';

      // 上部：問題番号、出題単語、獲得スコア
      const topRow = document.createElement('div');
      topRow.className = 'result-q-top';
      topRow.innerHTML = `
        <div>
          <span class="result-q-label">${q.qLabel}</span>
          <span class="result-q-word">「${q.word}」</span>
        </div>
        <span class="result-q-score-badge">${q.wordScore} 押忍</span>
      `;
      card.appendChild(topRow);

      // 下部：各文字ごとの手書き筆跡タイルと上部の出来栄え点
      const charsRow = document.createElement('div');
      charsRow.className = 'result-q-chars-row';

      q.characters.forEach((c) => {
        const slotDiv = document.createElement('div');
        slotDiv.className = 'result-char-slot';

        const scoreClass = c.score === 100 ? 'perfect' : (c.score >= 80 ? 'high' : '');
        slotDiv.innerHTML = `
          <div class="result-char-score ${scoreClass}">${c.score}</div>
          <div class="result-char-tile">
            ${c.dataUrl ? `<img src="${c.dataUrl}" class="result-char-img" alt="${c.char}">` : `<span style="font-size:22px; font-weight:900; color:#18181b;">${c.char}</span>`}
          </div>
          <span class="result-char-sublabel">${c.char}</span>
        `;
        charsRow.appendChild(slotDiv);
      });

      card.appendChild(charsRow);
      this.dom.resultQuestionsList.appendChild(card);
    });
  }

  restartGame() {
    this.clearAllQuestionTimers();
    this.totalScore = 0;
    this.currentQuestionScore = 0;
    this.lastLeaderboardEntryId = null;
    this.gameQuestionsHistory = [];
    this.currentQuestionCharHistory = [];
    this.usedWordsInGame.clear();
    this.unlockedCompanions.clear();
    this.setupCompanionSessionPlan();
    this.updateCharacterStageVerticalLayout();
    if (this.dom.canvas) {
      this.dom.canvas.style.pointerEvents = 'auto';
    }
    this.strokeComboCount = 0;
    this.lastComboMilestoneReached = 0;
    if (this.dojoAura) {
      this.dojoAura.clear();
      this.dojoAura.resize();
    }
    this.clearPromotionCutin();
    this.clearShojiBlowEffects();
    this.updateDojoEnvironment(0);
    this.updateFlameAura();
    this.updateScoreDisplay({ announcePromotion: false });
    this.startQuestion(0);
  }

  // タイトル画面の「かいし！」ボタン押下時の遷移（タイトル画面 → 黒 → ゲーム画面）
  startGameFromTitle() {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    sounds.init();
    sounds.unlockAudioContext();
    sounds.preloadBgm();
    sounds.playTaiko();
    sounds.playPunch();

    const curtain = this.dom.transitionCurtain;

    if (curtain) {
      // 第1フェーズ：タイトル画面 → 黒（0.5秒）
      curtain.classList.add('active');

      setTimeout(() => {
        // 第2フェーズ：画面が真っ黒になった瞬間にタイトル画面を閉じ、ゲーム画面を準備
        if (this.dom.titleScreen) {
          this.dom.titleScreen.classList.add('hidden');
        }
        this.restartGame();
        sounds.startBgm(0.55);
        requestAnimationFrame(() => {
          this.updateCharacterStageVerticalLayout();
        });

        // 第3フェーズ：黒 → ゲーム画面（0.5秒）
        setTimeout(() => {
          curtain.classList.remove('active');
          this.updateCharacterStageVerticalLayout();
          setTimeout(() => {
            this.isTransitioning = false;
          }, 500);
        }, 50);
      }, 500);
    } else {
      if (this.dom.titleScreen) {
        this.dom.titleScreen.classList.add('hidden');
      }
      this.restartGame();
      sounds.startBgm(0.55);
      this.updateCharacterStageVerticalLayout();
      this.isTransitioning = false;
    }
  }

  // タイトル画面への復帰
  showTitleScreen() {
    this.clearAllQuestionTimers();
    sounds.stopBgm(0.25, true);
    this.strokeComboCount = 0;
    this.lastComboMilestoneReached = 0;
    if (this.dojoAura) {
      this.dojoAura.clear();
    }
    this.clearPromotionCutin();
    this.clearShojiBlowEffects();
    this.updateDojoEnvironment(0);
    this.updateFlameAura();
    if (this.dom.resultModal) {
      this.dom.resultModal.classList.remove('active');
    }
    if (this.dom.settingsModal) {
      this.dom.settingsModal.classList.remove('active');
    }
    this.setInputBlocked(true);
    if (this.dom.transitionCurtain) {
      this.dom.transitionCurtain.classList.remove('active');
    }
    if (this.dom.titleScreen) {
      this.dom.titleScreen.classList.remove('hidden', 'fade-out');
    }
    this.renderTitleLeaderboard();
    sounds.playSwoosh();
  }

  // タイトル画面リーダーボード（TOP 5）永続化と描画（共通ハーネスルール2 & 3）
  loadLeaderboardEntries() {
    try {
      const raw = localStorage.getItem(LEADERBOARD_CONFIG.storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(item => item && typeof item === 'object' && Number.isFinite(Number(item.score)))
        .map((item, idx) => {
          const score = Math.max(0, Math.round(Number(item.score) || 0));
          const ts = Number.isFinite(Number(item.timestamp)) ? Number(item.timestamp) : 0;
          const beltInfo = (typeof item.beltName === 'string' && GAME_CONFIG.beltRanks.find(r => r.name === item.beltName))
            || getBeltRankForScore(score);
          const dateText = (typeof item.dateText === 'string' && item.dateText.trim())
            ? item.dateText.trim()
            : formatLeaderboardDate(ts || Date.now());
          return {
            id: (typeof item.id === 'string' && item.id) ? item.id : `lb_${ts}_${idx}`,
            score,
            beltName: beltInfo.name,
            dateText,
            timestamp: ts
          };
        })
        .sort((a, b) => (b.score - a.score) || (b.timestamp - a.timestamp))
        .slice(0, LEADERBOARD_CONFIG.maxEntries);
    } catch (e) {
      console.warn('Failed to load leaderboard:', e);
      return [];
    }
  }

  saveLeaderboardEntries(entries) {
    try {
      localStorage.setItem(LEADERBOARD_CONFIG.storageKey, JSON.stringify(entries));
    } catch (e) {
      console.warn('Failed to save leaderboard:', e);
    }
  }

  recordLeaderboardScore(score, belt = null) {
    const numericScore = Math.max(0, Math.round(Number(score) || 0));
    const resolvedBelt = (belt && belt.name) ? belt : getBeltRankForScore(numericScore);
    const now = Date.now();
    const newEntry = {
      id: `lb_${now}_${Math.random().toString(36).slice(2, 7)}`,
      score: numericScore,
      beltName: resolvedBelt.name,
      dateText: formatLeaderboardDate(now),
      timestamp: now
    };

    const existing = this.loadLeaderboardEntries();
    const nextEntries = [...existing, newEntry]
      .sort((a, b) => (b.score - a.score) || (b.timestamp - a.timestamp))
      .slice(0, LEADERBOARD_CONFIG.maxEntries);

    const rankedIn = nextEntries.some(e => e.id === newEntry.id);
    this.leaderboardEntries = nextEntries;
    this.lastLeaderboardEntryId = rankedIn ? newEntry.id : null;
    this.saveLeaderboardEntries(nextEntries);
    this.renderTitleLeaderboard();
    return { entries: nextEntries, rankedIn, entry: newEntry };
  }

  createLeaderboardMedalSVG(rank) {
    const palette = LEADERBOARD_CONFIG.medalColors[rank] || LEADERBOARD_CONFIG.medalColors[1];
    return `<svg class="leaderboard-medal-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7.5 2h3.5l1 5.5H8.5L7.5 2Z" fill="${palette.ribbon}"/>
      <path d="M16.5 2H13l-1 5.5h3.5L16.5 2Z" fill="${palette.ribbon}" opacity="0.88"/>
      <circle cx="12" cy="14" r="7" fill="${palette.fill}" stroke="${palette.stroke}" stroke-width="1.6"/>
      <circle cx="12" cy="14" r="4.8" fill="none" stroke="${palette.text}" stroke-width="0.9" opacity="0.35"/>
      <text x="12" y="16.7" text-anchor="middle" font-size="8.5" font-weight="900" fill="${palette.text}">${rank}</text>
    </svg>`;
  }

  renderTitleLeaderboard() {
    if (!this.dom.titleLeaderboardList) return;
    const entries = Array.isArray(this.leaderboardEntries) ? this.leaderboardEntries : [];
    const listEl = this.dom.titleLeaderboardList;
    if (typeof listEl.replaceChildren === 'function') {
      listEl.replaceChildren();
    } else {
      listEl.innerHTML = '';
    }

    for (let i = 0; i < LEADERBOARD_CONFIG.maxEntries; i++) {
      const rank = i + 1;
      const entry = entries[i] || null;

      const row = document.createElement('li');
      row.className = `leaderboard-row rank-${rank}`;
      if (!entry) {
        row.classList.add('is-empty');
      } else if (this.lastLeaderboardEntryId && entry.id === this.lastLeaderboardEntryId) {
        row.classList.add('is-new');
      }

      // 1. 順位セル（1〜3位は金銀銅メダルSVG、4〜5位は円形番号バッジ）
      const rankCell = document.createElement('div');
      rankCell.className = 'leaderboard-rank-cell';
      if (rank <= 3) {
        rankCell.innerHTML = `${this.createLeaderboardMedalSVG(rank)}<span>${rank}位</span>`;
      } else {
        rankCell.innerHTML = `<span class="leaderboard-rank-num-badge">${rank}</span><span>${rank}位</span>`;
      }
      row.appendChild(rankCell);

      // 2. スコアセル
      const scoreCell = document.createElement('div');
      scoreCell.className = 'leaderboard-score-cell';
      const scoreVal = document.createElement('span');
      scoreVal.className = 'leaderboard-score-val';
      scoreVal.textContent = entry ? entry.score.toLocaleString('ja-JP') : '---';
      const scoreUnit = document.createElement('span');
      scoreUnit.className = 'leaderboard-score-unit';
      scoreUnit.textContent = '押忍';
      scoreCell.appendChild(scoreVal);
      scoreCell.appendChild(scoreUnit);
      row.appendChild(scoreCell);

      // 3. 帯色・段位バッジセル
      const beltCell = document.createElement('div');
      if (entry) {
        const beltInfo = GAME_CONFIG.beltRanks.find(r => r.name === entry.beltName)
          || getBeltRankForScore(entry.score);
        beltCell.className = 'leaderboard-belt-cell';
        beltCell.style.backgroundColor = beltInfo.color;
        beltCell.style.color = beltInfo.textColor;
        beltCell.style.borderColor = beltInfo.border;
        const knot = document.createElement('span');
        knot.className = 'leaderboard-belt-knot';
        const beltLabel = document.createElement('span');
        beltLabel.textContent = beltInfo.name;
        beltCell.appendChild(knot);
        beltCell.appendChild(beltLabel);
      } else {
        beltCell.className = 'leaderboard-belt-cell empty-belt';
        const emptyLabel = document.createElement('span');
        emptyLabel.textContent = '---';
        beltCell.appendChild(emptyLabel);
      }
      row.appendChild(beltCell);

      // 4. 記録日付セル
      const dateCell = document.createElement('div');
      dateCell.className = 'leaderboard-date-cell';
      dateCell.textContent = entry ? entry.dateText : '----/--/--';
      row.appendChild(dateCell);

      listEl.appendChild(row);
    }
  }

  // localStorageへの永続化と復元（共通ハーネスルール3）
  saveProgress() {
    try {
      localStorage.setItem('kakijun_osu_settings_version', '2');
      localStorage.setItem('kakijun_osu_sound_enabled', sounds.enabled ? '1' : '0');
      localStorage.setItem('kakijun_osu_debug_mode', this.debugMode ? '1' : '0');
      localStorage.setItem('kakijun_osu_difficulty', this.currentDifficulty);
      localStorage.setItem('kakijun_osu_recent_words', JSON.stringify(this.recentWordsHistory.slice(-24)));
    } catch (e) {
      console.warn('localStorage save failed:', e);
    }
  }

  restoreProgress() {
    try {
      const soundSetting = localStorage.getItem('kakijun_osu_sound_enabled');
      if (soundSetting !== null) {
        sounds.enabled = soundSetting === '1';
        if (this.dom.btnSound) {
          this.dom.btnSound.textContent = sounds.enabled ? 'おと：ON' : 'おと：OFF';
        }
      }
      if (this.dom.settingSound) {
        this.dom.settingSound.checked = sounds.enabled;
      }
      const debugSetting = localStorage.getItem('kakijun_osu_debug_mode');
      if (debugSetting !== null) {
        this.debugMode = debugSetting === '1';
      }

      // 濁点・半濁点は常に清音とあわせて出題
      this.includeDakutenAndSmall = DAKUTEN_FEATURE_CONFIG.enabled && DAKUTEN_FEATURE_CONFIG.defaultIncludeInQuiz;
      this.updateAvailableList();

      // 難易度（デフォルト: ふつう）および対応する距離誤差マージンを適用
      const diffSetting = localStorage.getItem('kakijun_osu_difficulty');
      if (diffSetting && DIFFICULTY_PRESETS[diffSetting]) {
        this.currentDifficulty = diffSetting;
      } else {
        this.currentDifficulty = 'normal';
      }
      this.customTolerance = DIFFICULTY_PRESETS[this.currentDifficulty].tolerance;

      const best = localStorage.getItem('kakijun_osu_best_score') || '0';
      this.dom.bestScoreNumber.textContent = `さいこうきろく: ${best} 押忍！`;

      const recentRaw = localStorage.getItem('kakijun_osu_recent_words');
      if (recentRaw) {
        const parsedRecent = JSON.parse(recentRaw);
        if (Array.isArray(parsedRecent)) {
          this.recentWordsHistory = parsedRecent.filter(w => typeof w === 'string' && w.length > 0).slice(-24);
          if (this.recentWordsHistory.length > 0) {
            this.lastSelectedWord = this.recentWordsHistory[this.recentWordsHistory.length - 1];
          }
        }
      }

      this.leaderboardEntries = this.loadLeaderboardEntries();
      this.renderTitleLeaderboard();
    } catch (e) {
      console.warn('localStorage restore failed:', e);
    }
  }

  // PWA Service Worker 登録とキャッシュクリーン監視（共通ハーネスルール4）
  initServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').then((reg) => {
        // 定期的な更新チェック
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] 新バージョンを検知。自動リロードします...');
              window.location.reload();
            }
          });
        });
      }).catch((err) => {
        console.warn('Service Worker registration skipped/failed:', err);
      });

      // コントローラー変更時の自動強制リロード（更新ハーネス）
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    }
  }

  // PWA インストールプロンプト制御
  initPWAInstall() {
    const btnInstall = this.dom.btnInstall;
    if (!btnInstall) return;

    let deferredPrompt = null;
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: window-controls-overlay)').matches ||
      window.navigator.standalone === true;

    const hideInstallButton = () => {
      btnInstall.style.display = 'none';
      deferredPrompt = null;
    };

    if (isStandalone) {
      hideInstallButton();
      return;
    }

    const ua = window.navigator.userAgent || '';
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isIOSSafari = isIOS && /Safari/i.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/i.test(ua);

    if (isIOSSafari) {
      btnInstall.style.display = 'inline-flex';
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      btnInstall.style.display = 'inline-flex';
    });

    window.addEventListener('appinstalled', () => {
      hideInstallButton();
    });

    const iosModal = document.getElementById('ios-install-modal');
    const closeIosModalBtn = document.getElementById('btn-close-ios-install');
    if (iosModal && closeIosModalBtn) {
      closeIosModalBtn.addEventListener('click', () => {
        iosModal.classList.remove('active');
      });
      iosModal.addEventListener('click', (ev) => {
        if (ev.target === iosModal) {
          iosModal.classList.remove('active');
        }
      });
    }

    btnInstall.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        try {
          const { outcome } = await deferredPrompt.userChoice;
          if (outcome === 'accepted') {
            hideInstallButton();
          }
        } finally {
          deferredPrompt = null;
        }
      } else if (isIOSSafari && iosModal) {
        iosModal.classList.add('active');
      }
    });
  }

  updateOnlineStatus() {
    if (navigator.onLine) {
      this.dom.offlineBanner.classList.remove('active');
    } else {
      this.dom.offlineBanner.classList.add('active');
    }
  }
}

// ============================================================================
// アプリケーション起動
// ============================================================================
window.addEventListener('DOMContentLoaded', () => {
  const game = new KakijunOsuGame();
  game.init();
});
