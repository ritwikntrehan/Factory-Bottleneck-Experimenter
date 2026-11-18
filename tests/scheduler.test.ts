import { describe, expect, it } from "vitest";
import { StableEventQueue } from "../src/simulation/scheduler";

describe("StableEventQueue", () => {
  it("orders by time and then monotonically by insertion", () => {
    const queue = new StableEventQueue<string>(); queue.schedule(2, "later"); queue.schedule(1, "first"); queue.schedule(1, "second");
    expect([queue.pop()?.payload, queue.pop()?.payload, queue.pop()?.payload]).toEqual(["first", "second", "later"]);
  });
  it("rejects invalid event times", () => { expect(() => new StableEventQueue().schedule(-1, "x")).toThrow(); });
});
