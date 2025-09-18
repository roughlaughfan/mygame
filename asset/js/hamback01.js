
// ========= 画像 =========
const IMG_PATHS = {
    player: "asset/images/player.png",
    candy: "asset/images/candy.png",
    donut: "asset/images/donut.png",
    bomb: "asset/images/bomb.png",
    heart: "asset/images/heart.png",
    heartEmpty: "asset/images/heart_empty.png",
    star: "asset/images/star.png"
};

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// ========= 音楽 =========
const sounds = {
    jump: new Audio("asset/sounds/jump.mp3"),
    damage: new Audio("asset/sounds/damage.mp3"),
    item: new Audio("asset/sounds/item.mp3"),
    heart: new Audio("asset/sounds/heart.mp3"),
    gameover: new Audio("asset/sounds/gameover.mp3"), // ゲームオーバー用
    clear: new Audio("asset/sounds/clear.mp3"),       // クリア用
    bgm: new Audio("asset/sounds/bgm.mp3"),
    bgm_easy: new Audio("asset/sounds/bgm.mp3"),
    bgm_normal: new Audio("asset/sounds/bgm.mp3"),
    bgm_hard: new Audio("asset/sounds/bgm.mp3"),
    star: new Audio("asset/sounds/star.mp3")
};

// 音を重ねて鳴らすために毎回 clone して再生
function playSound(audio) {
    const s = audio.cloneNode();
    s.volume = 0.4; // 音量調整
    s.play();
}

// ループ再生設定
sounds.bgm.loop = true;
sounds.bgm.volume = 0.1; // 音量調整（0.0〜1.0）

// ========= 背景管理 =========
let bgImages = [
    "asset/images/bg01.png",
    "asset/images/bg02.png",
    "asset/images/bg03.png",
    "asset/images/bg04.png",
    "asset/images/bg05.png"
]; // ランダムに使う背景画像

const bgLayer = document.getElementById("bgLayer");
let shuffledImages = [];
let firstBgUsed = false;

