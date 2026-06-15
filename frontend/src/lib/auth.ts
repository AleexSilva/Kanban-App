export type User = { username: string };

export async function getMe(): Promise<User | null> {
  try {
    const response = await fetch("/api/me");
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as User;
  } catch {
    return null;
  }
}

export async function login(username: string, password: string): Promise<User> {
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    throw new Error("Invalid username or password.");
  }
  return (await response.json()) as User;
}

export async function logout(): Promise<void> {
  await fetch("/api/logout", { method: "POST" });
}
