import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute.js";
import { AuthProvider } from "./lib/auth.js";
import { ConsentPage } from "./pages/ConsentPage.js";
import { DocPage } from "./pages/DocPage.js";
import { HomePage } from "./pages/HomePage.js";
import { InstallPage } from "./pages/InstallPage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { NotFoundPage } from "./pages/NotFoundPage.js";
import { UploadPage } from "./pages/UploadPage.js";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/install" element={<InstallPage />} />
          <Route path="/d/:slug" element={<DocPage />} />
          <Route
            path="/upload"
            element={
              <ProtectedRoute>
                <UploadPage />
              </ProtectedRoute>
            }
          />
          <Route path="/mcp/consent" element={<ConsentPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute fallback={<Navigate to="/install" replace />}>
                <HomePage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
