// ==================== Game State ====================
const state = {
    difficulty: 'normal',
    cards: [],
    flippedCards: [],
    matchedPairs: 0,
    totalPairs: 0,
    moves: 0,
    timer: 0,
    timerInterval: null,
    isLocked: false,
    gameStarted: false,
};

const DIFFICULTY_CONFIG = {
    easy:   { pairs: 6,  cols: 3, rows: 4, gridClass: 'grid-3x4' },
    normal: { pairs: 8,  cols: 4, rows: 4, gridClass: 'grid-4x4' },
    hard:   { pairs: 10, cols: 4, rows: 5, gridClass: 'grid-4x5' },
};

// ==================== Audio (Web Audio API) ====================
const AudioManager = (() => {
    let ctx = null;

    function getCtx() {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
        return ctx;
    }

    function playTone(freq, duration, type = 'sine', volume = 0.15) {
        try {
            const c = getCtx();
            const osc = c.createOscillator();
            const gain = c.createGain();
            osc.type = type;
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(volume, c.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
            osc.connect(gain);
            gain.connect(c.destination);
            osc.start();
            osc.stop(c.currentTime + duration);
        } catch (e) { /* silent fail */ }
    }

    return {
        flip() {
            playTone(800, 0.08, 'sine', 0.1);
            setTimeout(() => playTone(1200, 0.06, 'sine', 0.08), 40);
        },
        match() {
            playTone(523, 0.15, 'sine', 0.15);
            setTimeout(() => playTone(659, 0.15, 'sine', 0.15), 100);
            setTimeout(() => playTone(784, 0.2, 'sine', 0.15), 200);
        },
        mismatch() {
            playTone(300, 0.15, 'sawtooth', 0.08);
            setTimeout(() => playTone(250, 0.2, 'sawtooth', 0.08), 120);
        },
        win() {
            const notes = [523, 587, 659, 784, 880, 1047];
            notes.forEach((n, i) => {
                setTimeout(() => playTone(n, 0.25, 'sine', 0.12), i * 120);
            });
        }
    };
})();

// ==================== DOM References ====================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const screens = {
    start: $('#startScreen'),
    game: $('#gameScreen'),
    result: $('#resultScreen'),
};

// ==================== Screen Management ====================
function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
}

// ==================== Shuffle ====================
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ==================== Card Creation ====================
function createCards(pairCount) {
    // Use img1..img{pairCount}
    const imageIds = [];
    for (let i = 1; i <= pairCount; i++) {
        imageIds.push(i);
    }

    // Create pairs
    const cardData = [];
    imageIds.forEach(id => {
        cardData.push({ id, img: `images/img${id}.png` });
        cardData.push({ id, img: `images/img${id}.png` });
    });

    return shuffle(cardData);
}

// ==================== Render Board ====================
function renderBoard() {
    const config = DIFFICULTY_CONFIG[state.difficulty];
    const board = $('#gameBoard');
    board.innerHTML = '';
    board.className = 'game-board ' + config.gridClass;

    state.cards = createCards(config.pairs);
    state.totalPairs = config.pairs;
    state.matchedPairs = 0;
    state.moves = 0;
    state.timer = 0;
    state.flippedCards = [];
    state.isLocked = false;
    state.gameStarted = false;

    updateUI();

    state.cards.forEach((cardData, index) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.index = index;
        card.dataset.id = cardData.id;

        card.innerHTML = `
            <div class="card-face card-back">
                <span class="card-back-icon">💪</span>
                <span class="card-back-text">MuscleLove</span>
            </div>
            <div class="card-face card-front">
                <img src="${cardData.img}" alt="Muscle ${cardData.id}" loading="lazy">
            </div>
        `;

        card.addEventListener('click', () => onCardClick(card, index));
        board.appendChild(card);
    });
}

// ==================== Card Click ====================
function onCardClick(cardEl, index) {
    // Guards
    if (state.isLocked) return;
    if (cardEl.classList.contains('flipped')) return;
    if (cardEl.classList.contains('matched')) return;
    if (state.flippedCards.length >= 2) return;

    // Start timer on first click
    if (!state.gameStarted) {
        state.gameStarted = true;
        startTimer();
    }

    // Flip
    cardEl.classList.add('flipped');
    AudioManager.flip();
    state.flippedCards.push({ el: cardEl, index, id: state.cards[index].id });

    if (state.flippedCards.length === 2) {
        state.moves++;
        updateUI();
        checkMatch();
    }
}

