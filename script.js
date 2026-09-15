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

const season = getSeason();
const terminal = document.querySelector('.terminal');

if (season === 'winter') {
    terminal.style.borderColor = 'blue';
    terminal.style.color = 'blue';
} else if (season === 'spring') {
    terminal.style.borderColor = 'green';
    terminal.style.color = 'green';
} else if (season === 'summer') {
    terminal.style.borderColor = 'yellow';
    terminal.style.color = 'yellow';
} else {
    terminal.style.borderColor = 'orange';
    terminal.style.color = 'orange';
}