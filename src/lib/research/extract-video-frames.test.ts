import { describe, expect, it } from "vitest";

import {
  planFrameCount,
  VIDEO_FRAME_MAX,
  VIDEO_FRAME_MIN,
} from "./extract-video-frames";

/** Nur die pure Sampling-Planung — die eigentliche Extraktion braucht echtes
 *  Video-Decoding (<video> + Canvas) und ist in Node/jsdom nicht abbildbar;
 *  sie wird über den Formular-Flow manuell bzw. im Browser verifiziert. */
describe("planFrameCount", () => {
  it("keeps short clips at the 8-frame floor", () => {
    expect(planFrameCount(5)).toBe(VIDEO_FRAME_MIN);
    expect(planFrameCount(30)).toBe(VIDEO_FRAME_MIN);
    expect(planFrameCount(64)).toBe(VIDEO_FRAME_MIN);
  });

  it("scales into the 8–12 target band for typical spots", () => {
    expect(planFrameCount(80)).toBe(10);
    expect(planFrameCount(90)).toBe(12);
  });

  it("hard-caps long videos at 16 frames", () => {
    expect(planFrameCount(128)).toBe(VIDEO_FRAME_MAX);
    expect(planFrameCount(600)).toBe(VIDEO_FRAME_MAX);
    expect(planFrameCount(3600)).toBe(VIDEO_FRAME_MAX);
  });
});
