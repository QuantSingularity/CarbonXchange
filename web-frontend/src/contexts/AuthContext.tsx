import type React from "react";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  getCurrentUser,
} from "../services/api";

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem("access_token");
    if (token) {
      loadUser();
    } else {
      setLoading(false);
    }
  }, [loadUser]);

  const loadUser = async () => {
    try {
      const response = await getCurrentUser();
      setUser(response.data || response);
    } catch (error) {
      console.error("Failed to load user:", error);
      localStorage.removeItem("access_token");
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await apiLogin(email, password);
      if (response.user) {
        setUser(response.user);
      } else {
        // If backend doesn't return user, fetch it
        await loadUser();
      }
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  };

  const register = async (email: string, password: string, name: string) => {
    try {
      await apiRegister({ email, password, name });
      // After registration, log in automatically
      await login(email, password);
    } catch (error) {
      console.error("Registration failed:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await apiLogout();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setUser(null);
      localStorage.removeItem("access_token");
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
