import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { InstallPage } from "./InstallPage.js";

describe("InstallPage", () => {
  test("renders all three install commands", () => {
    render(<MemoryRouter><InstallPage /></MemoryRouter>);
    expect(screen.getByText(/plugin marketplace add repleadfy\/pipeit/)).toBeInTheDocument();
    expect(screen.getByText(/plugin install pipeit/)).toBeInTheDocument();
    expect(screen.getByText(/npx pipeit\.live/)).toBeInTheDocument();
    expect(screen.getByText(/bunx pipeit\.live/)).toBeInTheDocument();
  });

  test("shows the post-install hint mentioning /pipeit and browser sign-in", () => {
    render(<MemoryRouter><InstallPage /></MemoryRouter>);
    expect(screen.getByText("/pipeit")).toBeInTheDocument();
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
