import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './css/login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  
  const navigate = useNavigate();

  // Check if dark mode is active when component mounts
  useEffect(() => {
    const isDarkMode = document.body.classList.contains('dark-mode');
    setDarkMode(isDarkMode);
  }, []);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.body.classList.toggle('dark-mode');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (email === '' || password === '') {
      setError('Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      // Send login request to API with email AND password
      const response = await fetch('http://localhost:5000/api/users/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Store user info in localStorage
      if (rememberMe) {
        localStorage.setItem('userInfo', JSON.stringify(data));
      } else {
        sessionStorage.setItem('userInfo', JSON.stringify(data));
      }

      // Redirect based on role
      if (data.role === 'etudiant') {
        navigate('/etudiant');
      } else if (data.role === 'technicien') {
        navigate('/technicien');
      } else if (data.role === 'responsable') {
        navigate('/responsable');
      }
      
    } catch (err) {
      setError(err.message || 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={darkMode ? 'dark-mode' : ''}>
      <header className="sticky-header">
        <div className="nav-container">
          <div className="logo">
            <span className="logo-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
              </svg>
            </span>
            <span className="logo-text">GP<span className="accent-dot">.</span></span>
          </div>
          
          <nav>
            <ul className="nav-links">
              <li><Link to="/">Home</Link></li>
              <li><Link to="/#about">About</Link></li>
              <li><Link to="/#services">Services</Link></li>
              <li><Link to="/#contact">Contact</Link></li>
            </ul>
          </nav>
          
          <div className="nav-actions">
            <button onClick={toggleDarkMode} className="theme-toggle" aria-label="Toggle Dark Mode">
              {darkMode ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"></circle>
                  <line x1="12" y1="1" x2="12" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="23"></line>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                  <line x1="1" y1="12" x2="3" y2="12"></line>
                  <line x1="21" y1="12" x2="23" y2="12"></line>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
              )}
            </button>
            <Link className="cta-button" to="/login">Get Started</Link>
          </div>
        </div>
      </header>

      <section className="login-section">
        <div className="login-background">
          <div className="shape shape-1" data-speed="0.2"></div>
          <div className="shape shape-2" data-speed="0.4"></div>
          <div className="shape shape-3" data-speed="0.3"></div>
        </div>
        
        <div className="login-container">
          <h2>Login<span className="accent-dot">.</span></h2>
          {error && <p className="error-message">{error}</p>}
          <form className="login-form" onSubmit={handleSubmit}>
            <input
              type="email"
              name="email"
              placeholder="Email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="password"
              name="password"
              placeholder="Password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="login-options">
              <label>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                /> Remember me
              </label>
              <a href="#" className="forgot-link">Forgot Password?</a>
            </div>
            <button type="submit" disabled={loading} className="login-button">
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
          <p className="signup-link">
            Don't have an account? <a href="#">Sign up</a>
          </p>
        </div>
      </section>
    </div>
  );
};

export default Login;