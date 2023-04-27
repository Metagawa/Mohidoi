// create AudioContext object
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// get all anchor elements with the data-char attribute
const buttons = document.querySelectorAll("a[data-char]");

// check if the browser supports speech synthesis
const speechSynthesisSupported = 'speechSynthesis' in window;

// loop through each button and add an event listener
buttons.forEach(button => {
  button.addEventListener("click", (event) => {
    event.preventDefault();

    if (speechSynthesisSupported) {
      speechSynthesis.cancel();
                  // create a new SpeechSynthesisUtterance object
      const utterance = new SpeechSynthesisUtterance();
      utterance.lang = 'ja-JP';
      utterance.text = button.textContent;
            // speak the pronunciation
      speechSynthesis.speak(utterance);
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


