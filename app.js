// create AudioContext object
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// get all anchor elements with the data-char attribute
const buttons = document.querySelectorAll("a[data-char]");

// loop through each button and add an event listener
buttons.forEach(button => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    const soundUrl = `audio/${button.dataset.char}.mp3`;

    // create a new Audio object and load the sound file
    const sound = new Audio(soundUrl);
    sound.load();

    // play the sound
    sound.play();

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
