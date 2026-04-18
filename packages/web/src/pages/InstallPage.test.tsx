import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { InstallPage } from "./InstallPage.js";

describe("InstallPage", () => {
  test("renders all three install commands", () => {
    render(<MemoryRouter><InstallPage /></MemoryRouter>);
    expect(screen.getByText(/plugin marketplace add repleadfy\/mpipe/)).toBeInTheDocument();
    expect(screen.getByText(/plugin install mpipe/)).toBeInTheDocument();
    expect(screen.getByText(/npx mpipe\.dev/)).toBeInTheDocument();
    expect(screen.getByText(/bunx mpipe\.dev/)).toBeInTheDocument();
  });

  test("shows the post-install hint mentioning /mpipe and browser sign-in", () => {
    render(<MemoryRouter><InstallPage /></MemoryRouter>);
    expect(screen.getByText("/mpipe")).toBeInTheDocument();
    expect(screen.getByText(/browser opens once to sign in/i)).toBeInTheDocument();
  });

  test("links to the login page for existing users", () => {
    render(<MemoryRouter><InstallPage /></MemoryRouter>);
    const link = screen.getByRole("link", { name: /sign in/i });
    expect(link.getAttribute("href")).toBe("/login");
  });

  test("renders a copy button for each install block", () => {
    render(<MemoryRouter><InstallPage /></MemoryRouter>);
    expect(screen.getAllByRole("button", { name: /copy/i })).toHaveLength(3);
  });
});