// シャッフル関数（Fisher–Yates）
function shuffleArray(array) {
    let arr = array.slice();
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function setBackgroundShuffledWithFlip() {
    let img;
    const setting = difficultySettings[currentDifficulty];

    if (!firstBgUsed) {
        // ★ 最初だけ難易度ごとの固定背景を使用
        img = setting.bgFirst;
        firstBgUsed = true;
    } else {
        // 画像が尽きたら再シャッフル
        if (shuffledImages.length === 0) {
            // 連続で同じ画像が出ないように再シャッフル
            do {
                shuffledImages = shuffleArray(bgImages);
            } while (shuffledImages[0] === lastUsedImage);
        }

        // 次の画像を取り出し
        img = shuffledImages.shift();
    }

    // 今回使った画像を記憶
    lastUsedImage = img;

    // 0 → 180度 回転（裏側へ）
    bgLayer.style.transform = "rotateY(180deg)";

    setTimeout(() => {
        // 画像を切り替え
        bgLayer.style.backgroundImage = `url(${img})`;

        // 360度まで回転して正面に戻す
        bgLayer.style.transform = "rotateY(360deg)";
    }, 300);
}
function resetBackgroundWithFlip() {
    // 0 → 180度 回転
    bgLayer.style.transform = "rotateY(180deg)";

    setTimeout(() => {
        // 裏側でデフォルト画像に切り替え
        bgLayer.style.backgroundImage = `url(${defaultBgPath})`

        // 360度に戻す
        bgLayer.style.transform = "rotateY(360deg)";
    }, 300);
}

// ========= グローバル =========
let player, items, score, lives, gameInterval, dropInterval, speedMultiplier, gameRunning = false;
let eventTimer, eventPhase = 0, katakanaIndex = 0;
const gravity = 1;
const difficultyDisplay = document.getElementById("difficultyDisplay");
let defaultBgPath = "";
let lastUsedImage = "";

// ========= プレイヤー =========
class Player {
    constructor() {
        this.x = canvas.width / 2 - 25;
        this.y = canvas.height - 60;
        this.width = 42; this.height = 50;
        this.dy = 0;
        this.jumpPower = -15;
        this.onGround = true;
        this.image = loadedImages.player || (function () { const _i = new Image(); _i.src = IMG_PATHS.player; return _i; })();
    }

    draw() { ctx.drawImage(this.image, this.x, this.y, this.width, this.height); }

    jump() {
        if (this.onGround) {
            this.dy = this.jumpPower;
            this.onGround = false;
            playSound(sounds.jump);
        }
    }

    update() {
        // 横移動（押しっぱなし対応）
        if (leftPressed) this.x = Math.max(0, this.x - 5);
        if (rightPressed) this.x = Math.min(canvas.width - this.width, this.x + 5);

        // 重力 & ジャンプ
        this.dy += gravity;
        this.y += this.dy;

        if (this.y + this.height >= canvas.height) {
            this.y = canvas.height - this.height;
            this.dy = 0;
            this.onGround = true;
        }

        this.draw();
    }
}
// ========= アイテム =========
class Item {
    constructor(type, x, y, speed = 3) {
        this.type = type;
        this.x = x; this.y = y;
        this.width = 30; this.height = 30;
        this.speed = speed * speedMultiplier;
        this.image = loadedImages[type] || (function () { const _i = new Image(); _i.src = IMG_PATHS[type]; return _i; })();
    }
    draw() { ctx.drawImage(this.image, this.x, this.y, this.width, this.height); }
    update() { this.y += this.speed; this.draw(); }
}

// ========= ハート =========
function updateHearts() {
    const heartsDiv = document.getElementById("hearts");
    heartsDiv.innerHTML = "";
    for (let i = 0; i < 3; i++) {
        const img = document.createElement("img");
        img.src = (i < lives) ? IMG_PATHS.heart : IMG_PATHS.heartEmpty;
        heartsDiv.appendChild(img);
    }
}

// ========= アイテム生成 =========
function spawnItem() {
    if (inKatakanaEvent) return; // ★ イベント③中は通常アイテム出さない
    const rand = Math.random(); let type;
    if (rand < 0.4) type = "candy"; else if (rand < 0.8) type = "donut"; else type = "bomb";
    items.push(new Item(type, Math.random() * (canvas.width - 30), -30));
}

// ========= 特殊パターン =========
function spawnPatternRow() {
    const cols = Math.floor(canvas.width / 30);
    const hole = Math.floor(Math.random() * (cols - 2)); // 3マス分空けるので -2
    for (let i = 0; i < cols; i++) {
        if (i < hole || i > hole + 2) {  // 3マス連続を穴にする
            items.push(new Item("bomb", i * 30, -30, 3));
        }
    }
}

// カタカナ形状定義（7×7ドット、1マス=30px）
const katakanaPatterns = {
    "フ": [
        [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1],
        [5, 2],
        [5, 3],
        [4, 4],
        [3, 5],
        [1, 6], [2, 6]
    ].map(([x, y]) => [x * 30, y * 30]),

    "ジ": [
        [0, 0], [2, 0], [4, 0], [6, 0],
        [1, 1],
        [0, 2], [4, 2],
        [1, 3], [5, 3],
        [4, 4],
        [3, 5],
        [0, 6], [1, 6], [2, 6]
    ].map(([x, y]) => [x * 30, y * 30]),

    "サ": [
        [2, 0], [4, 0],
        [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1],
        [2, 2], [4, 2],
        [2, 3], [4, 3],
        [5, 4],
        [4, 5],
        [2, 6], [3, 6]
    ].map(([x, y]) => [x * 30, y * 30]),

    "キ": [
        [3, 0],
        [1, 1], [2, 1], [3, 1], [4, 1], [5, 1],
        [3, 2],
        [3, 3],
        [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4],
        [3, 5],
        [3, 6]
    ].map(([x, y]) => [x * 30, y * 30]),

    "ミ": [
        [1, 0], [2, 0], [3, 0],
        [4, 1], [5, 1],
        [2, 2],
        [3, 3], [4, 3],
        [1, 5], [2, 5], [3, 5],
        [4, 6], [5, 6]
    ].map(([x, y]) => [x * 30, y * 30]),

    "ク": [
        [2, 0],
        [2, 1], [3, 1], [4, 1], [5, 1],
        [1, 2], [5, 2],
        [0, 3], [6, 3],
        [4, 4],
        [3, 5],
        [1, 6], [2, 6]
    ].map(([x, y]) => [x * 30, y * 30]),

    "オ": [
        [4, 0],
        [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1],
        [4, 2],
        [3, 3], [4, 3],
        [2, 4], [4, 4],
        [0, 5], [1, 5], [4, 5],
        [3, 6], [4, 6]
    ].map(([x, y]) => [x * 30, y * 30]),

    "タ": [
        [2, 0],
        [2, 1], [3, 1], [4, 1], [5, 1],
        [1, 2], [5, 2],
        [0, 3], [2, 3], [4, 3], [6, 3],
        [4, 4],
        [3, 5],
        [1, 6], [2, 6]
    ].map(([x, y]) => [x * 30, y * 30]),

    "ン": [
        [1, 0],
        [2, 1],
        [6, 2],
        [6, 3],
        [5, 4],
        [4, 5],
        [1, 6], [2, 6], [3, 6]
    ].map(([x, y]) => [x * 30, y * 30]),

    "ョ": [
        [1, 2], [2, 2], [3, 2], [4, 2],
        [4, 3],
        [2, 4], [3, 4], [4, 4],
        [4, 5],
        [1, 6], [2, 6], [3, 6], [4, 6]
    ].map(([x, y]) => [x * 30, y * 30]),

    "ウ": [
        [2, 0],
        [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1],
        [0, 2], [5, 2],
        [5, 3],
        [4, 4],
        [3, 5],
        [1, 6], [2, 6]
    ].map(([x, y]) => [x * 30, y * 30]),

    "ビ": [
        [0, 0], [3, 0], [5, 0], [7, 0],
        [0, 1],
        [0, 2], [3, 2], [4, 2],
        [0, 3], [1, 3], [2, 3], [3, 3],
        [0, 4],
        [0, 5],
        [1, 6], [2, 6], [3, 6], [4, 6], [5, 6]
    ].map(([x, y]) => [x * 30, y * 30]),

    "メ": [
        [5, 0],
        [5, 1],
        [1, 2], [2, 2], [3, 2], [5, 2],
        [4, 3],
        [3, 4], [5, 4],
        [2, 5], [5, 5],
        [0, 6], [1, 6]
    ].map(([x, y]) => [x * 30, y * 30]),

    "デ": [
        [1, 0], [2, 0], [3, 0], [4, 0], [6, 0],
        [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2],
        [3, 3],
        [3, 4],
        [3, 5],
        [2, 6]
    ].map(([x, y]) => [x * 30, y * 30]),

    "ト": [
        [2, 0],
        [2, 1],
        [2, 2],
        [2, 3], [3, 3], [4, 3],
        [2, 4], [4, 4],
        [2, 5],
        [2, 6]
    ].map(([x, y]) => [x * 30, y * 30]),
    "チ": [
        [4, 0], [5, 0],
        [1, 1], [2, 1], [3, 1],
        [3, 2],
        [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3],
        [3, 4],
        [3, 5],
        [2, 6]
    ].map(([x, y]) => [x * 30, y * 30]),
    "ャ": [
        [2, 2],
        [2, 3], [3, 3], [4, 3], [5, 3],
        [2, 4], [5, 4],
        [2, 5], [5, 5],
        [3, 6], [4, 6], [5, 6]
    ].map(([x, y]) => [x * 30, y * 30]),
    "セ": [
        [2, 0],
        [2, 1],
        [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2],
        [2, 3], [6, 3],
        [2, 4], [5, 4],
        [2, 5],
        [3, 6], [4, 6], [5, 6], [6, 6]
    ].map(([x, y]) => [x * 30, y * 30]),
    "イ": [
        [5, 0],
        [4, 1],
        [3, 2],
        [2, 3], [3, 3],
        [0, 4], [1, 4], [3, 4],
        [3, 5],
        [3, 6]
    ].map(([x, y]) => [x * 30, y * 30]),
    "2": [
        [1, 0], [2, 0], [3, 0], [4, 0], [5, 0],
        [0, 1], [6, 1],
        [6, 2],
        [3, 3], [4, 3],
        [1, 4], [2, 4],
        [0, 5],
        [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6]
    ].map(([x, y]) => [x * 30, y * 30]),
    "0": [
        [1, 0], [2, 0], [3, 0], [4, 0], [5, 0],
        [0, 1], [6, 1],
        [0, 2], [4, 2], [5, 2],
        [0, 3], [1, 3], [4, 3], [5, 3],
        [0, 4], [1, 4], [6, 4],
        [0, 5], [6, 5],
        [1, 6], [2, 6], [3, 6], [4, 6], [5, 6]
    ].map(([x, y]) => [x * 30, y * 30]),
    "5": [
        [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0],
        [0, 1],
        [0, 2], [1, 2], [2, 2], [3, 2], [4, 2],
        [0, 3], [5, 3],
        [5, 4],
        [0, 5], [5, 5],
        [1, 6], [2, 6], [3, 6], [4, 6], [5, 6]
    ].map(([x, y]) => [x * 30, y * 30]),
    "ポ": [
        [3, 0], [5, 0],
        [3, 1], [4, 1], [6, 1],
        [0, 2], [1, 2], [2, 2], [3, 2], [5, 2],
        [3, 3],
        [1, 4], [3, 4], [5, 4],
        [0, 5], [3, 5], [6, 5],
        [2, 6], [3, 6],
    ].map(([x, y]) => [x * 30, y * 30]),
    "ス": [
        [1, 1], [2, 1], [3, 1], [4, 1], [5, 1],
        [5, 2],
        [4, 3],
        [4, 4],
        [2, 5], [3, 5], [5, 5],
        [0, 6], [1, 6], [6, 6]
    ].map(([x, y]) => [x * 30, y * 30]),
    "ー": [
        [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3]
    ].map(([x, y]) => [x * 30, y * 30]),
    "ハ": [
        [2, 1], [4, 1],
        [2, 2], [5, 2],
        [2, 3], [5, 3],
        [1, 4], [6, 4],
        [1, 5], [6, 5],
        [0, 6], [6, 6]
    ].map(([x, y]) => [x * 30, y * 30]),
    "ュ": [
        [2, 3], [3, 3], [4, 3],
        [4, 4],
        [4, 5],
        [1, 6], [2, 6], [3, 6], [4, 6], [5, 6]
    ].map(([x, y]) => [x * 30, y * 30]),
    "シ": [
        [1, 0], [6, 0],
        [2, 1], [6, 1],
        [1, 2], [6, 2],
        [2, 3], [6, 3],
        [5, 4],
        [4, 5],
        [1, 6], [2, 6], [3, 6],
    ].map(([x, y]) => [x * 30, y * 30]),
    "ブ": [
        [3, 0], [5, 0],
        [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1],
        [5, 2],
        [5, 3],
        [4, 4],
        [3, 5],
        [1, 6], [2, 6],
    ].map(([x, y]) => [x * 30, y * 30]),
    "ヤ": [
        [2, 0],
        [2, 1], [4, 1], [5, 1], [6, 1],
        [0, 2], [1, 2], [2, 2], [3, 2], [6, 2],
        [2, 3], [5, 3],
        [3, 4],
        [3, 5],
        [3, 6]
    ].map(([x, y]) => [x * 30, y * 30]),
    "エ": [
        [1, 1], [2, 1], [3, 1], [4, 1], [5, 1],
        [3, 2],
        [3, 3],
        [3, 4],
        [0, 5], [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5]
    ].map(([x, y]) => [x * 30, y * 30]),
    "コ": [
        [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1],
        [5, 2],
        [5, 3],
        [5, 4],
        [5, 5],
        [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6]
    ].map(([x, y]) => [x * 30, y * 30]),
    "ナ": [
        [3, 0],
        [3, 1],
        [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2],
        [3, 3],
        [3, 4],
        [2, 5],
        [1, 6],
    ].map(([x, y]) => [x * 30, y * 30]),
};

// ========= 出す順番（単語リスト） =========
let katakanaWords = [
    ["フ", "ジ", "サ", "キ", "ミ", "ク"],
    ["タ", "ン", "ジ", "ョ", "ウ", "ビ"],
    ["オ", "メ", "デ", "ト", "ウ"]
];

let katakanaPatternIndex = 0; // どの単語を出すか管理

function spawnKatakana(char, isLastChar = false) {
    const pattern = katakanaPatterns[char];
    const startX = canvas.width / 2 - 90; // 中央寄せ

    // ★ ランダムでハートを置く位置を決める（ただし lives < 3 の場合のみ）
    let heartIndex = -1;
    if (isLastChar && lives < 3) {
        heartIndex = Math.floor(Math.random() * pattern.length);
    }

    pattern.forEach(([dx, dy], idx) => {
        let type = "star"; // 基本は星
        if (idx === heartIndex) {
            type = "heart";
        }
        items.push(new Item(type, startX + dx, dy - 100, 3));
    });
}
// ========= 難易度設定 =========
const difficultySettings = {
    1: {
        minSpeed: 5,
        maxSpeed: 9,
        speedInterval: 20,
        dropIntervalBase: 400, // 👈 基準間隔（ms）を追加
        dropIntervalReduction: 200, // 👈 減少量（ms）を追加
        bgFirst: "asset/images/hint_bg.png",
        bgImages: ["asset/images/bg01.png", "asset/images/bg02.png", "asset/images/bg03.png"],
        bgm: sounds.bgm_easy,
        defaultBg: "asset/images/default_bg.png",
        katakanaWords: [
            ["フ", "ジ", "サ", "キ", "ミ", "ク"],
            ["セ", "イ", "タ", "ン", "サ", "イ"],
            ["2", "0", "2", "5"],
            ["ミ", "ク", "チ", "ャ", "ン"],
            ["オ", "タ", "ン", "ジ", "ョ", "ウ", "ビ"],
            ["オ", "メ", "デ", "ト", "ウ"]
        ]
    },
    2: {
        minSpeed: 4,
        maxSpeed: 8,
        speedInterval: 20,
        dropIntervalBase: 600,
        dropIntervalReduction: 200,
        bgFirst: "asset/images/hint_bg02.png",
        bgImages: ["asset/images/bg04.png", "asset/images/bg05.png", "asset/images/bg06.png"],
        bgm: sounds.bgm_normal,
        defaultBg: "asset/images/default_bg02.png",
        katakanaWords: [
            ["ミ", "ク", "チ", "ャ", "ン"],
            ["オ", "タ", "ン", "ジ", "ョ", "ウ", "ビ"],
            ["オ", "メ", "デ", "ト", "ウ"],
            ["フ", "ジ", "サ", "キ", "ミ", "ク"],
            ["セ", "イ", "タ", "ン", "サ", "イ"],
            ["2", "0", "2", "5"],
        ]
    },
    3: {
        minSpeed: 3,
        maxSpeed: 7,
        speedInterval: 20,
        dropIntervalBase: 1000,
        dropIntervalReduction: 200,
        bgFirst: "asset/images/hint_bg03.png",
        bgImages: ["asset/images/bg07.png", "asset/images/bg08.png", "asset/images/bg09.png"],
        bgm: sounds.bgm_hard,
        defaultBg: "asset/images/default_bg03.png",
        katakanaWords: [
            ["ポ", "ス", "タ", "ー", "ハ"],
            ["ト", "ウ", "キ", "ュ", "ウ"],
            ["シ", "ブ", "ヤ", "エ", "キ"],
            ["コ", "ウ", "ナ", "イ"]
        ]
    }
};

// ========= イベント進行 =========
let eventTimers = []; // タイマー管理用
let inKatakanaEvent = false; // ★ フラグ追加
let currentDifficulty = 1; // デフォルト

function scheduleEvents() {
    clearEventTimers(); // ← 念のため最初でクリア

    const runEvent = () => {
        eventPhase++;
        if (eventPhase % 3 === 1) {
            // ① 横一列
            spawnPatternRow();
            eventTimers.push(setTimeout(runEvent, 20000)); // 20秒後に②
        }
        else if (eventPhase % 3 === 2) {
            // ② 3回連続（5秒ごと）
            let count = 0;
            const int = setInterval(() => {
                spawnPatternRow();
                if (++count >= 3) {
                    clearInterval(int);
                    eventTimers.push(setTimeout(runEvent, 20000)); // 20秒後に③
                }
            }, 5000);
            eventTimers.push(int); // intervalも管理
        }
        else if (eventPhase % 3 === 0) {
            // ③ カタカナ文字（順番に単語を使用）
            inKatakanaEvent = true; // ★ 開始時にフラグON
            katakanaIndex = 0;
            const chars = katakanaWords[katakanaPatternIndex];

            // ★背景をランダムにフリップ変更
            setBackgroundShuffledWithFlip();

            const nextChar = () => {
                if (!gameRunning) return;
                if (katakanaIndex < chars.length) {
                    const isLastChar = (katakanaIndex === chars.length - 1);
                    spawnKatakana(chars[katakanaIndex], isLastChar); // ←追加
                    katakanaIndex++;
                    const t = setTimeout(nextChar, 2000); // ★ 変数に入れる
                    eventTimers.push(t);                  // ★ 管理リストに追加
                } else {
                    // ★ イベント③終了 → フラグOFF
                    inKatakanaEvent = false;

                    const resetT = setTimeout(() => {
                        resetBackgroundWithFlip();

                        minSpeed += 1;
                        speedLevel = minSpeed;
                        adjustDropRate(true);

                        gameStartTime = Date.now();
                    }, 2000);
                    eventTimers.push(resetT);

                    const t = setTimeout(runEvent, 10000); // ★ 変数に入れる
                    eventTimers.push(t);                   // ★ 管理リストに追加
                    katakanaPatternIndex = (katakanaPatternIndex + 1) % katakanaWords.length;
                }
            };
            nextChar();
        }
    };

    // 初回は20秒待ってから①を発生
    eventTimers.push(setTimeout(runEvent, 20000));
}



// ========= ゲーム進行 =========
let gameStartTime = Date.now();
let speedLevel = 3;  // 初期スピード
let minSpeed = 3;     // 初期値
let maxSpeed = 7;     // 上限スピード
let speedInterval = 20; // 上昇間隔（秒）

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    player.update();

    difficultyDisplay.textContent = "Level: " + currentDifficulty;

    // 経過時間でスピード調整
    const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
    let newSpeed = minSpeed + Math.floor(elapsed / speedInterval);

    if (newSpeed !== speedLevel) {
        speedLevel = newSpeed;
        adjustDropRate(); // 出現間隔も調整
    }

    items.forEach((item, i) => {
        item.speed = speedLevel * (downPressed ? 2 : 1);  // ★ 下キーで倍速
        item.update();
        if (collision(player, item)) {
            if (item.type === "candy") {
                score += 3;
                playSound(sounds.item);
            } else if (item.type === "donut") {
                score += 9;
                playSound(sounds.item);
            } else if (item.type === "star") {
                score += 50000000;
                playSound(sounds.star);
            } else if (item.type === "heart") {
                if (lives < 3) { // ★ 最大値以上は増えない
                    lives++;
                    updateHearts();
                }
                playSound(sounds.heart);
                items.splice(i, 1);
            } else {
                lives--;
                updateHearts();
                playSound(sounds.damage);
                if (lives <= 0) endGame("ゲームオーバー");
            }
            items.splice(i, 1);
        } else if (item.y > canvas.height) {
            items.splice(i, 1);
        }
    });

    // スコア更新
    document.getElementById("score").textContent = "Score: " + score;

    // ★ クリア判定
    if (score >= 10000000000) {
        endGame("100億点達成！");
    }
}

