const season = getSeason();
const terminal = document.querySelector('.terminal');
const cmdOutput = document.getElementById('output')
const cmdInput = document.getElementById('cmdInput');
const blinkingSpan = document.getElementById('blink');
const commandForm = document.getElementById('commandForm');
let typingTimer;



function getSeason(date = new Date()) {
    const month = date.getMonth();
    if (month === 11 || month <= 1) {
        return 'winter';
    } else if (month >= 2 && month <= 4) {
        return 'spring';
    } else if (month >= 5 && month <= 7) {
        return 'summer';
    } else {
        return 'autumn';
    }
}

if (season === 'winter') {
    terminal.style.borderImage = 'linear-gradient(to bottom, #54aaff, #3097ff) 1';
    terminal.style.color = 'blue';
} else if (season === 'spring') {
    terminal.style.borderImage = 'linear-gradient(to bottom, #58ff58, #30ff30) 1';
    terminal.style.color = 'green';
} else if (season === 'summer') {
    terminal.style.borderImage = 'linear-gradient(to bottom, #ffff4b, #ffff32) 1';
    terminal.style.color = 'yellow';
} else {
    terminal.style.borderImage = 'linear-gradient(to bottom, #ffb03a, #ff9a34) 1';
    terminal.style.color = 'orange';
}

cmdInput.addEventListener('click', function() {
    blinkingSpan.classList.add('hidden');
});

cmdInput.addEventListener('blur', function() {
    if (cmdInput.value.trim() === '') {
        blinkingSpan.classList.remove('hidden');
    }
});

commandForm.addEventListener('submit', function(event) {
    event.preventDefault();
    cmdSubmit();
});

function cmdSubmit() {
    if (cmdInput.value === 'help') {
        typeOutput('No commands yet cause like this is a beta yk');
    }
}

function typeOutput(text) {
    clearInterval(typingTimer);
    cmdOutput.innerHTML = '<span class="typed-text"></span><span class="output-cursor">_</span>';

    const typedText = cmdOutput.querySelector('.typed-text');
    let characterIndex = 0;

    typingTimer = setInterval(function() {
        typedText.textContent += text[characterIndex];
        characterIndex += 1;

        if (characterIndex === text.length) {
            clearInterval(typingTimer);
        }
    }, 50);
}