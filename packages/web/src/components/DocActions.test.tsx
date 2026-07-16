import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { DocActions } from "./DocActions.js";

const base = { slug: "abc123", title: "My Doc", content: "# My Doc\n\nbody" };

describe("DocActions", () => {
  test("markdown doc offers copy, download .md, and print", async () => {
    render(<DocActions {...base} format="markdown" />);
    await userEvent.click(screen.getByRole("button", { name: /export document/i }));
    expect(screen.getByRole("button", { name: "Copy markdown" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download .md" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /print/i })).toBeInTheDocument();
  });

  test("pdf doc hides copy but still downloads .pdf", async () => {
    render(<DocActions {...base} format="pdf" content="" />);
    await userEvent.click(screen.getByRole("button", { name: /export document/i }));
    expect(screen.queryByRole("button", { name: /^copy/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download .pdf" })).toBeInTheDocument();
  });

  test("copy writes the full source (with the H1) to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<DocActions {...base} format="markdown" />);
    await userEvent.click(screen.getByRole("button", { name: /export document/i }));
    await userEvent.click(screen.getByRole("button", { name: "Copy markdown" }));
    expect(writeText).toHaveBeenCalledWith("# My Doc\n\nbody");
  });
});
