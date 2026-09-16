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
    cmdInput.style.color = 'blue';
} else if (season === 'spring') {
    terminal.style.borderImage = 'linear-gradient(to bottom, #58ff58, #30ff30) 1';
    terminal.style.color = 'green';
    cmdInput.style.color = 'green';
} else if (season === 'summer') {
    terminal.style.borderImage = 'linear-gradient(to bottom, #ffff4b, #ffff32) 1';
    terminal.style.color = 'yellow';
    cmdInput.style.color = 'yellow';
} else {
    terminal.style.borderImage = 'linear-gradient(to bottom, #ffb03a, #ff9a34) 1';
    terminal.style.color = 'orange';
    cmdInput.style.color = 'orange';
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

function typeOutput(text) {
    clearInterval(typingTimer);
    cmdOutput.innerHTML = '<span class="typed-text"></span><span class="output-cursor">_</span>';

    const typedText = cmdOutput.querySelector('.typed-text');
    const template = document.createElement('template');
    template.innerHTML = text;
    typedText.appendChild(template.content.cloneNode(true));

    const textNodes = [];
    const walker = document.createTreeWalker(typedText, NodeFilter.SHOW_TEXT);
    let currentNode;

    while (currentNode = walker.nextNode()) {
        textNodes.push({
            node: currentNode,
            text: currentNode.textContent,
            index: 0
        });
        currentNode.textContent = '';
    }

    let nodeIndex = 0;

    typingTimer = setInterval(function() {
        if (nodeIndex === textNodes.length) {
            clearInterval(typingTimer);
            cmdOutput.querySelector('.output-cursor').classList.add('hidden');
            return;
        }

        const currentTextNode = textNodes[nodeIndex];
        currentTextNode.node.textContent += currentTextNode.text[currentTextNode.index];
        currentTextNode.index += 1;

        if (currentTextNode.index === currentTextNode.text.length) {
            nodeIndex += 1;
        }
    }, 50);
}

function cmdSubmit() {
    if (cmdInput.value === 'help') {
        typeOutput('<strong>commands:</strong><br>help<br/>projects<br/><br/><strong>you can type the help command and then the command you want to know more about for a description.');
    } else if (cmdInput.value === 'projects') {
        typeOutput('<strong>projects:</strong><br/>this website! <a href="https://github.com/GoatTech-42/my-website" target="_blank">github</a>')
    } else {
        typeOutput('unknown command. type "help" for the list!');
    }
}