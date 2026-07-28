import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { GuestRoute, ProtectedRoute } from "@/components/ProtectedRoute";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/AuthContext";

import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Marketplace from "@/pages/Marketplace";
import ProjectDetail from "@/pages/ProjectDetail";
import Trade from "@/pages/Trade";
import Orders from "@/pages/Orders";
import Portfolio from "@/pages/Portfolio";
import Transactions from "@/pages/Transactions";
import Compliance from "@/pages/Compliance";
import Profile from "@/pages/Profile";
import Admin from "@/pages/Admin";
import NotFound from "@/pages/NotFound";

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="carbonxchange-theme">
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public marketing shell — always opens on the homepage */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Home />} />
              <Route
                path="/login"
                element={
                  <GuestRoute>
                    <Login />
                  </GuestRoute>
                }
              />
              <Route
                path="/register"
                element={
                  <GuestRoute>
                    <Register />
                  </GuestRoute>
                }
              />
            </Route>

            {/* Authenticated app shell */}
            <Route
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/marketplace" element={<Marketplace />} />
              <Route path="/marketplace/:id" element={<ProjectDetail />} />
              <Route path="/trade" element={<Trade />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/compliance" element={<Compliance />} />
              <Route path="/profile" element={<Profile />} />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute
                    roles={["admin", "compliance_officer", "auditor"]}
                  >
                    <Admin />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Router>
        <Toaster position="top-right" richColors closeButton />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
