/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  RotateCcw, 
  Play, 
  Clock, 
  Zap, 
  AlertCircle,
  Info,
  ChevronRight
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { GameMode, BlockData } from './types';
import { 
  GRID_ROWS, 
  GRID_COLS, 
  INITIAL_ROWS, 
  TIME_LIMIT, 
  TARGET_MIN, 
  TARGET_MAX,
  VALUE_COLORS 
} from './constants';

// --- Utilities ---
const generateId = () => Math.random().toString(36).substring(2, 9);
const getRandomValue = () => Math.floor(Math.random() * 9) + 1;
const getRandomTarget = () => Math.floor(Math.random() * (TARGET_MAX - TARGET_MIN + 1)) + TARGET_MIN;

export default function App() {
  // --- State ---
  const [mode, setMode] = useState<GameMode | null>(null);
  const [grid, setGrid] = useState<(BlockData | null)[][]>([]);
  const [score, setScore] = useState(0);
  const [target, setTarget] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isGameOver, setIsGameOver] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [isPaused, setIsPaused] = useState(false);
  const [highScore, setHighScore] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // --- Initialization ---
  const initGame = useCallback((selectedMode: GameMode) => {
    const newGrid: (BlockData | null)[][] = Array.from({ length: GRID_ROWS }, () => 
      Array.from({ length: GRID_COLS }, () => null)
    );

    // Fill initial rows from the bottom
    for (let r = GRID_ROWS - 1; r >= GRID_ROWS - INITIAL_ROWS; r--) {
      for (let c = 0; c < GRID_COLS; c++) {
        newGrid[r][c] = {
          id: generateId(),
          value: getRandomValue(),
          row: r,
          col: c,
          isSelected: false,
        };
      }
    }

    setGrid(newGrid);
    setScore(0);
    setTarget(getRandomTarget());
    setSelectedIds([]);
    setIsGameOver(false);
    setMode(selectedMode);
    setTimeLeft(TIME_LIMIT);
    setIsPaused(false);
  }, []);

  // --- Game Actions ---
  const addRow = useCallback(() => {
    setGrid(prevGrid => {
      // Check if top row has any blocks
      if (prevGrid[0].some(cell => cell !== null)) {
        setIsGameOver(true);
        return prevGrid;
      }

      const newGrid = prevGrid.map(row => [...row]);
      
      // Shift everything up
      for (let r = 0; r < GRID_ROWS - 1; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          newGrid[r][c] = newGrid[r + 1][c];
          if (newGrid[r][c]) {
            newGrid[r][c] = { ...newGrid[r][c]!, row: r };
          }
        }
      }

      // Add new row at the bottom
      for (let c = 0; c < GRID_COLS; c++) {
        newGrid[GRID_ROWS - 1][c] = {
          id: generateId(),
          value: getRandomValue(),
          row: GRID_ROWS - 1,
          col: c,
          isSelected: false,
        };
      }

      return newGrid;
    });
    
    if (mode === GameMode.TIME) {
      setTimeLeft(TIME_LIMIT);
    }
  }, [mode]);

  const handleBlockClick = (id: string) => {
    if (isGameOver || isPaused) return;

    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id);
      }
      return [...prev, id];
    });
  };

  const applyGravity = useCallback((currentGrid: (BlockData | null)[][]) => {
    const newGrid = currentGrid.map(row => [...row]);
    let changed = false;

    for (let c = 0; c < GRID_COLS; c++) {
      for (let r = GRID_ROWS - 1; r > 0; r--) {
        if (newGrid[r][c] === null && newGrid[r - 1][c] !== null) {
          newGrid[r][c] = { ...newGrid[r - 1][c]!, row: r };
          newGrid[r - 1][c] = null;
          changed = true;
          // Re-check from this column's bottom to ensure everything falls
          r = GRID_ROWS; 
        }
      }
    }
    return { newGrid, changed };
  }, []);

  // --- Effects ---
  // Check sum whenever selection changes
  const [isShaking, setIsShaking] = useState(false);
  const [currentSum, setCurrentSum] = useState(0);

  useEffect(() => {
    const selectedBlocks: BlockData[] = [];
    grid.forEach(row => row.forEach(block => {
      if (block && selectedIds.includes(block.id)) {
        selectedBlocks.push(block);
      }
    }));

    const sum = selectedBlocks.reduce((acc, b) => acc + b.value, 0);
    setCurrentSum(sum);

    if (sum === 0) return;

    if (sum === target) {
      // Success!
      setScore(prev => prev + (selectedBlocks.length * 10));
      setTarget(getRandomTarget());
      
      setGrid(prevGrid => {
        const nextGrid = prevGrid.map(row => 
          row.map(block => block && selectedIds.includes(block.id) ? null : block)
        );
        const { newGrid } = applyGravity(nextGrid);
        return newGrid;
      });
      
      setSelectedIds([]);
      
      if (mode === GameMode.CLASSIC) {
        addRow();
      }

      if (selectedBlocks.length >= 4) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    } else if (sum > target) {
      // Over the limit - clear selection with shake
      setIsShaking(true);
      setTimeout(() => {
        setIsShaking(false);
        setSelectedIds([]);
      }, 400);
    }
  }, [selectedIds, target, grid, mode, addRow, applyGravity]);

  // Timer for Time Mode
  useEffect(() => {
    if (mode === GameMode.TIME && !isGameOver && !isPaused) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            addRow();
            return TIME_LIMIT;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [mode, isGameOver, isPaused, addRow]);

  // High score persistence
  useEffect(() => {
    const saved = localStorage.getItem('sumstack-highscore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('sumstack-highscore', score.toString());
    }
  }, [score, highScore]);

  // --- Render Helpers ---
  if (!mode) {
    return (
      <div className="min-h-screen bg-[#9B5DE5] flex items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-[40px] shadow-2xl p-10 border-8 border-[#F15BB5]"
        >
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-[#00BBF9] rounded-3xl flex items-center justify-center shadow-lg rotate-3">
              <Zap className="text-white w-12 h-12" />
            </div>
          </div>
          
          <h1 className="text-5xl font-black text-center text-gray-900 mb-2 tracking-tighter italic">SumStack</h1>
          <p className="text-gray-500 text-center mb-10 font-medium">The ultimate math puzzle challenge!</p>
          
          <div className="space-y-5">
            <button 
              onClick={() => initGame(GameMode.CLASSIC)}
              className="w-full group flex items-center justify-between p-6 bg-[#FEE440] hover:bg-[#FEE440]/90 rounded-2xl transition-all duration-200 border-b-8 border-[#D4C500] active:border-b-0 active:translate-y-2"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:rotate-12 transition-transform">
                  <Trophy className="text-[#9B5DE5] w-8 h-8" />
                </div>
                <div className="text-left">
                  <div className="font-black text-xl text-gray-900 uppercase">Classic</div>
                  <div className="text-xs text-gray-700 font-bold opacity-70">Infinite Survival</div>
                </div>
              </div>
              <ChevronRight className="text-gray-900 w-8 h-8" />
            </button>

            <button 
              onClick={() => initGame(GameMode.TIME)}
              className="w-full group flex items-center justify-between p-6 bg-[#00F5D4] hover:bg-[#00F5D4]/90 rounded-2xl transition-all duration-200 border-b-8 border-[#00BB9F] active:border-b-0 active:translate-y-2"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:-rotate-12 transition-transform">
                  <Clock className="text-[#00BBF9] w-8 h-8" />
                </div>
                <div className="text-left">
                  <div className="font-black text-xl text-gray-900 uppercase">Time Attack</div>
                  <div className="text-xs text-gray-700 font-bold opacity-70">{TIME_LIMIT}s per row</div>
                </div>
              </div>
              <ChevronRight className="text-gray-900 w-8 h-8" />
            </button>
          </div>

          <div className="mt-8 pt-8 border-t border-gray-100">
            <div className="flex items-center gap-2 text-gray-400 mb-4">
              <Info size={16} />
              <span className="text-xs font-semibold uppercase tracking-wider">How to play</span>
            </div>
            <ul className="text-sm text-gray-600 space-y-2">
              <li className="flex gap-2">
                <span className="text-indigo-600 font-bold">•</span>
                Select numbers that add up to the target.
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-600 font-bold">•</span>
                Numbers don't need to be adjacent.
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-600 font-bold">•</span>
                Don't let the blocks reach the top!
              </li>
            </ul>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#00BBF9] flex flex-col items-center justify-center p-4 font-sans overflow-hidden">
      {/* Game Header */}
      <div className="max-w-[400px] w-full mb-6 flex items-center justify-between bg-white/20 backdrop-blur-md p-6 rounded-[32px] border border-white/30 shadow-xl">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-widest font-black text-white mb-1 drop-shadow-sm">Target</span>
          <div className="flex items-baseline gap-2">
            <motion.div 
              key={target}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-6xl font-black text-white tabular-nums leading-none drop-shadow-md"
            >
              {target}
            </motion.div>
            {currentSum > 0 && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ 
                  opacity: 1, 
                  x: 0,
                  color: currentSum > target ? '#FF3366' : '#FEE440'
                }}
                className="text-2xl font-black tabular-nums drop-shadow-sm"
              >
                / {currentSum}
              </motion.div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end">
          <div className="flex items-center gap-3 mb-2">
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-widest font-black text-white/70 block">Score</span>
              <span className="text-2xl font-black text-white tabular-nums">{score}</span>
            </div>
            <div className="w-px h-8 bg-white/30" />
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-widest font-black text-white/70 block">Best</span>
              <span className="text-2xl font-black text-white tabular-nums">{highScore}</span>
            </div>
          </div>
          
          {mode === GameMode.TIME && (
            <div className="flex items-center gap-2 bg-white px-4 py-1.5 rounded-full shadow-lg">
              <Clock size={16} className={timeLeft <= 3 ? "text-[#FF3366] animate-pulse" : "text-[#00BBF9]"} />
              <span className={`text-sm font-black tabular-nums ${timeLeft <= 3 ? "text-[#FF3366]" : "text-gray-900"}`}>
                {timeLeft}s
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Game Board */}
      <motion.div 
        animate={isShaking ? { x: [-6, 6, -6, 6, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="relative bg-gray-900 p-3 rounded-[32px] shadow-2xl border-8 border-white/10"
      >
        <div 
          className="grid gap-2"
          style={{ 
            gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
            width: 'min(90vw, 380px)',
            aspectRatio: `${GRID_COLS} / ${GRID_ROWS}`
          }}
        >
          {grid.map((row, r) => (
            row.map((block, c) => (
              <div 
                key={`${r}-${c}`}
                className="relative aspect-square rounded-xl bg-white/5 border border-white/5 overflow-hidden"
              >
                <AnimatePresence mode="popLayout">
                  {block && (
                    <motion.button
                      key={block.id}
                      layoutId={block.id}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ 
                        scale: 1, 
                        opacity: 1,
                        backgroundColor: selectedIds.includes(block.id) ? '#FF3366' : VALUE_COLORS[block.value] || '#FFFFFF',
                        color: selectedIds.includes(block.id) ? '#FFFFFF' : '#1A1A1A',
                        transform: selectedIds.includes(block.id) ? 'scale(1.05)' : 'scale(1)',
                      }}
                      exit={{ scale: 1.5, opacity: 0, rotate: 45 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleBlockClick(block.id)}
                      className={`absolute inset-0 flex items-center justify-center text-2xl font-black rounded-xl border-b-4 border-black/20 transition-all shadow-lg`}
                    >
                      {block.value}
                    </motion.button>
                  )}
                </AnimatePresence>
                
                {/* Danger line indicator */}
                {r === 0 && (
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-red-500/20" />
                )}
              </div>
            ))
          ))}
        </div>

        {/* Game Over Overlay */}
        <AnimatePresence>
          {isGameOver && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-20 bg-gray-900/90 backdrop-blur-sm rounded-[20px] flex flex-col items-center justify-center p-6 text-center"
            >
              <AlertCircle className="text-red-500 w-16 h-16 mb-4" />
              <h2 className="text-3xl font-black text-white mb-2">GAME OVER</h2>
              <p className="text-gray-400 mb-8">You reached the top!</p>
              
              <div className="bg-white/10 rounded-2xl p-4 w-full mb-8">
                <div className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-1">Final Score</div>
                <div className="text-4xl font-black text-white">{score}</div>
              </div>

              <div className="flex gap-4 w-full">
                <button 
                  onClick={() => setMode(null)}
                  className="flex-1 py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-colors"
                >
                  Menu
                </button>
                <button 
                  onClick={() => initGame(mode!)}
                  className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-colors"
                >
                  Retry
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pause Overlay */}
        <AnimatePresence>
          {isPaused && !isGameOver && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-10 bg-white/60 backdrop-blur-sm rounded-[20px] flex flex-col items-center justify-center p-6 text-center"
            >
              <button 
                onClick={() => setIsPaused(false)}
                className="w-20 h-20 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-transform"
              >
                <Play size={40} fill="currentColor" />
              </button>
              <span className="mt-4 font-bold text-gray-900 uppercase tracking-widest">Paused</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Controls */}
      <div className="max-w-[400px] w-full mt-8 flex items-center justify-between">
        <button 
          onClick={() => setMode(null)}
          className="p-4 bg-white rounded-2xl shadow-lg border-b-4 border-gray-200 hover:bg-gray-50 active:border-b-0 active:translate-y-1 transition-all"
          title="Menu"
        >
          <RotateCcw size={24} className="text-gray-600" />
        </button>

        <div className="flex gap-3">
          <button 
            onClick={() => setIsPaused(!isPaused)}
            className="px-8 py-4 bg-white rounded-2xl shadow-lg border-b-4 border-gray-200 font-black text-gray-700 hover:bg-gray-50 active:border-b-0 active:translate-y-1 transition-all uppercase tracking-widest"
          >
            {isPaused ? 'Resume' : 'Pause'}
          </button>
          
          <button 
            onClick={() => initGame(mode!)}
            className="px-8 py-4 bg-gray-900 rounded-2xl shadow-lg border-b-4 border-black font-black text-white hover:bg-gray-800 active:border-b-0 active:translate-y-1 transition-all uppercase tracking-widest"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
