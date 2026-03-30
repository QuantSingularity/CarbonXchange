import { LogOut } from "lucide-react";
import type React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto py-4 px-4 flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold">CX</span>
            </div>
            <h1 className="text-xl font-bold">CarbonXchange</h1>
          </Link>

          {isAuthenticated && (
            <>
              <nav className="hidden md:block">
                <ul className="flex space-x-6">
                  <li>
                    <Link
                      to="/dashboard"
                      className={`transition-colors ${
                        isActive("/dashboard")
                          ? "font-medium text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Dashboard
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/market"
                      className={`transition-colors ${
                        isActive("/market")
                          ? "font-medium text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Market
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/trade"
                      className={`transition-colors ${
                        isActive("/trade")
                          ? "font-medium text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Trade
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/portfolio"
                      className={`transition-colors ${
                        isActive("/portfolio")
                          ? "font-medium text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Portfolio
                    </Link>
                  </li>
                </ul>
              </nav>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-8 w-8 rounded-full"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {user?.name?.charAt(0).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {user?.name}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user?.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          {!isAuthenticated && (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => navigate("/login")}>
                Sign In
              </Button>
              <Button onClick={() => navigate("/register")}>Get Started</Button>
            </div>
          )}
        </div>
      </header>

      <main className="py-6">
        <div className="container mx-auto px-4">{children}</div>
      </main>

      <footer className="border-t py-6 mt-12">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2025 CarbonXchange. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
