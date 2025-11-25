import React, { useState } from 'react';
import Login from './../../../src/renderer/Login/Login';
import Register from './../../../src/renderer/Register/Register';
import './auth.css';
import logoImage from '../../../assets/perfectlysalon.jpg'; // Add this import

const Auth = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);

  // Use the imported logo
  const logoSrc = logoImage;

  const handleSwitchToRegister = () => {
    setIsLogin(false);
  };

  const handleSwitchToLogin = () => {
    setIsLogin(true);
  };

  const handleLogin = (userData) => {
    console.log('User logged in:', userData);
    if (onAuthSuccess) {
      // Pass all user data including userName and userRole
      onAuthSuccess({
        ...userData,
        userName: userData.userName || userData.profile?.full_name || userData.profile?.username || 'User',
        userRole: userData.userRole || userData.profile?.role || 'Admin',
        logoSrc: logoImage // Pass logo to parent
      });
    }
  };

  const handleRegister = (userData) => {
    console.log('User registered:', userData);
    setTimeout(() => {
      setIsLogin(true);
    }, 2000);
  };

  return (
    <div className="auth-wrapper">
      {isLogin ? (
        <Login
          logoSrc={logoSrc}
          logoAlt="Perfectly Salon Logo"
          onLogin={handleLogin}
          onSwitchToRegister={handleSwitchToRegister}
        />
      ) : (
        <Register
          logoSrc={logoSrc}
          logoAlt="Perfectly Salon Logo"
          onRegister={handleRegister}
          onSwitchToLogin={handleSwitchToLogin}
        />
      )}
    </div>
  );
};

export default Auth;