"use client";

import { useEffect, useState } from "react";
import { getMe, logout, type User } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";
import { KanbanBoard } from "@/components/KanbanBoard";

export const AppGate = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe().then((current) => {
      setUser(current);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-[var(--gray-text)]">
        Loading...
      </main>
    );
  }

  if (!user) {
    return <LoginForm onSuccess={setUser} />;
  }

  const handleLogout = async () => {
    await logout();
    setUser(null);
  };

  return <KanbanBoard onLogout={handleLogout} />;
};
