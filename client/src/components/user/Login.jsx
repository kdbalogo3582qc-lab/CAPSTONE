import React, { useState, useEffect, createContext, useContext } from 'react';
import styled from 'styled-components';
import { Link, useNavigate } from 'react-router-dom';
import hide from '../../assets/hide.png';
import view from '../../assets/view.png';
import Swal from 'sweetalert2';
import axios from 'axios';
import ApiConfig from '../config/LocalConfigApi';
import Logo from '../../assets/logo.svg';
import HomeNavbar from './HomeNavbar';

// ─── Auth Context ─────────────────────────────────────────────────────────────
// Stores the current user in React state — no localStorage, no sessionStorage
export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);  // { acc_id, acc_email }
  const [loading, setLoading] = useState(true);  // true while checking session on app load

  // On every app load, ask the server who is logged in using the httpOnly cookie
  useEffect(() => {
    axios
      .get(`${ApiConfig.apiURL}/user/me`, { withCredentials: true })
      .then((res) => setUser(res.data))
      .catch(() => setUser(null)) // cookie missing or expired — not logged in
      .finally(() => setLoading(false));
  }, []);

  const login  = (userData) => setUser(userData);
  const logout = async () => {
    await axios.post(`${ApiConfig.apiURL}/logout`, {}, { withCredentials: true });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Convenience hook — use this in any component: const { user } = useAuth()
export const useAuth = () => useContext(AuthContext);

// ─── Login Component ──────────────────────────────────────────────────────────
const Login = () => {
  const navigate = useNavigate();
  const { login, user, loading } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const passwordVisibility = () => setShowPassword(!showPassword);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  // Redirect authenticated users away from the login page
  useEffect(() => {
    if (!loading && user) {
      navigate('/home', { replace: true });
    }
  }, [user, loading, navigate]);

  // Early return AFTER all hooks are declared
  if (loading || user) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const checkInput = () => {
    if (formData.email === '' || formData.password === '') {
      Swal.fire({ icon: 'error', title: 'Oops...', text: 'All fields are required' });
      return false;
    }

    if (formData.password.length < 8) {
      Swal.fire({ icon: 'error', title: 'Oops...', text: 'Password should be atleast 8 characters' });
      return false;
    }

    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(formData.email)) {
      Swal.fire({ icon: 'warning', title: 'Oops...', text: 'Invalid email' });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (!checkInput()) return;

      const response = await axios.post(`${ApiConfig.apiURL}/login`, formData,
        { withCredentials: true });

      if (response.data.error) {
        Swal.fire({ icon: 'error', title: 'Oops...', text: response.data.error });
        return false;
      }

      if (response.status === 200) {

        Swal.fire({
          icon: 'success',
          title: 'Success',
          text: response.data.message,
        }).then((result) => {
          if (result.isConfirmed) {
            login({ acc_id: response.data.acc_id, acc_email: response.data.email }); // ← moved here
            navigate('/home');
          }
        });
      }

    } catch (err) {
      console.log(err);
      Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: err.response?.status === 429
          ? 'Too many login attempts. Please wait and try again.'
          : err.response?.status === 401
            ? 'Invalid email or password.'
            : 'An unexpected error occurred. Please try again later.'
      });
      return false;
    }
  };

  return (
    <div style={{backgroundColor: "#f5f5f7"}}>
      <title>Sign In - Video Analyzer</title>
      <HomeNavbar />
      <StyledWrapper>
        <div className="login-container">
          <div className="login-card">
            <div className="img-con">
              <img src={Logo} alt="Logo" />
              <h1 className="login-title">Sign In</h1>
            </div>
            <div className="login-header">
              <p className="login-subtitle">Welcome back. Please enter your credentials.</p>
            </div>

            <form className="login-form">
              <div className="form-group">
                <label htmlFor="email" className="form-label">Email Address</label>
                <input
                  className="form-input"
                  type="email"
                  name="email"
                  id="email"
                  placeholder="name@example.com"
                  onChange={(e) => handleChange(e)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="password" className="form-label">Password</label>
                <div className="password-wrapper">
                  <input
                    className="form-input password-input"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    id="password"
                    placeholder="Enter your password"
                    onChange={(e) => handleChange(e)}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={passwordVisibility}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <img src={view} alt="Hide" /> : <img src={hide} alt="Show" />}
                  </button>
                </div>
              </div>

              <div className="form-options">
                <a href="#" className="forgot-link">Forgot password?</a>
              </div>

              <button
                className="submit-button"
                type="submit"
                onClick={(e) => handleSubmit(e)}
              >
                Sign In
              </button>
            </form>

            <div className="divider">
              <span className="divider-text">or continue with</span>
            </div>

            <div className="signup-prompt">
              Don't have an account?{' '}
              <Link to="/signup" className="signup-link">
                Create one
              </Link>
            </div>
          </div>
        </div>
      </StyledWrapper>
    </div>
  );
};

