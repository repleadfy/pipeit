import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test } from "vitest";
import { InstallPage } from "./InstallPage.js";

function renderPage() {
  render(
    <MemoryRouter>
      <InstallPage />
    </MemoryRouter>,
  );
}

describe("InstallPage", () => {
  test("shows the Claude Code plugin commands on the default tab", () => {
    renderPage();
    expect(screen.getByText(/plugin marketplace add repleadfy\/pipeit/)).toBeInTheDocument();
    expect(screen.getByText(/plugin install pipeit@repleadfy/)).toBeInTheDocument();
  });

  test("switching tabs reveals the npm and Bun commands", async () => {
    renderPage();
    // Other tabs' commands are not mounted until selected.
    expect(screen.queryByText(/npx pipeit\.live/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /npm/i }));
    expect(screen.getByText(/npx pipeit\.live/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /bun/i }));
    expect(screen.getByText(/bunx pipeit\.live/)).toBeInTheDocument();
  });

  test("explains the /pipeit flow and the one-time browser sign-in", () => {
    renderPage();
    // The metaphor chip and the steps reference the command.
    expect(screen.getAllByText(/\/pipeit/).length).toBeGreaterThan(0);
    expect(screen.getByText(/opens your browser once to sign in/i)).toBeInTheDocument();
  });

  test("links to the login page for existing users", () => {
    renderPage();
    const links = screen.getAllByRole("link", { name: /sign in/i });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link.getAttribute("href")).toBe("/login");
  });

  test("renders one copy button for the active install command", () => {
    renderPage();
    expect(screen.getAllByRole("button", { name: /copy/i })).toHaveLength(1);
  });
});
