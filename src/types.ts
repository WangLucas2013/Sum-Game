export enum GameMode {
  CLASSIC = 'classic',
  TIME = 'time',
}

export interface BlockData {
  id: string;
  value: number;
  row: number;
  col: number;
  isSelected: boolean;
}

export interface GameState {
  grid: (BlockData | null)[][];
  score: number;
  target: number;
  mode: GameMode;
  isGameOver: boolean;
  timeLeft: number;
  selectedIds: string[];
}
