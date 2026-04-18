import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./lib/auth.js";
import { ProtectedRoute } from "./components/ProtectedRoute.js";
import { LoginPage } from "./pages/LoginPage.js";
import { DocPage } from "./pages/DocPage.js";
import { InstallPage } from "./pages/InstallPage.js";
import { ConsentPage } from "./pages/ConsentPage.js";
import { NotFoundPage } from "./pages/NotFoundPage.js";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/install" element={<InstallPage />} />
          <Route path="/d/:slug" element={<DocPage />} />
          <Route path="/mcp/consent" element={<ConsentPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute fallback={<Navigate to="/install" replace />}>
                <Navigate to="/d/latest" replace />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
