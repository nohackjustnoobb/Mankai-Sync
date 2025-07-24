import React, { useState, useEffect } from "react";
import { getUsers, createUser, deleteUser, type User } from "../utils/user";
import authService from "../utils/auth";
import "./Home.css";

const Home = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [creating, setCreating] = useState(false);

  const loadUsers = async (pageNum: number = 1) => {
    try {
      setLoading(true);
      setError(null);
      const fetchedUsers = await getUsers(pageNum);
      setUsers(fetchedUsers);
      setPage(pageNum);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim() || !newUserPassword.trim()) {
      setError("Email and password are required");
      return;
    }

    try {
      setCreating(true);
      setError(null);
      await createUser(newUserEmail.trim(), newUserPassword);
      setNewUserEmail("");
      setNewUserPassword("");
      setShowCreateForm(false);
      // Reload users to show the new user
      await loadUsers(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to delete user "${userEmail}"?`)) {
      return;
    }

    try {
      setError(null);
      await deleteUser(userId);
      // Reload users to reflect the deletion
      await loadUsers(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  return (
    <div className="home-container">
      <div className="home-content container">
        <h2 className="home-title">User Management</h2>

        {error && <div className="error-message">{error}</div>}

        <div className="user-actions">
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            {showCreateForm ? "Cancel" : "Create New User"}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => loadUsers(page)}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh Users"}
          </button>
          <button
            className="btn btn-danger"
            onClick={() => authService.logout()}
          >
            Logout
          </button>
        </div>

        {showCreateForm && (
          <form className="create-user-form" onSubmit={handleCreateUser}>
            <h3>Create New User</h3>
            <div className="form-group">
              <label htmlFor="email">Email:</label>
              <input
                type="email"
                id="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password:</label>
              <input
                type="password"
                id="password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                required
              />
            </div>
            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={creating}
              >
                {creating ? "Creating..." : "Create User"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading && page === 1 ? (
          <div className="loading">Loading users...</div>
        ) : (
          <div className="users-section">
            <div className="users-header">
              <h3>Users (Page {page})</h3>
              <div className="pagination">
                <button
                  className="btn btn-small"
                  onClick={() => loadUsers(page - 1)}
                  disabled={page <= 1 || loading}
                >
                  Previous
                </button>
                <span className="page-info">Page {page}</span>
                <button
                  className="btn btn-small"
                  onClick={() => loadUsers(page + 1)}
                  disabled={loading || users.length < 50}
                >
                  Next
                </button>
              </div>
            </div>

            {users.length === 0 ? (
              <div className="no-users">No users found</div>
            ) : (
              <div className="users-list">
                {users.map((user) => (
                  <div key={user.id} className="user-item">
                    <div className="user-info">
                      <div className="user-email">{user.email}</div>
                      <div className="user-role">
                        {user.isAdmin ? "Admin" : "User"}
                      </div>
                    </div>
                    <button
                      className="btn btn-danger btn-small"
                      onClick={() => handleDeleteUser(user.id, user.email)}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
