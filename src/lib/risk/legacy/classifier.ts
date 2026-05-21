import "server-only";

// Compatibility import path. Active production LLM analysis lives in
// src/lib/risk/llm-classifier.ts.

export {
  ANALYSIS_MODEL,
  LLMUnavailableError,
  analyzeDealRiskLLM as analyzeDealRisk,
} from "../llm-classifier";
