import authService from "./auth";

interface User {
  id: string;
  email: string;
  isAdmin: boolean;
}

async function getUsers(page: number): Promise<User[]> {
  const resp = await authService.get(
    `/api/admin/users?offset=${(page - 1) * 50}&limit=50`
  );

  return resp;
}

async function createUser(email: string, password: string): Promise<User> {
  const resp = await authService.post("/api/admin/users", {
    email,
    password,
  });

  return resp;
}

async function deleteUser(userId: string) {
  const resp = await authService.delete(`/api/admin/user/${userId}`);

  return resp;
}

export { getUsers, createUser, deleteUser };
export type { User };
