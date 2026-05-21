export const ANALYSIS_LOADING_MESSAGES = [
  "Reading transcript...",
  "Detecting risk signals...",
  "Evaluating evidence...",
  "Generating recommendations...",
] as const;

export function getAnalysisLoadingMessage(index: number): string {
  const safeIndex = Math.max(0, Math.floor(index));
  return ANALYSIS_LOADING_MESSAGES[
    safeIndex % ANALYSIS_LOADING_MESSAGES.length
  ];
}
