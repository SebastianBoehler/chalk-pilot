export const MATERIAL_CHANGE_THRESHOLD = 0.08;
const REQUIRED_CHANGED_SAMPLES = 2;

export interface BoardChangeState {
  consecutiveChanges: number;
  dirty: boolean;
  latestScore: number;
}

export const initialBoardChangeState: BoardChangeState = {
  consecutiveChanges: 0,
  dirty: false,
  latestScore: 0,
};

export function measureBoardChange(
  previous: Uint8Array,
  current: Uint8Array,
): number {
  if (previous.length === 0 || previous.length !== current.length) {
    throw new Error("Board samples must have the same non-zero length");
  }
  let difference = 0;
  for (let index = 0; index < previous.length; index += 1) {
    difference += Math.abs(previous[index] - current[index]);
  }
  return difference / previous.length / 255;
}

export function advanceBoardChange(
  state: BoardChangeState,
  score: number,
  threshold = MATERIAL_CHANGE_THRESHOLD,
): BoardChangeState {
  const consecutiveChanges =
    score >= threshold ? state.consecutiveChanges + 1 : 0;
  return {
    consecutiveChanges,
    dirty: state.dirty || consecutiveChanges >= REQUIRED_CHANGED_SAMPLES,
    latestScore: score,
  };
}

export function markBoardSent(state: BoardChangeState): BoardChangeState {
  return { ...state, consecutiveChanges: 0, dirty: false };
}
