// create AudioContext object
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// get all anchor elements with the data-char attribute
const buttons = document.querySelectorAll("a[data-char]");

// get the logo element
const logo = document.querySelector(".logo");

// check if the browser supports speech synthesis
const speechSynthesisSupported = "speechSynthesis" in window;
const emoji = "\ud83d\udc04";
// keep track of the last clicked button
let lastButton = null;

// keep track of the number of times Mu button is pressed in a row
let muCount = 0;

// keep track of whether easter egg is triggered
let triggered = false;

// add event listener to logo element
logo.addEventListener("click", () => {
  if (speechSynthesisSupported) {
    speechSynthesis.cancel();
    // create a new SpeechSynthesisUtterance object
    const utterance = new SpeechSynthesisUtterance();
    utterance.lang = "ja-JP";
    utterance.volume = 0.8;
    utterance.rate = 0.9;
    utterance.pitch = 1.5;
    utterance.text = triggered ? "Moohidoi" : "Mouhidoi";
    // speak the utterance
    speechSynthesis.speak(utterance);
  }
});

// loop through each button and add an event listener
buttons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();

    if (speechSynthesisSupported) {
      speechSynthesis.cancel();
      // create a new SpeechSynthesisUtterance object
      const utterance = new SpeechSynthesisUtterance();
      utterance.lang = "ja-JP";
      utterance.volume = 1;
      utterance.rate = 0.75;
      utterance.pitch = 1.5;
      utterance.text = button.textContent;
      // modify the utterance if the cow emoji is clicked
if (button.textContent.includes(emoji)) {
  utterance.text = "moooooo";
} else {
  utterance.text = button.textContent.replace(" ", "");
}

      // slow down the speech if the same button was clicked twice in a row
      if (lastButton && lastButton.dataset.char === button.dataset.char) {
        if (triggered) {
          utterance.rate = 1;
          triggered = false;
        } else {
          utterance.rate = 0.5;
          triggered = true;
        }
      }

      // speak the pronunciation
      speechSynthesis.speak(utterance);

      // update the last clicked button
      lastButton = button;
    }

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

document.querySelector('link[rel="icon"]').setAttribute("href", "images/moojito-icon.png");
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
