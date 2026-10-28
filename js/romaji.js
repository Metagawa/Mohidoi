// Small built-in Hepburn romaniser (kana -> romaji). No dependencies.
// Long vowels written with ー are doubled (コーヒー -> koohii) so they stay easy to type and search.
(function () {
  "use strict";

  const BASE = {
    あ: "a", い: "i", う: "u", え: "e", お: "o",
    か: "ka", き: "ki", く: "ku", け: "ke", こ: "ko",
    が: "ga", ぎ: "gi", ぐ: "gu", げ: "ge", ご: "go",
    さ: "sa", し: "shi", す: "su", せ: "se", そ: "so",
    ざ: "za", じ: "ji", ず: "zu", ぜ: "ze", ぞ: "zo",
    た: "ta", ち: "chi", つ: "tsu", て: "te", と: "to",
    だ: "da", ぢ: "ji", づ: "zu", で: "de", ど: "do",
    な: "na", に: "ni", ぬ: "nu", ね: "ne", の: "no",
    は: "ha", ひ: "hi", ふ: "fu", へ: "he", ほ: "ho",
    ば: "ba", び: "bi", ぶ: "bu", べ: "be", ぼ: "bo",
    ぱ: "pa", ぴ: "pi", ぷ: "pu", ぺ: "pe", ぽ: "po",
    ま: "ma", み: "mi", む: "mu", め: "me", も: "mo",
    や: "ya", ゆ: "yu", よ: "yo",
    ら: "ra", り: "ri", る: "ru", れ: "re", ろ: "ro",
    わ: "wa", ゐ: "wi", ゑ: "we", を: "o", ん: "n",
    ゔ: "vu",
    ぁ: "a", ぃ: "i", ぅ: "u", ぇ: "e", ぉ: "o", ゃ: "ya", ゅ: "yu", ょ: "yo", ゎ: "wa",
  };

  // two-character combinations (yōon and the extra katakana sounds, written in hiragana here)
  const PAIRS = {
    きゃ: "kya", きゅ: "kyu", きょ: "kyo", ぎゃ: "gya", ぎゅ: "gyu", ぎょ: "gyo",
    しゃ: "sha", しゅ: "shu", しょ: "sho", しぇ: "she", じゃ: "ja", じゅ: "ju", じょ: "jo", じぇ: "je",
    ちゃ: "cha", ちゅ: "chu", ちょ: "cho", ちぇ: "che", ぢゃ: "ja", ぢゅ: "ju", ぢょ: "jo",
    にゃ: "nya", にゅ: "nyu", にょ: "nyo", ひゃ: "hya", ひゅ: "hyu", ひょ: "hyo",
    びゃ: "bya", びゅ: "byu", びょ: "byo", ぴゃ: "pya", ぴゅ: "pyu", ぴょ: "pyo",
    みゃ: "mya", みゅ: "myu", みょ: "myo", りゃ: "rya", りゅ: "ryu", りょ: "ryo",
    ふぁ: "fa", ふぃ: "fi", ふぇ: "fe", ふぉ: "fo", ふゅ: "fyu",
    うぃ: "wi", うぇ: "we", うぉ: "wo",
    ゔぁ: "va", ゔぃ: "vi", ゔぇ: "ve", ゔぉ: "vo",
    てぃ: "ti", でぃ: "di", とぅ: "tu", どぅ: "du", でゅ: "dyu", てゅ: "tyu",
    つぁ: "tsa", つぃ: "tsi", つぇ: "tse", つぉ: "tso",
    いぇ: "ye", くぁ: "kwa", ぐぁ: "gwa",
  };

  const toHiragana = (s) =>
    s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  const toKatakana = (s) =>
    s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));

  function romaji(input) {
    if (!input) return "";
    const s = toHiragana(input);
    if (s === "を") return "wo";
    const out = [];
    let geminate = false;
    let afterN = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === "っ") {
        geminate = true;
        continue;
      }
      if (c === "ー") {
        const prev = out.length ? out[out.length - 1] : "";
        const v = prev.match(/[aeiou]$/);
        if (v) out[out.length - 1] = prev + v[0];
        continue;
      }
      if (c === "・" || c === " " || c === "　") {
        out.push(" ");
        continue;
      }
      let syl = null;
      const pair = s.substr(i, 2);
      if (PAIRS[pair]) {
        syl = PAIRS[pair];
        i++;
      } else if (BASE[c] !== undefined) {
        syl = BASE[c];
      } else {
        syl = c; // kanji, punctuation, latin: leave as is
      }
      if (geminate) {
        if (/^ch/.test(syl)) syl = "t" + syl;
        else if (/^[bcdfghjkmpqrstvwz]/.test(syl)) syl = syl[0] + syl;
        geminate = false;
      }
      // ん before a vowel or y: n' to keep it readable (e.g. きんえん kin'en)
      if (afterN && /^[aeiouy]/.test(syl)) out[out.length - 1] = "n'";
      afterN = c === "ん";
      out.push(syl);
    }
    if (geminate) out.push("'"); // trailing small っ (glottal stop)
    return out.join("");
  }

  window.Kana = { romaji, toHiragana, toKatakana };
})();