function collision(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function clearEventTimers() {
    eventTimers.forEach(t => {
        clearTimeout(t);
        clearInterval(t);
    });
    eventTimers = [];
}

// ========= ゲーム開始/終了 =========
function initGame() {
    player = new Player(); items = []; score = 0; lives = 3; speedMultiplier = 1;
    eventPhase = 0; katakanaIndex = 0;
    katakanaPatternIndex = 0; // ← これも忘れず
    inKatakanaEvent = false;  // ← 念のためリセット
    clearEventTimers();       // ← タイマー完全消去

    document.getElementById("score").textContent = "Score: 0";
    updateHearts();

    // 両方の画面を消す
    document.getElementById("gameOverScreen").style.display = "none";
    document.getElementById("clearScreen").style.display = "none";
}

let currentBgm = null;

function startGame() {
    document.getElementById("startScreen").style.display = "none";
    document.getElementById("gameOverScreen").style.display = "none";
    document.getElementById("clearScreen").style.display = "none";
    document.getElementById("difficultyModal").style.display = "none";
    if ("ontouchstart" in window || navigator.maxTouchPoints > 0) {
        document.getElementById("controls").style.display = "flex";
    }
    // 🎯 先に難易度設定を反映
    const setting = difficultySettings[currentDifficulty];
    minSpeed = setting.minSpeed;
    speedLevel = setting.minSpeed;
    maxSpeed = setting.maxSpeed;
    bgImages = setting.bgImages;
    sounds.bgm = setting.bgm;
    katakanaWords = setting.katakanaWords;

    // 🎯 ここを追加
    defaultBgPath = setting.defaultBg;
    bgLayer.style.backgroundImage = `url(${defaultBgPath})`;
    shuffledImages = shuffleArray(bgImages); // 新しい難易度の画像をシャッフル
    firstBgUsed = false; // フラグをリセット

    // 🎯 難易度が反映された状態で初期化
    initGame();
    gameRunning = true;
    gameStartTime = Date.now();

    gameInterval = setInterval(gameLoop, 30);
    adjustDropRate(); // 最初の出現間隔をセット

    clearEventTimers();   // ← 前回のタイマーを必ず削除
    scheduleEvents();
    // BGM切替
    if (currentBgm) {
        currentBgm.pause(); // 既存のBGMを停止
    }
    currentBgm = setting.bgm; // 新しいBGMをセット

    if (currentBgm) {
        // BGMのループと音量を設定
        currentBgm.loop = true;
        currentBgm.volume = 0.1; // 音量調整（0.0〜1.0）

        currentBgm.currentTime = 0;
        currentBgm.play();
    }
}

function endGame(status = "ゲームオーバー") {
    gameRunning = false;
    clearInterval(gameInterval);
    clearInterval(dropInterval);
    clearEventTimers();

    // ★ イベントタイマーを全停止
    eventTimers.forEach(t => clearTimeout(t));
    eventTimers = [];

    document.getElementById("controls").style.display = "none";

    // BGM停止
    if (currentBgm) {
        currentBgm.pause();
    }

    // 効果音
    if (status === "ゲームクリア！") {
        playSound(sounds.clear);
        document.getElementById("clearTitle").textContent = status;
        document.getElementById("finalClearScore").textContent = "Score: " + score;
        document.getElementById("clearScreen").style.display = "flex";
    } else {
        playSound(sounds.gameover);
        document.getElementById("endTitle").textContent = status;
        document.getElementById("finalScore").textContent = "Score: " + score;
        document.getElementById("gameOverScreen").style.display = "flex";
    }

    // ★ X共有リンクを生成
    const gameUrl = encodeURIComponent("https://www.google.com/?hl=ja"); // ゲームを公開するURLに置き換えてください
    const scoreMessage = `牡蠣サーモンキャッチゲームでスコア${score}点を達成しました！`;
    const hashtags = ["牡蠣サーモンキャッチゲーム", "藤崎団活動報告", "藤崎未来生誕祭2025"];
    const formattedHashtags = hashtags.map(tag => `#${tag}`).join(" ");
    const shareText = encodeURIComponent(scoreMessage + "\n" + formattedHashtags);

    // アプリ用とWeb版用のURLを両方生成
    const shareUrlApp = `twitter://post?text=${shareText}&url=${gameUrl}`;
    const shareUrlWeb = `https://twitter.com/intent/tweet?text=${shareText}&url=${gameUrl}`;

    // ボタンにクリックイベントを設定
    const shareBtn = document.getElementById("shareBtn");
    const shareBtnTop = document.getElementById("shareBtn_top");

    // アプリがあればアプリで、なければWeb版で開く
    shareBtn.onclick = () => {
        // PCやアプリがない場合に備え、まずWeb版を開く
        const newWindow = window.open(shareUrlWeb, "_blank");

        // スマホでアプリがインストールされていれば、そちらを優先
        if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) && newWindow) {
            // アプリへのリダイレクトを試行
            newWindow.location.href = shareUrlApp;
        }
    };

    shareBtnTop.onclick = () => {
        const newWindow = window.open(shareUrlWeb, "_blank");
        if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) && newWindow) {
            newWindow.location.href = shareUrlApp;
        }
    };
}

