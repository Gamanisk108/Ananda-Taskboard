import { describe, expect, it, test } from "vitest";
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

import { dayCells } from "./calendar";
import type { EventSpan, Holiday } from "./types";

const ev = (title: string): EventSpan =>
  ({ id: 1, title, kind: "single", yearly: false, start: "2026-01-01", end: "2026-01-01" });
const hol = (title: string): Holiday =>
  ({ title, set: "ananda_lineage", holiday: true, start: "2026-01-01", end: "2026-01-01" });

test("events sort before holidays", () => {
  const { visible } = dayCells([ev("Retreat")], [hol("Yogananda's Birthday")], 5);
  expect(visible[0].label).toBe("Retreat");
  expect(visible[0].holiday).toBe(false);
  expect(visible[1].holiday).toBe(true);
});

test("caps to max and reports overflow count", () => {
  const events = [ev("A"), ev("B"), ev("C")];
  const holidays = [hol("D"), hol("E")];
  const { visible, more } = dayCells(events, holidays, 3);
  expect(visible).toHaveLength(3);
  expect(more).toBe(2);
});

test("no overflow when within cap", () => {
  const { more } = dayCells([ev("A")], [hol("B")], 3);
  expect(more).toBe(0);
});
