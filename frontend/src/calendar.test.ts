import { describe, expect, it } from "vitest";
import { packLanes } from "./calendar";

describe("packLanes", () => {
  it("returns laneCount 0 for empty input", () => {
    expect(packLanes([]).laneCount).toBe(0);
  });

  it("keeps non-overlapping spans in the same lane", () => {
    const { packed, laneCount } = packLanes([
      { startCol: 1, endCol: 2 },
      { startCol: 3, endCol: 4 },
    ]);
    expect(laneCount).toBe(1);
    expect(packed.map((p) => p.lane)).toEqual([0, 0]);
  });

  it("stacks overlapping spans into separate lanes", () => {
    const { packed, laneCount } = packLanes([
      { startCol: 1, endCol: 3 },
      { startCol: 2, endCol: 4 },
    ]);
    expect(laneCount).toBe(2);
    expect(packed[0].lane).not.toBe(packed[1].lane);
  });

  it("sorts by start then end before packing", () => {
    const { packed } = packLanes([
      { startCol: 5, endCol: 6, id: "b" },
      { startCol: 1, endCol: 2, id: "a" },
    ]);
    expect(packed.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("reuses a lane once an earlier bar has ended", () => {
    // After sort: [1-2], [1-5], [3-4]. The third fits in lane 0 (first ended at 2).
    const { packed, laneCount } = packLanes([
      { startCol: 1, endCol: 2 },
      { startCol: 1, endCol: 5 },
      { startCol: 3, endCol: 4 },
    ]);
    expect(laneCount).toBe(2);
    expect(packed.map((p) => `${p.startCol}-${p.endCol}:${p.lane}`)).toEqual([
      "1-2:0",
      "1-5:1",
      "3-4:0",
    ]);
  });

  it("preserves the original object fields alongside lane", () => {
    const { packed } = packLanes([{ startCol: 1, endCol: 1, title: "x" }]);
    expect(packed[0]).toMatchObject({ startCol: 1, endCol: 1, title: "x", lane: 0 });
  });
});