// ========= アイテム出現間隔調整 =========
function adjustDropRate(reset = false) {
    clearInterval(dropInterval);
    const setting = difficultySettings[currentDifficulty]; // 👈 難易度設定を取得

    if (reset) {
        // 初期の出現間隔に戻す（例: 1000ms）
        dropInterval = setInterval(spawnItem, setting.dropIntervalBase); // 👈 難易度ごとの基準間隔を使用
    } else {
        // 🎯 新しい計算式
        const interval = Math.max(300, setting.dropIntervalBase / speedLevel);
        dropInterval = setInterval(spawnItem, interval);

    }
}

// ========= 操作 =========
let leftPressed = false;
let rightPressed = false;
let downPressed = false;

document.addEventListener("keydown", e => {
    if (!gameRunning) return;

    if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") leftPressed = true;
    if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") rightPressed = true;
    if (e.key === "ArrowDown" || e.key.toLowerCase() === "s") downPressed = true;
    if (e.key === " " || e.key === "ArrowUp" || e.key.toLowerCase() === "w") player.jump();
});

document.addEventListener("keyup", e => {
    if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") leftPressed = false;
    if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") rightPressed = false;
    if (e.key === "ArrowDown" || e.key.toLowerCase() === "s") downPressed = false;
});


// ========= スマホ操作（マルチタッチ対応） =========
let activeTouches = {
    left: null,
    right: null
};

