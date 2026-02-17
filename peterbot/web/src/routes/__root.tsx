import { Outlet, createRootRoute, Navigate } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { isAuthenticated } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";

interface RootContext {
  queryClient: QueryClient;
}

export const Route = createRootRoute<RootContext>({
  component: RootComponent,
});

function RootComponent() {
  const isLoginPage = window.location.pathname === "/login";
  const authenticated = isAuthenticated();

  // Redirect to login if not authenticated
  if (!authenticated && !isLoginPage) {
    return <Navigate to="/login" />;
  }

  // Redirect to home if already authenticated and on login page
  if (authenticated && isLoginPage) {
    return <Navigate to="/" />;
  }

  // Login page doesn't have sidebar
  if (isLoginPage) {
    return (
      <div className="min-h-screen bg-background">
        <Outlet />
      </div>
    );
  }

  // Authenticated pages have sidebar layout
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