const StyledWrapper = styled.div`
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #f5f5f7;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
    padding: 20px;

    .login-container {
        width: 100%;
        max-width: 440px;
    }

    .img-con {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 12px;
        margin-bottom: 24px;
    }

    .img-con img {
        width: 40px;
        height: 40px;
    }

    .login-card {
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.06);
        padding: 48px 40px;
    }

    .login-header {
        margin-bottom: 32px;
        text-align: center;
    }

    .login-title {
        font-size: 28px;
        font-weight: 500;
        color: #1a1a1a;
        letter-spacing: -0.5px;
    }

    .login-subtitle {
        font-size: 14px;
        color: #6b6b6b;
        margin: 0;
        font-weight: 400;
    }

    .login-form {
        margin-bottom: 24px;
    }

    .form-group {
        margin-bottom: 20px;
    }

    .form-label {
        display: block;
        font-size: 13px;
        font-weight: 500;
        color: #3a3a3a;
        margin-bottom: 8px;
        letter-spacing: 0.2px;
    }

    .form-input {
        width: 100%;
        padding: 12px 16px;
        font-size: 15px;
        color: #1a1a1a;
        background-color: #ffffff;
        border: 1px solid #d1d1d6;
        border-radius: 8px;
        outline: none;
        transition: all 0.2s ease;
        font-family: inherit;
        box-sizing: border-box;
    }

    .form-input::placeholder { color: #a1a1a6; }
    .form-input:hover         { border-color: #b0b0b5; }
    .form-input:focus         { border-color: #4a90e2; box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1); }

    .password-wrapper {
        position: relative;
        display: flex;
        align-items: center;
    }

    .password-input { padding-right: 48px; }

    .password-toggle {
        position: absolute;
        right: 12px;
        background: none;
        border: none;
        cursor: pointer;
        padding: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.6;
        transition: opacity 0.2s ease;
    }

    .password-toggle:hover { opacity: 1; }
    .password-toggle img   { width: 20px; height: 20px; display: block; }

    .form-options {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 24px;
    }

    .forgot-link {
        font-size: 13px;
        color: #4a90e2;
        text-decoration: none;
        font-weight: 500;
        transition: color 0.2s ease;
    }

    .forgot-link:hover { color: #357abd; text-decoration: underline; }

    .submit-button {
        width: 100%;
        padding: 14px 24px;
        font-size: 15px;
        font-weight: 600;
        color: #ffffff;
        background-color: #2c3e50;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: inherit;
        letter-spacing: 0.3px;
    }

    .submit-button:hover  { background-color: #1a252f; box-shadow: 0 2px 8px rgba(44, 62, 80, 0.2); }
    .submit-button:active { transform: translateY(1px); box-shadow: 0 1px 4px rgba(44, 62, 80, 0.2); }

    .divider {
        position: relative;
        text-align: center;
        margin: 28px 0;
    }

    .divider::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 0;
        right: 0;
        height: 1px;
        background-color: #e5e5ea;
    }

    .divider-text {
        position: relative;
        display: inline-block;
        padding: 0 16px;
        font-size: 12px;
        color: #8e8e93;
        background-color: #ffffff;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-weight: 500;
    }

    .signup-prompt {
        text-align: center;
        font-size: 14px;
        color: #6b6b6b;
        margin-bottom: 20px;
    }

    .signup-link {
        color: #4a90e2;
        text-decoration: none;
        font-weight: 600;
        transition: color 0.2s ease;
    }

    .signup-link:hover { color: #357abd; text-decoration: underline; }

    .footer-links {
        text-align: center;
        padding-top: 16px;
        border-top: 1px solid #e5e5ea;
    }

    .footer-link {
        font-size: 12px;
        color: #8e8e93;
        text-decoration: none;
        transition: color 0.2s ease;
    }

    .footer-link:hover { color: #4a90e2; text-decoration: underline; }

    @media (max-width: 480px) {
        .login-card  { padding: 32px 24px; }
        .login-title { font-size: 24px; }

        .social-login { grid-template-columns: 1fr; }

        .social-button {
            flex-direction: row;
            justify-content: flex-start;
            padding: 12px 16px;
            gap: 12px;
        }
    }
`;

export default Login;