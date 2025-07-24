import { useState } from "react";
import "./Login.css";
import authService from "../utils/auth";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="login-container">
      <form className="login-form container">
        <h2 className="login-title">Sign In</h2>
        <div className="input-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="input-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button
          type="submit"
          onClick={async (e) => {
            e.preventDefault();

            try {
              await authService.login(email, password);
            } catch (error) {
              alert(error);
              setPassword("");
            }
          }}
        >
          Login
        </button>
      </form>
    </div>
  );
}

export default Login;
