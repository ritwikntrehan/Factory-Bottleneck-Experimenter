import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/ui/App";

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  terminated = false;
  postMessage = vi.fn();
  constructor() { FakeWorker.instances.push(this); }
  terminate() { this.terminated = true; }
}

describe("product experience and run consistency", () => {
  beforeEach(() => { FakeWorker.instances = []; vi.stubGlobal("Worker", FakeWorker); history.replaceState(null, "", "#example"); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("leads with the product question and an accurately labeled working example", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /Before buying another machine/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Synthetic example/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Explore the example/i })).toBeInTheDocument();
    expect(screen.getByText(/actual simulation runs on first visit/i)).toBeInTheDocument();
    expect(FakeWorker.instances).toHaveLength(1);
  });

  it("invalidates and cancels an in-flight run when physical inputs change", async () => {
    render(<App />); const staleWorker = FakeWorker.instances[0]!;
    fireEvent.click(screen.getByRole("button", { name: /^Model my line$/i }));
    fireEvent.change(screen.getByLabelText("Cutting machines"), { target: { value: "2" } });
    expect(staleWorker.terminated).toBe(true);
    expect(screen.getAllByText(/Inputs changed/i).length).toBeGreaterThan(0);
    staleWorker.onmessage?.({ data: { type: "complete", results: [{ baseline: { mean: 999 } }] } } as MessageEvent);
    await waitFor(() => expect(screen.queryByText("999")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Scenario CSV/i })).toBeDisabled();
  });
});
