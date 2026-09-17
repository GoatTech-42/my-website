let season = getSeason();
const terminal = document.querySelector('.terminal');
const cmdOutput = document.getElementById('output');
const cmdInput = document.getElementById('cmdInput');
const blinkingSpan = document.getElementById('blink');
const commandForm = document.getElementById('commandForm');
const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');
const particleArray = [];
const particleNumber = 75;
const particleImage = new Image();
let typingTimer;
let animationStarted = false;

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

function applySeason(newSeason) {
    season = newSeason;

    const seasonStyles = {
        winter: {
            border: 'linear-gradient(to bottom, #54aaff, #3097ff) 1',
            color: 'blue',
            particle: 'particles/winterleaf.png'
        },
        spring: {
            border: 'linear-gradient(to bottom, #58ff58, #30ff30) 1',
            color: 'green',
            particle: 'particles/springleaf.png'
        },
        summer: {
            border: 'linear-gradient(to bottom, #ffff4b, #ffff32) 1',
            color: 'yellow',
            particle: 'particles/summerleaf.png'
        },
        autumn: {
            border: 'linear-gradient(to bottom, #ffb03a, #ff9a34) 1',
            color: 'orange',
            particle: 'particles/fallleaf.png'
        }
    };

    const style = seasonStyles[newSeason];
    terminal.style.borderImage = style.border;
    terminal.style.setProperty('--season-color', style.color);
    particleImage.src = style.particle;
}

applySeason(season);

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

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

class Particle {
    constructor() {
        this.reset();
        this.y = Math.random() * canvas.height; 
    }
    reset() {
        this.size = Math.random() * 20 + 20;
        this.x = Math.random() * canvas.width;
        this.y = -this.size;
        this.speedY = Math.random() * 2 + 1;
        this.speedX = Math.random() * 1.5 - 0.75;
        this.angle = Math.random() * 360;
        this.spin = Math.random() * 2 - 1;
        this.sway = Math.random() * Math.PI * 2;
        this.swaySpeed = Math.random() * 0.04 + 0.02;
        this.swayAmount = Math.random() * 0.8 + 0.4;
    }

    update() {
        this.y += this.speedY;
        this.sway += this.swaySpeed;
        this.x += this.speedX + Math.sin(this.sway) * this.swayAmount;
        this.angle += this.spin;

        if (this.y > canvas.height + this.size) {
            this.reset();
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate((this.angle * Math.PI) / 180);
        ctx.drawImage(
            particleImage,
            -this.size / 2,
            -this.size / 2,
            this.size, 
            this.size
        );
        ctx.restore();
    }
}

function init() {
    for (let i = 0; i < particleNumber; i++) {
        particleArray.push(new Particle());
    }
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < particleArray.length; i++) {
        particleArray[i].update();
        particleArray[i].draw();
    }

    requestAnimationFrame(animate);
}

particleImage.onload = () => {
    if (!animationStarted) {
        init();
        animate();
        animationStarted = true;
    }
};

function cmdSubmit() {
    const command = cmdInput.value.trim().toLowerCase();

    if (command === 'season winter' || command === 'winter') {
        applySeason('winter');
        typeOutput('winter mode');
    } else if (command === 'season spring' || command === 'spring') {
        applySeason('spring');
        typeOutput('spring mode');
    } else if (command === 'season summer' || command === 'summer') {
        applySeason('summer');
        typeOutput('summer mode');
    } else if (command === 'season fall' || command === 'autumn') {
        applySeason('autumn');
        typeOutput('fall mode');
    } else if (command === 'help') {
        typeOutput('<strong>commands:</strong><br>help<br/>projects<br/><br/><strong>you can type the help command and then the command you want to know more about for a description.');
    } else if (command === 'projects') {
        typeOutput('<strong>projects:</strong><br/>this website! <a href="https://github.com/GoatTech-42/my-website" target="_blank">github</a><br/>mc headless <a href="https://github.com/GoatTech-42/mc-headless" target="_blank">github</a><br/>nebula v2 <a href="https://github.com/GoatTech-42/NEBULA-V2" target="_blank">github</a>');
    } else if (command === 'ping') {
        typeOutput('pong');
    } else if (command === 'pong') {
        typeOutput('hell no');
    } else if (command === 'help projects') {
        typeOutput('this command shows my projects what did you think it did')
    } else if (command === 'help help') {
        typeOutput('ur not funny lil bro')
    } else if (command === '67') {
        typeOutput('genuinely leave this planet and never return')
    } else {
        typeOutput('unknown command. type "help" for the list!');
    }
}