document.getElementById("leftBtn").addEventListener("touchstart", e => {
    e.preventDefault();
    if (!gameRunning) return;
    if (activeTouches.left === null) {
        activeTouches.left = e.changedTouches[0].identifier;
        leftPressed = true;
    }
});

document.getElementById("leftBtn").addEventListener("touchend", e => {
    [...e.changedTouches].forEach(touch => {
        if (touch.identifier === activeTouches.left) {
            leftPressed = false;
            activeTouches.left = null;
        }
    });
});

document.getElementById("rightBtn").addEventListener("touchstart", e => {
    e.preventDefault();
    if (!gameRunning) return;
    if (activeTouches.right === null) {
        activeTouches.right = e.changedTouches[0].identifier;
        rightPressed = true;
    }
});

document.getElementById("rightBtn").addEventListener("touchend", e => {
    [...e.changedTouches].forEach(touch => {
        if (touch.identifier === activeTouches.right) {
            rightPressed = false;
            activeTouches.right = null;
        }
    });
});

// ジャンプは単発なので単純でOK
document.getElementById("jumpBtn").addEventListener("touchstart", e => {
    e.preventDefault();
    if (gameRunning) player.jump();
});

// ========= ボタン =========
const startBtn = document.getElementById("startBtn");
const startBtnText = document.getElementById("startBtnText");
const difficultyModal = document.getElementById("difficultyModal");
let isModalOpen = false;

