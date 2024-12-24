let video, predictions = [];
let ball, paddle, blocks = [], powerUps = [];
let score = 0, gameStarted = false, round = 1, lives = 3;
let ballSpeedIncrement = 1.5, maxBallSpeed = 12, initialBallSpeed = 5, ballSpeed;
let blocksPerRound = 5, blocksCleared = 0, topScores = [];
let fingerPos = { x: 0, y: 0 };
let lastFingerPos = { x: 0, y: 0 };
let paddleSpeed = 8;
let smoothingFactor = 0.3;
let fingerToPaddleRatio = 2.5;
let startDelay = 1000;
let ballMoving = false;
let paused = false;
let backgroundAnimationAngle = 0;
let ballVisible = false;

const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.4,
  minTrackingConfidence: 0.4,
});

function setup() {
  createCanvas(640, 480).parent("canvas-container");
  video = createCapture(VIDEO, function() {
    console.log("Camera initialized successfully");
  });
  video.size(width, height);
  video.hide();
  hands.onResults(onResults);
  const camera = new Camera(video.elt, {
    onFrame: async () => {
      try {
        await hands.send({ image: video.elt });
      } catch (e) {
        console.error("Mediapipe Hands Error: ", e);
      }
    },
    width: width,
    height: height,
  });
  camera.start();
}

function draw() {
  if (!gameStarted || paused) return;
  background(20, 20, 50);
  drawBackgroundAnimation();
  displayHUD();

  if (ballMoving && ballVisible) {
    ball.update();
    ball.show();
  }
  paddle.update(fingerPos);
  paddle.show();

  blocks.forEach((block, index) => {
    if (ball.collidesWith(block)) {
      ball.reverseY();
      blocks.splice(index, 1);
      score += 10;
      blocksCleared++;
      if (random(1) < 0.2) spawnPowerUp(block.x, block.y);
    }
    block.show();
  });

  powerUps.forEach((powerUp, index) => {
    powerUp.update();
    powerUp.show();
    if (powerUp.collidesWith(paddle)) {
      powerUp.applyEffect();
      powerUps.splice(index, 1);
    }
  });

  handleRoundProgression();
  checkLives();
}

function onResults(results) {
  if (results.multiHandLandmarks.length > 0) {
    const indexFinger = results.multiHandLandmarks[0][8];
    fingerPos.x = width - indexFinger.x * width;
    fingerPos.y = indexFinger.y * height;
    lastFingerPos.x = fingerPos.x;
    lastFingerPos.y = fingerPos.y;
  } else {
    fingerPos.x += (lastFingerPos.x - fingerPos.x) * smoothingFactor;
    fingerPos.y += (lastFingerPos.y - fingerPos.y) * smoothingFactor;
  }
}

function startGame() {
  if (gameStarted) return;
  document.getElementById("status").innerText = "Loading game...";
  setTimeout(() => {
    setupGameElements();
    document.getElementById("status").innerText = "Game started!";
    gameStarted = true;
    ballMoving = false;
    loop();
    setTimeout(() => {
      ballMoving = true;
    }, 5000);
  }, startDelay);
}

function setupGameElements() {
  ball = new Ball(width / 2, height / 2, 10, initialBallSpeed);
  paddle = new Paddle(width / 2, height - 30, 100, 10);
  blocks = generateBlocks(blocksPerRound, 70, 30);
  score = 0;
  blocksCleared = 0;
  lives = 3;
  powerUps = [];
  ballSpeed = initialBallSpeed;
  round = 1;
  ballVisible = true;
}

function togglePause() {
  if (paused) {
    document.getElementById("status").innerText = "Game Resumed!";
    loop();
  } else {
    document.getElementById("status").innerText = "Game Paused";
    noLoop();
  }
  paused = !paused;
}

function generateBlocks(numBlocks, blockWidth, blockHeight) {
  let newBlocks = [];
  while (newBlocks.length < numBlocks) {
    const x = random(50, width - blockWidth - 50);
    const y = random(50, height / 3);
    const overlap = newBlocks.some(
      (block) => dist(x, y, block.x, block.y) < blockWidth
    );
    if (!overlap) {
      newBlocks.push(new Block(x, y, blockWidth, blockHeight));
    }
  }
  return newBlocks;
}

function handleRoundProgression() {
  if (blocks.length === 0) {
    round++;
    blocksCleared = 0;
    blocks = generateBlocks(blocksPerRound + round, 70, 30);
    if (round >= 5) {
      ballSpeed = min(ballSpeed * 1.3, maxBallSpeed);
    } else {
      ballSpeed = min(ballSpeed * ballSpeedIncrement, maxBallSpeed);
    }
    ball.increaseSpeed(ballSpeed);
    document.getElementById("status").innerText = `Round ${round}`;
  }
}

function checkLives() {
  if (ball.y > height) {
    lives--;
    resetBall();
    if (lives <= 0) {
      lives = 0;
      endGame();
    }
  }
}

