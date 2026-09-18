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
let nebulaGames = [];
const nebulaSources = [
    {
        catalog: 'https://cdn.jsdelivr.net/gh/GoatTech-42/NEBULA-CDN@main/games.json',
        base: 'https://cdn.jsdelivr.net/gh/GoatTech-42/NEBULA-CDN@main'
    },
    {
        catalog: 'https://raw.githubusercontent.com/GoatTech-42/NEBULA-CDN/main/games.json',
        base: 'https://raw.githubusercontent.com/GoatTech-42/NEBULA-CDN/main'
    },
    {
        catalog: 'https://cdn.jsdelivr.net/gh/Nos-and-Stealzers/NEBULA-CDN@main/games.json',
        base: 'https://cdn.jsdelivr.net/gh/Nos-and-Stealzers/NEBULA-CDN@main'
    },
    {
        catalog: 'https://raw.githubusercontent.com/Nos-and-Stealzers/NEBULA-CDN/main/games.json',
        base: 'https://raw.githubusercontent.com/Nos-and-Stealzers/NEBULA-CDN/main'
    }
];
let nebulaSource = nebulaSources[0];
typeOutput('hello, welcome to goat cmd. try some commands!')

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
            glow: 'rgba(77, 166, 255, 0.9)',
            particle: 'particles/winterleaf.png'
        },
        spring: {
            border: 'linear-gradient(to bottom, #58ff58, #30ff30) 1',
            color: 'green',
            glow: 'rgba(77, 255, 77, 0.9)',
            particle: 'particles/springleaf.png'
        },
        summer: {
            border: 'linear-gradient(to bottom, #ffff4b, #ffff32) 1',
            color: 'yellow',
            glow: 'rgba(255, 255, 50, 0.9)',
            particle: 'particles/summerleaf.png'
        },
        autumn: {
            border: 'linear-gradient(to bottom, #ffb03a, #ff9a34) 1',
            color: 'orange',
            glow: 'rgba(255, 166, 77, 0.9)',
            particle: 'particles/fallleaf.png'
        }
    };

    const style = seasonStyles[newSeason];
    terminal.style.borderImage = style.border;
    terminal.style.setProperty('--season-color', style.color);
    terminal.style.setProperty('--season-glow', style.glow);
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

async function loadNebula() {
    const browser = document.getElementById('nebulacdn');
    browser.style.display = 'block';
    browser.innerHTML = '<input class="nebula-search" type="search" placeholder="search games..." aria-label="Search games"><div class="nebula-list">loading games...</div>';

    try {
        let catalog;
        let lastError;

        for (const source of nebulaSources) {
            try {
                const response = await fetch(source.catalog);
                if (!response.ok) {
                    throw new Error(`Catalog request failed: ${response.status}`);
                }

                catalog = await response.json();
                nebulaSource = source;
                break;
            } catch (error) {
                lastError = error;
            }
        }

        if (!catalog) {
            throw lastError || new Error('Could not load the game catalog');
        }

        nebulaGames = catalog.games || [];
        const search = browser.querySelector('.nebula-search');
        const list = browser.querySelector('.nebula-list');

        function renderGames(query = '') {
            const normalizedQuery = query.trim().toLowerCase();
            const games = nebulaGames
                .filter(game => game.name.toLowerCase().includes(normalizedQuery))
                .slice(0, 40);

            list.replaceChildren();

            if (games.length === 0) {
                list.textContent = 'no games found';
                return;
            }

            games.forEach(game => {
                const button = document.createElement('button');
                button.className = 'nebula-game';
                button.type = 'button';
                button.textContent = game.name;
                button.addEventListener('click', () => launchNebulaGame(game));
                list.appendChild(button);
            });
        }

        search.addEventListener('input', () => renderGames(search.value));
        renderGames();
    } catch (error) {
        browser.textContent = 'could not load games';
        console.error(error);
    }
}

async function launchNebulaGame(game) {
    const gameWindow = window.open('about:blank', '_blank');

    if (!gameWindow) {
        typeOutput('allow popups to launch a game');
        return;
    }

    gameWindow.document.write('<p>loading game...</p>');

    try {
        let gameCode;
        let gameUrl;
        let lastError;
        const sources = [nebulaSource, ...nebulaSources.filter(source => source !== nebulaSource)];

        for (const source of sources) {
            try {
                gameUrl = `${source.base}/${game.file}`;
                const response = await fetch(gameUrl);
                if (!response.ok) {
                    throw new Error(`Game request failed: ${response.status}`);
                }

                gameCode = await response.text();
                break;
            } catch (error) {
                lastError = error;
            }
        }

        if (!gameCode) {
            throw lastError || new Error('Could not load the selected game');
        }

        const baseUrl = gameUrl.slice(0, gameUrl.lastIndexOf('/') + 1);
        gameWindow.document.open();
        gameWindow.document.write(gameCode.replace('<head>', `<head><base href="${baseUrl}">`));
        gameWindow.document.close();
    } catch (error) {
        gameWindow.document.body.textContent = 'could not load this game';
        console.error(error);
    }
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
        typeOutput('<strong>commands:</strong><br>help<br/>projects<br/>about<br/>42<br/>jesus<br/><strong>you can type the help command and then the command you want to know more about for a description.');
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
    } else if (command === 'help help') {
        typeOutput('ur not funny lil bro')
    } else if (command === 'about') {
        typeOutput('hi, im luke. i like to code and do <a href="https://hackclub.com" target="_blank">hack club</a>. this is my website, made for <a href="https://thirdspace.hackclub.com" target="_blank">third space</a>. this website is mainly to showcase my *main* projects, skills, and general porfolio. i dont know how much ill update the projects section, but my <a href="https://github.com/GoatTech-42" target="_blank">github</a> is where you can get uptodate stuff. this website is coded in html, css, and js. ive been trying to learn them better.')
    } else if (command === 'help about') {
        typeOutput('this command tells you about me and about this website.')
    } else if (command === '42') {
        typeOutput('best number btw<br/>if you know you know')
    } else if (command === 'help help') {
        typeOutput('ur not funny lil bro')
    } else if (command === 'help 42') {
        typeOutput('just try it')
    } else if (command === 'help jesus') {
        typeOutput('jesus saves nothing else to it')
    } else if (command === 'jesus') {
        typeOutput('saves');
    } else if (command === 'nebulaaa') {
        typeOutput('congrats bro now your bum ahh can play unblocked games in class');
        loadNebula();
    }
}

