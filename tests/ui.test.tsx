import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../src/ui/App";

describe("engineer UI", () => {
  it("shows the five-stage workflow and synthetic disclosure", () => {
    render(<App />); expect(screen.getByRole("heading", { name: /Factory Bottleneck/i })).toBeInTheDocument();
    expect(screen.getByText(/Synthetic example/i)).toBeInTheDocument(); expect(screen.getByRole("button", { name: /Run 100 matched/i })).toBeInTheDocument();
    expect(screen.getByText(/Results are always simulated/i)).toBeInTheDocument();
  });
});
