import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./lib/auth.js";
import { ProtectedRoute } from "./components/ProtectedRoute.js";
import { InstallPage } from "./pages/InstallPage.js";

function TestRoutes() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/install" element={<InstallPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute fallback={<Navigate to="/install" replace />}>
              <div>Authed home</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

describe("unauthed routing", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user: null }),
    }) as unknown as typeof fetch;
  });

  test("unauthed visit to / renders the InstallPage", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <TestRoutes />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText(/Share markdown from AI conversations/)).toBeInTheDocument();
    });
  });
});
