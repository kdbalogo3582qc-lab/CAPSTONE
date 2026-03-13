import React, { useState } from 'react';
import styled from 'styled-components';
import hide from '../../assets/hide.png';
import view from '../../assets/view.png';
import Swal from 'sweetalert2';
import axios from 'axios';
import ApiConfig from '../config/LocalConfigApi';
import HomeNavbar from './HomeNavbar';

const Signup = () => {
  const [showPassword, setShowPassword] = useState(false);
  const togglePasswordVisibility = () => setShowPassword(!showPassword)
  const [data, setData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  })

  const handleChange = (e) => {
    const { name, value } = e.target;
    setData({
      ...data,
      [name]: value
    })
  }

  const dataCheck = () => {
    if (data.password === '' || data.confirmPassword === '' || data.email === '') {
      Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: 'All fields are required',
      })
      return false
    }

    if (data.password !== data.confirmPassword) {
      Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: 'Password do not match',
      })
      return false
    }

    if (data.password.length < 8) {
      Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: 'Password should be atleast 8 characters',
      })
      return false
    }

    if (data.email === '') {
      Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: 'Email is required',
      })
      return false
    }

    // email regex
    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(data.email)) {
      Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: 'Invalid email',
      })
      return false
    }

    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (dataCheck()) {
        const response = await axios.post(`${ApiConfig.apiURL}signup`, data);

        if (response.status === 201) {
          Swal.fire({
            icon: 'success',
            title: 'Success',
            text: 'Account created successfully',
          }).then((result) => {
            if (result.isConfirmed) {
              window.location.href = '/';
            }
          })
        } else if (response.status === 299) {
          Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: 'Email already exists',
          })
        }
      }
    } catch (err) {
      console.error("Error: ", err);
      Swal.fire({
        title: "Error!",
        text: "An error occurred while creating the account.",
        icon: "error"
      });
    }
  }

  return (
    <div style={{backgroundColor: "#f5f5f7"}}>
      <HomeNavbar />
      <StyledWrapper>
        <div className="signup-container">
          <div className="signup-card">
            <div className="signup-header">
              <h1 className="signup-title">Create Account</h1>
              <p className="signup-subtitle">Sign up to get started with your account.</p>
            </div>

            <form className="signup-form">
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
                    placeholder="Minimum 8 characters"
                    onChange={(e) => handleChange(e)}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={togglePasswordVisibility}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <img src={view} alt="Hide" /> : <img src={hide} alt="Show" />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword" className="form-label">Confirm Password</label>
                <div className="password-wrapper">
                  <input
                    className="form-input password-input"
                    type={showPassword ? "text" : "password"}
                    name="confirmPassword"
                    id="confirmPassword"
                    placeholder="Re-enter your password"
                    onChange={(e) => handleChange(e)}
                  />
                </div>
              </div>

              <button
                className="submit-button"
                type="button"
                onClick={(e) => handleSubmit(e)}
              >
                Create Account
              </button>
            </form>

            <div className="login-prompt">
              Already have an account?{' '}
              <a href="/" className="login-link">
                Sign in
              </a>
            </div>

            <div className="footer-links">
              <a href="#" className="footer-link">User License Agreement</a>
            </div>
          </div>
        </div>
      </StyledWrapper>
    </div>
  );
}

const StyledWrapper = styled.div`
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #f5f5f7;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
    padding: 20px;

    .signup-container {
        width: 100%;
        max-width: 440px;
    }

    .signup-card {
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.06);
        padding: 48px 40px;
    }

    .signup-header {
        margin-bottom: 32px;
        text-align: center;
    }

    .signup-title {
        font-size: 28px;
        font-weight: 600;
        color: #1a1a1a;
        margin: 0 0 8px 0;
        letter-spacing: -0.5px;
    }

    .signup-subtitle {
        font-size: 14px;
        color: #6b6b6b;
        margin: 0;
        font-weight: 400;
    }

    .signup-form {
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

    .form-input::placeholder {
        color: #a1a1a6;
    }

    .form-input:hover {
        border-color: #b0b0b5;
    }

    .form-input:focus {
        border-color: #4a90e2;
        box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
    }

    .password-wrapper {
        position: relative;
        display: flex;
        align-items: center;
    }

    .password-input {
        padding-right: 48px;
    }

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

    .password-toggle:hover {
        opacity: 1;
    }

    .password-toggle img {
        width: 20px;
        height: 20px;
        display: block;
    }

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
        margin-top: 8px;
    }

    .submit-button:hover {
        background-color: #1a252f;
        box-shadow: 0 2px 8px rgba(44, 62, 80, 0.2);
    }

    .submit-button:active {
        transform: translateY(1px);
        box-shadow: 0 1px 4px rgba(44, 62, 80, 0.2);
    }

    .login-prompt {
        text-align: center;
        font-size: 14px;
        color: #6b6b6b;
        margin-bottom: 20px;
        padding-top: 4px;
    }

    .login-link {
        color: #4a90e2;
        text-decoration: none;
        font-weight: 600;
        transition: color 0.2s ease;
    }

    .login-link:hover {
        color: #357abd;
        text-decoration: underline;
    }

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

    .footer-link:hover {
        color: #4a90e2;
        text-decoration: underline;
    }

    /* Responsive Design */
    @media (max-width: 480px) {
        .signup-card {
            padding: 32px 24px;
        }

        .signup-title {
            font-size: 24px;
        }
    }
`;

export default Signup;