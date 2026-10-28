// Native recordings (Lingua Libre / Wikimedia Commons, speaker Fukujinzuke, CC BY 4.0) live in audio/<hiragana>.wav.
// Anything without a recording (yoon, some dakuten, small tsu, long vowels) falls back to the browser's own Japanese voice.
const RECORDED = new Set(["あ", "い", "う", "え", "お", "か", "が", "き", "く", "け", "こ", "ご", "さ", "し", "じ", "す", "せ", "そ", "ぞ", "た", "だ", "ち", "つ", "て", "で", "と", "ど", "な", "に", "ぬ", "ね", "の", "は", "ば", "ひ", "び", "ふ", "へ", "ほ", "ま", "み", "む", "め", "も", "や", "ゆ", "よ", "ら", "り", "る", "れ", "ろ", "わ", "を", "ん"]);

const toHiragana = (s) =>
  s.replace(/[\u30a1-\u30f6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

function speakSynth(text, rate) {
  if (!("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ja-JP";
  u.rate = rate;
  const ja = speechSynthesis.getVoices().find((v) => v.lang && v.lang.startsWith("ja"));
  if (ja) u.voice = ja;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

function speak(text, rate) {
  const key = toHiragana(text);
  if (RECORDED.has(key)) {
    const clip = new Audio(`audio/${key}.wav`);
    clip.preservesPitch = true;
    clip.playbackRate = rate < 0.75 ? 0.6 : 1;
    clip.play();
  } else {
    speakSynth(text, rate);
  }
}

// get all anchor elements with the data-char attribute
const buttons = document.querySelectorAll("a[data-char]");

// get the logo element
const logo = document.querySelector(".logo");

const emoji = "\ud83d\udc04";
// keep track of the last clicked button
let lastButton = null;

// keep track of the number of times Mu button is pressed in a row
let muCount = 0;

// keep track of whether easter egg is triggered
let triggered = false;

// add event listener to logo element
logo.addEventListener("click", () => {
  const text = triggered ? "Moohidoi" : "Mouhidoi";
  speakSynth(text, 0.9);
});

// loop through each button and add an event listener
buttons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();

    let text = button.textContent;
    if (button.textContent.includes(emoji)) {
      text = "moooooo";
    } else {
      text = button.textContent.replace(" ", "");
    }

    let rate = 1;
    if (lastButton && lastButton.dataset.char === button.dataset.char) {
      if (triggered) {
        rate = 1;
        triggered = false;
      } else {
        rate = 0.5;
        triggered = true;
      }
    }

    speak(text, rate);

    // update the last clicked button
    lastButton = button;

    // check for easter egg
    if (button.dataset.char === "mu") {
      muCount++;
      if (muCount >= 5) {
        button.textContent = emoji;
        triggered = true;
        muCount = 0;
        document.querySelectorAll(".logo, h1").forEach((element) => {
          element.textContent = "Moohidoi";
        });
        logo.innerHTML = "\ud83d\udc04";
        logo.style.fontSize = "4rem";

        document
          .querySelector('link[rel="icon"]')
          .setAttribute("href", "images/moojito-icon.png");
        document.title = "Moohidoi";
      }
    }

    // create a new div element for the popup
    const popup = document.createElement("div");
    popup.textContent = `${button.dataset.char} (${button.textContent})`;
    popup.classList.add("popup");
    document.body.appendChild(popup);

    // position the popup over the button
    const rect = button.getBoundingClientRect();
    const top = rect.top + window.pageYOffset;
    const left = rect.left + window.pageXOffset;
    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;

    // remove the popup after 2 seconds
    setTimeout(() => {
      popup.classList.add("fade-out");
      setTimeout(() => {
        popup.remove();
      }, 500);
    }, 2000);
  });
});

function showSupportPopup(supported) {
  const supportPopup = document.createElement("div");
  supportPopup.textContent = supported
    ? "Your browser supports voice playback."
    : "Your browser doesn't support voice playback. Voice clips will not play.";
  supportPopup.style.position = "fixed";
  supportPopup.style.left = "50%";
  supportPopup.style.bottom = "0%";
  supportPopup.style.transform = "translate(-50%, -50%)";
  supportPopup.style.backgroundColor = supported ? "green" : "red";
  supportPopup.style.color = "white";
  supportPopup.style.padding = "20px";
  supportPopup.style.borderRadius = "5px";
  supportPopup.style.zIndex = "9999";
  supportPopup.style.textAlign = "center";
  document.body.appendChild(supportPopup);

  setTimeout(() => {
    supportPopup.remove();
  }, 2500);
}

document.addEventListener("DOMContentLoaded", () => {
  showSupportPopup("speechSynthesis" in window || typeof Audio !== "undefined");
});