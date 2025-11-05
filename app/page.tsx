"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type GridCell = { x: number; y: number };

type Direction = "up" | "down" | "left" | "right";

type GameStatus = "idle" | "running" | "over";

const BOARD_SIZE = 20;
const LOCAL_STORAGE_KEY = "snakeHighScore";

function getRandomEmptyCell(occupied: Set<string>): GridCell {
  while (true) {
    const x = Math.floor(Math.random() * BOARD_SIZE);
    const y = Math.floor(Math.random() * BOARD_SIZE);
    const key = `${x},${y}`;
    if (!occupied.has(key)) return { x, y };
  }
}

export default function Page() {
  const [snakeSegments, setSnakeSegments] = useState<GridCell[]>(() => [
    { x: Math.floor(BOARD_SIZE / 2) - 1, y: Math.floor(BOARD_SIZE / 2) },
    { x: Math.floor(BOARD_SIZE / 2), y: Math.floor(BOARD_SIZE / 2) },
  ]);
  const [movementDirection, setMovementDirection] = useState<Direction>("right");
  const [foodCell, setFoodCell] = useState<GridCell>(() => ({ x: 5, y: 5 }));
  const [gameStatus, setGameStatus] = useState<GameStatus>("idle");
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(0);

  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
  const pendingDirectionRef = useRef<Direction | null>(null);

  const snakeSet = useMemo(() => {
    const s = new Set<string>();
    for (const seg of snakeSegments) s.add(`${seg.x},${seg.y}`);
    return s;
  }, [snakeSegments]);

  // Initialize food and high score
  useEffect(() => {
    const saved = Number(localStorage.getItem(LOCAL_STORAGE_KEY) || 0);
    if (!Number.isNaN(saved)) setHighScore(saved);
    // Ensure food not on snake at first render
    setFoodCell(() => getRandomEmptyCell(snakeSet));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startGame = useCallback(() => {
    const initialSnake: GridCell[] = [
      { x: Math.floor(BOARD_SIZE / 2) - 1, y: Math.floor(BOARD_SIZE / 2) },
      { x: Math.floor(BOARD_SIZE / 2), y: Math.floor(BOARD_SIZE / 2) },
    ];
    setSnakeSegments(initialSnake);
    setMovementDirection("right");
    const occupied = new Set(initialSnake.map((c) => `${c.x},${c.y}`));
    setFoodCell(getRandomEmptyCell(occupied));
    setScore(0);
    setGameStatus("running");
  }, []);

  const endGame = useCallback(() => {
    setGameStatus("over");
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem(LOCAL_STORAGE_KEY, String(score));
    }
  }, [score, highScore]);

  const step = useCallback(() => {
    setSnakeSegments((currentSnake) => {
      if (currentSnake.length === 0) return currentSnake;

      // Apply any buffered direction (prevents double-turn bugs per tick)
      if (pendingDirectionRef.current) {
        setMovementDirection(pendingDirectionRef.current);
        pendingDirectionRef.current = null;
      }

      const head = currentSnake[currentSnake.length - 1];
      let nextHead: GridCell = head;
      if (movementDirection === "up") nextHead = { x: head.x, y: head.y - 1 };
      if (movementDirection === "down") nextHead = { x: head.x, y: head.y + 1 };
      if (movementDirection === "left") nextHead = { x: head.x - 1, y: head.y };
      if (movementDirection === "right") nextHead = { x: head.x + 1, y: head.y };

      // Collisions with walls
      if (
        nextHead.x < 0 ||
        nextHead.y < 0 ||
        nextHead.x >= BOARD_SIZE ||
        nextHead.y >= BOARD_SIZE
      ) {
        endGame();
        return currentSnake;
      }

      // Collisions with self
      const occupied = new Set(currentSnake.map((c) => `${c.x},${c.y}`));
      if (occupied.has(`${nextHead.x},${nextHead.y}`)) {
        endGame();
        return currentSnake;
      }

      const willEat = nextHead.x === foodCell.x && nextHead.y === foodCell.y;
      const newSnake = [...currentSnake, nextHead];
      if (!willEat) newSnake.shift();

      if (willEat) {
        setScore((s) => s + 1);
        const newOccupied = new Set(newSnake.map((c) => `${c.x},${c.y}`));
        setFoodCell(getRandomEmptyCell(newOccupied));
      }

      return newSnake;
    });
  }, [movementDirection, foodCell, endGame]);

  // Dynamic speed: faster as score increases
  const speedMs = useMemo(() => {
    const base = 140; // base speed
    const speedup = Math.min(80, Math.floor(score / 5) * 10);
    return Math.max(60, base - speedup);
  }, [score]);

  useEffect(() => {
    if (gameStatus !== "running") {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
      return;
    }
    intervalIdRef.current = setInterval(step, speedMs);
    return () => {
      if (intervalIdRef.current) clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    };
  }, [step, speedMs, gameStatus]);

  // Keyboard controls
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (gameStatus === "idle" && (e.key === " " || e.key === "Enter")) {
        startGame();
        return;
      }
      if (gameStatus !== "running") return;
      const key = e.key.toLowerCase();
      const isArrow = key.startsWith("arrow");
      let next: Direction | null = null;
      if (key === "w" || key === "arrowup") next = "up";
      if (key === "s" || key === "arrowdown") next = "down";
      if (key === "a" || key === "arrowleft") next = "left";
      if (key === "d" || key === "arrowright") next = "right";
      if (!next) return;
      // Prevent 180-degree reversal
      if (
        (movementDirection === "up" && next === "down") ||
        (movementDirection === "down" && next === "up") ||
        (movementDirection === "left" && next === "right") ||
        (movementDirection === "right" && next === "left")
      ) {
        return;
      }
      pendingDirectionRef.current = next;
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [movementDirection, gameStatus, startGame]);

  const setDirectionImmediate = (next: Direction) => {
    if (gameStatus !== "running") return;
    if (
      (movementDirection === "up" && next === "down") ||
      (movementDirection === "down" && next === "up") ||
      (movementDirection === "left" && next === "right") ||
      (movementDirection === "right" && next === "left")
    ) {
      return;
    }
    pendingDirectionRef.current = next;
  };

  const isSnakeCell = useCallback(
    (x: number, y: number) => snakeSet.has(`${x},${y}`),
    [snakeSet]
  );

  return (
    <div className="container">
      <div className="card">
        <div className="header">
          <div className="title">Snake</div>
          <div className="scores">
            <div className="badge">Score: {score}</div>
            <div className="badge">Best: {highScore}</div>
          </div>
        </div>

        <div className="board-wrap" style={{ width: "min(90vw, 600px)", margin: "0 auto" }}>
          <div
            className="board"
            style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)` }}
          >
            {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) => {
              const x = i % BOARD_SIZE;
              const y = Math.floor(i / BOARD_SIZE);
              const isFood = x === foodCell.x && y === foodCell.y;
              const isSnake = isSnakeCell(x, y);
              const isHead =
                snakeSegments.length > 0 &&
                snakeSegments[snakeSegments.length - 1].x === x &&
                snakeSegments[snakeSegments.length - 1].y === y;
              const classes = ["cell", isSnake ? "snake" : "", isHead ? "head" : "", isFood ? "food" : ""].filter(Boolean).join(" ");
              return <div key={`${x}-${y}`} className={classes} />;
            })}
          </div>

          <div className="mobile-controls">
            <button className="dpad-btn dpad-up" onClick={() => setDirectionImmediate("up")}>?</button>
            <button className="dpad-btn dpad-left" onClick={() => setDirectionImmediate("left")}>?</button>
            <button className="dpad-btn dpad-right" onClick={() => setDirectionImmediate("right")}>?</button>
            <button className="dpad-btn dpad-down" onClick={() => setDirectionImmediate("down")}>?</button>
          </div>
        </div>

        <div className="controls">
          {gameStatus !== "running" ? (
            <button className="btn primary" onClick={startGame}>
              {gameStatus === "over" ? "Play Again" : "Start Game"}
            </button>
          ) : (
            <button className="btn" onClick={() => setGameStatus("over")}>End Game</button>
          )}
          <button className="btn" onClick={() => { setHighScore(0); localStorage.removeItem(LOCAL_STORAGE_KEY); }}>Reset Best</button>
        </div>
        <div className="legend">Use ???????? or WASD. Eat food, avoid walls and yourself.</div>
      </div>
    </div>
  );
}
