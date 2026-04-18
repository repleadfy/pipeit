import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ConsentPage } from "./ConsentPage.js";

const originalLocation = window.location;

beforeEach(() => {
  Object.defineProperty(window, "location", {
    writable: true,
    value: { assign: vi.fn(), href: "" },
  });
});

afterEach(() => {
  Object.defineProperty(window, "location", { writable: true, value: originalLocation });
  vi.restoreAllMocks();
});

function mockFetchSequence(responses: Array<Partial<Response>>) {
  const fn = vi.fn();
  for (const r of responses) fn.mockResolvedValueOnce(r as Response);
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

describe("ConsentPage", () => {
  test("shows client name from /consent-info", async () => {
    mockFetchSequence([{ ok: true, json: async () => ({ client_name: "Claude Code", issued_at: 1700000000000 }) }]);
    render(<MemoryRouter><ConsentPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/Claude Code/)).toBeInTheDocument());
  });

  test("Allow POSTs action=allow and navigates to returned redirect URL", async () => {
    const fetchMock = mockFetchSequence([
      { ok: true, json: async () => ({ client_name: "Claude Code", issued_at: 1 }) },
      { ok: true, json: async () => ({ redirect: "http://localhost:12345/callback?code=abc" }) },
    ]);
    render(<MemoryRouter><ConsentPage /></MemoryRouter>);
    await screen.findByText(/Claude Code/);
    await userEvent.click(screen.getByRole("button", { name: /allow/i }));
    await waitFor(() => {
      const call = fetchMock.mock.calls.find((c) => c[0] === "/mcp/consent");
      expect(call?.[1]?.body).toContain('"allow"');
    });
    await waitFor(() => expect(window.location.href).toBe("http://localhost:12345/callback?code=abc"));
  });

  test("Deny POSTs action=deny", async () => {
    const fetchMock = mockFetchSequence([
      { ok: true, json: async () => ({ client_name: "Claude Code", issued_at: 1 }) },
      { ok: true, json: async () => ({ redirect: "http://localhost:12345/callback?error=access_denied" }) },
    ]);
    render(<MemoryRouter><ConsentPage /></MemoryRouter>);
    await screen.findByText(/Claude Code/);
    await userEvent.click(screen.getByRole("button", { name: /deny/i }));
    await waitFor(() => {
      const call = fetchMock.mock.calls.find((c) => c[0] === "/mcp/consent");
      expect(call?.[1]?.body).toContain('"deny"');
    });
  });

  test("missing pending auth shows an error message", async () => {
    mockFetchSequence([{ ok: false, status: 404, json: async () => ({ error: "no pending authorization" }) }]);
    render(<MemoryRouter><ConsentPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/no pending authorization/i)).toBeInTheDocument());
  });
});
