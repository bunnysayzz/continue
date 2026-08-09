import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../telemetry/telemetryService.js", () => ({
  telemetryService: {
    recordTokenUsage: vi.fn(),
    recordCost: vi.fn(),
    recordResponseTime: vi.fn(),
    logApiRequest: vi.fn(),
  },
}));

vi.mock("../session.js", () => ({
  trackSessionUsage: vi.fn(),
}));

import { recordStreamTelemetry } from "./streamChatResponse.helpers.js";

describe("recordStreamTelemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function telemetry(model: string, fullUsage?: any) {
    return recordStreamTelemetry({
      requestStartTime: Date.now(),
      responseEndTime: Date.now(),
      inputTokens: 0,
      outputTokens: 0,
      model: { model },
      fullUsage,
    });
  }

  it("prices OpenAI cached input at the cache read rate", () => {
    // gpt-4o: 1000 prompt tokens (600 uncached + 400 cached), 500 output
    // uncached input 600 x $2.5/MTok + cached 400 x $1.25/MTok + output 500 x $10/MTok
    const cost = telemetry("gpt-4o", {
      prompt_tokens: 1000,
      completion_tokens: 500,
      prompt_tokens_details: { cached_tokens: 400 },
    });

    expect(cost).toBeCloseTo(0.007, 9);
  });

  it("prices Anthropic cache_read_input_tokens at the cache read rate", () => {
    // claude-3-5-sonnet: 1000 input x $3/MTok + 2000 cache read x $0.30/MTok
    // + 500 output x $15/MTok
    const cost = telemetry("claude-3-5-sonnet-20241022", {
      prompt_tokens: 1000,
      completion_tokens: 500,
      cache_read_input_tokens: 2000,
    });

    expect(cost).toBeCloseTo(0.0111, 9);
  });

  it("handles the Responses API usage shape (input_tokens)", () => {
    const cost = telemetry("gpt-4o", {
      input_tokens: 1000,
      output_tokens: 500,
      input_tokens_details: { cached_tokens: 400 },
    });

    expect(cost).toBeCloseTo(0.007, 9);
  });

  it("falls back to passed token counts when fullUsage is missing", () => {
    const cost = telemetry("gpt-4o", undefined);

    expect(cost).toBeGreaterThan(0);
  });
});