// ==================== Match Check ====================
function checkMatch() {
    const [a, b] = state.flippedCards;

    if (a.id === b.id) {
        // Match!
        state.isLocked = true;
        setTimeout(() => {
            a.el.classList.add('matched', 'match-anim');
            b.el.classList.add('matched', 'match-anim');
            AudioManager.match();

            state.matchedPairs++;
            state.flippedCards = [];
            state.isLocked = false;
            updateUI();

            if (state.matchedPairs === state.totalPairs) {
                onWin();
            }
        }, 300);
    } else {
        // Mismatch
        state.isLocked = true;
        setTimeout(() => {
            a.el.classList.add('mismatch-anim');
            b.el.classList.add('mismatch-anim');
            AudioManager.mismatch();
        }, 400);

        setTimeout(() => {
            a.el.classList.remove('flipped', 'mismatch-anim');
            b.el.classList.remove('flipped', 'mismatch-anim');
            state.flippedCards = [];
            state.isLocked = false;
        }, 1000);
    }
}

// ==================== Timer ====================
function startTimer() {
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timer = 0;
    state.timerInterval = setInterval(() => {
        state.timer++;
        $('#timer').textContent = state.timer + '秒';
    }, 1000);
}

function stopTimer() {
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }
}

// ==================== UI Update ====================
function updateUI() {
    $('#timer').textContent = state.timer + '秒';
    $('#moves').textContent = state.moves + '手';
    $('#pairs').textContent = `${state.matchedPairs}/${state.totalPairs}`;
}

// ==================== Win ====================
function onWin() {
    stopTimer();
    AudioManager.win();

    setTimeout(() => {
        showResultScreen();
        spawnConfetti();
    }, 600);
}

function getStars(moves, difficulty) {
    const thresholds = {
        easy:   { three: 14, two: 22 },
        normal: { three: 20, two: 30 },
        hard:   { three: 26, two: 38 },
    };
    const t = thresholds[difficulty];
    if (moves <= t.three) return 3;
    if (moves <= t.two) return 2;
    return 1;
}

function showResultScreen() {
    const stars = getStars(state.moves, state.difficulty);

    // Stars display
    const starContainer = $('#starRating');
    starContainer.innerHTML = '';
    for (let i = 0; i < 3; i++) {
        const span = document.createElement('span');
        span.textContent = '⭐';
        if (i >= stars) span.classList.add('star-dim');
        starContainer.appendChild(span);
    }

    $('#resultTime').textContent = state.timer + '秒';
    $('#resultMoves').textContent = state.moves + '手';

    showScreen('result');
}

// ==================== Share ====================
function shareResult() {
    const stars = getStars(state.moves, state.difficulty);
    const starStr = '⭐'.repeat(stars);
    const diffLabel = { easy: 'Easy', normal: 'Normal', hard: 'Hard' }[state.difficulty];

    const text = `【筋肉神経衰弱】${state.timer}秒・${state.moves}手でクリア！${starStr}（${diffLabel}）\n#MuscleLove #筋肉神経衰弱\nhttps://www.patreon.com/cw/MuscleLove`;

    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'width=550,height=420');
}

// ==================== Confetti ====================
function spawnConfetti() {
    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);

    const colors = ['#ff2d7b', '#00e5ff', '#ffd700', '#ff6b9d', '#00e676'];

    for (let i = 0; i < 60; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.width = (Math.random() * 8 + 6) + 'px';
        confetti.style.height = (Math.random() * 8 + 6) + 'px';
        confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
        confetti.style.animationDuration = (Math.random() * 2 + 1.5) + 's';
        confetti.style.animationDelay = (Math.random() * 1) + 's';
        container.appendChild(confetti);
    }

    setTimeout(() => container.remove(), 4000);
}

// ==================== Event Listeners ====================
document.addEventListener('DOMContentLoaded', () => {
    // Difficulty buttons
    $$('.diff-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.diff-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.difficulty = btn.dataset.difficulty;
        });
    });

    // Start button
    $('#startBtn').addEventListener('click', () => {
        renderBoard();
        showScreen('game');
    });

    // Retry (in game)
    $('#retryBtn').addEventListener('click', () => {
        stopTimer();
        renderBoard();
    });

    // Retry (result screen)
    $('#retryBtn2').addEventListener('click', () => {
        renderBoard();
        showScreen('game');
    });

    // Back to title
    $('#backBtn').addEventListener('click', () => {
        stopTimer();
        showScreen('start');
    });

    // Share
    $('#shareBtn').addEventListener('click', shareResult);

    // Set default difficulty to hard (4x5)
    $$('.diff-btn').forEach(b => b.classList.remove('active'));
    const hardBtn = document.querySelector('.diff-btn[data-difficulty="hard"]');
    hardBtn.classList.add('active');
    state.difficulty = 'hard';
});