// 「遊ぶ」/「閉じる」ボタンのトグル機能
startBtn.addEventListener("click", () => {
    if (isModalOpen) {
        // モーダルが開いている場合 → 閉じる
        difficultyModal.style.display = "none";
        startBtnText.textContent = "遊ぶ";
        isModalOpen = false;
    } else {
        // モーダルが閉じている場合 → 開く
        difficultyModal.style.display = "block";
        startBtnText.textContent = "閉じる";
        isModalOpen = true;
    }
});

// 難易度ボタン押したらゲーム開始
document.querySelectorAll(".diffBtn").forEach(btn => {
    btn.addEventListener("click", e => {
        currentDifficulty = parseInt(e.target.dataset.level);
        difficultyModal.style.display = "none";
        startBtnText.textContent = "遊ぶ"; // ゲーム開始時はボタンを「遊ぶ」に戻す
        isModalOpen = false;
        startGame();
    });
});

document.getElementById("retryBtn").onclick = startGame;
document.getElementById("retryBtn_agein").onclick = startGame;
document.getElementById("backToStartBtn").onclick = () => {
    document.getElementById("gameOverScreen").style.display = "none";
    document.getElementById("startScreen").style.display = "flex";
};
document.getElementById("backToStartBtn_top").onclick = () => {
    document.getElementById("clearScreen").style.display = "none";
    document.getElementById("startScreen").style.display = "flex";
};


// ======== 画像プリロード/CACHE ========
const loadedImages = {};
let preloadDone = false;
let preloadProgressCallback = null; // 任意で進捗表示に使える

function preloadImages(onComplete, onProgress) {
    preloadProgressCallback = onProgress || null;
    const keys = Object.keys(IMG_PATHS);
    if (keys.length === 0) {
        preloadDone = true;
        if (onComplete) onComplete();
        return;
    }
    let loaded = 0;
    keys.forEach(key => {
        const img = new Image();
        img.src = IMG_PATHS[key];
        img.onload = img.onerror = () => {
            loadedImages[key] = img;
            loaded++;
            if (preloadProgressCallback) {
                try { preloadProgressCallback(loaded / keys.length); } catch (e) { }
            }
            if (loaded === keys.length) {
                preloadDone = true;
                if (onComplete) onComplete();
            }
        };
    });
}

window.addEventListener("load", () => {
    try {
        preloadImages();
    } catch (e) { console.warn("preloadImages failed:", e); }
});