function resetBall() {
  ball = new Ball(width / 2, height / 2, 10, ballSpeed);
}

function endGame() {
  noLoop();
  saveScore();
  displayLeaderboard();
  document.getElementById("status").innerText = "Dead! Your score: " + score;
  playGameOverSound();
}

function restart() {
  if (!gameStarted) return;
  setupGameElements();
  ballVisible = false;
  setTimeout(() => {
    ballVisible = true;
  }, 1000);
  loop();
  document.getElementById("status").innerText = "Game restarted!";
}

function displayHUD() {
  fill(255);
  textSize(24);
  if (lives > 0) {
    text(`Score: ${score} | Lives: ${lives} | Round: ${round}`, 10, 30);
  } else {
    text(`Score: ${score} | Dead`, 10, 30);
  }
}

function saveScore() {
  topScores.push(score);
  topScores = topScores.sort((a, b) => b - a).slice(0, 5);
}

function displayLeaderboard() {
  console.log("Top Scores:");
  topScores.forEach((score, index) => console.log(`${index + 1}. ${score}`));
}

function spawnPowerUp(x, y) {
  const effects = ["growPaddle", "slowBall", "doubleScore", "extraLife", "speedBoost"];
  const effect = random(effects);
  powerUps.push(new PowerUp(x, y, effect));
}

function drawBackgroundAnimation() {
  backgroundAnimationAngle += 0.1;
  push();
  translate(width / 2, height / 2);
  rotate(backgroundAnimationAngle);
  stroke(255, 100);
  strokeWeight(2);
  noFill();
  ellipse(0, 0, 300, 300);
  pop();
}

function playGameOverSound() {
  const sound = new Audio('missed.wav');
  sound.play();
}

class Ball {
  constructor(x, y, r, speed) {
    this.x = x;
    this.y = y;
    this.r = r;
    this.vx = random(-speed, speed);
    this.vy = speed;
  }

  update() {
    if (!ballMoving) return;
    this.x += this.vx;
    this.y += this.vy;
    if (this.x < this.r || this.x > width - this.r) this.vx *= -1;
    if (this.y < this.r) this.vy *= -1;
    if (
      this.y + this.r > paddle.y &&
      this.x > paddle.x &&
      this.x < paddle.x + paddle.width
    ) {
      let relativeHit = (this.x - paddle.x) / paddle.width;
      let angle = map(relativeHit, 0, 1, -PI / 4, PI / 4);
      this.vx = ballSpeed * cos(angle);
      this.vy = -ballSpeed * sin(angle);
      this.y = paddle.y - this.r;
    }
  }

  increaseSpeed(newSpeed) {
    const speedRatio = newSpeed / dist(0, 0, this.vx, this.vy);
    this.vx *= speedRatio;
    this.vy *= speedRatio;
  }

  show() {
    if (ballVisible) {
      fill(255, 0, 0);
      ellipse(this.x, this.y, this.r * 2);
    }
  }

  reverseY() {
    this.vy *= -1;
  }

  collidesWith(block) {
    return (
      this.x + this.r > block.x &&
      this.x - this.r < block.x + block.w &&
      this.y + this.r > block.y &&
      this.y - this.r < block.y + block.h
    );
  }
}

class Paddle {
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  update(fingerPos) {
    const targetX = constrain((fingerPos.x * fingerToPaddleRatio) - this.width / 2, 0, width - this.width);
    const targetY = constrain((fingerPos.y * fingerToPaddleRatio) - this.height / 2, 0, height - this.height);
    this.x += (targetX - this.x) * smoothingFactor;
    this.y += (targetY - this.y) * smoothingFactor;
  }

  show() {
    fill(255);
    rect(this.x, this.y, this.width, this.height);
  }

  grow() {
    this.width += 50;
    setTimeout(() => {
      this.width -= 50;
    }, 10000);
  }
}

class Block {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
  }

  show() {
    fill(random(100, 255), random(100, 255), random(100, 255));
    rect(this.x, this.y, this.w, this.h);
  }
}

class PowerUp {
  constructor(x, y, effect) {
    this.x = x;
    this.y = y;
    this.size = 20;
    this.effect = effect;
  }

  update() {
    this.y += 2;
  }

  show() {
    fill(255, 255, 0);
    ellipse(this.x, this.y, this.size);
  }

  collidesWith(paddle) {
    return (
      this.x > paddle.x &&
      this.x < paddle.x + paddle.width &&
      this.y + this.size > paddle.y &&
      this.y - this.size < paddle.y + paddle.height
    );
  }

  applyEffect() {
    if (this.effect === "growPaddle") paddle.grow();
    if (this.effect === "slowBall") {
      ball.vx *= 0.7;
      ball.vy *= 0.7;
    }
    if (this.effect === "doubleScore") {
      score *= 2;
    }
    if (this.effect === "extraLife") {
      lives++;
    }
    if (this.effect === "speedBoost") {
      paddleSpeed += 2;
      setTimeout(() => {
        paddleSpeed -= 2;
      }, 5000);
    }
  }
}