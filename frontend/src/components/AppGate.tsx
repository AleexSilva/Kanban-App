"use client";

import { useEffect, useState } from "react";
import { getMe, logout, type User } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";
import { KanbanBoard } from "@/components/KanbanBoard";
import { ChatSidebar } from "@/components/ChatSidebar";

export const AppGate = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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

  return (
    <div className="flex min-h-screen">
      <div className="min-w-0 flex-1">
        <KanbanBoard
          onLogout={handleLogout}
          refreshTrigger={refreshTrigger}
        />
      </div>
      <ChatSidebar onBoardRefresh={() => setRefreshTrigger((n) => n + 1)} />
    </div>
  );
};
