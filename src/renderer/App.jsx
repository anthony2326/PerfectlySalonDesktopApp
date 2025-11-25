import React, { useState } from 'react';
import Auth from '../../utils/functions/authloginsignup/auth';
import Login from './Login/Login';
import Register from './Register/Register';
import Dashboard from './pages/Dashboard/Dashboard';
import Clients from './pages/Clients/Clients';
import Inventory from './pages/Inventory/Inventory';
import Scheduling from './pages/Scheduling/Scheduling';
import Reports from './pages/Reports/Reports';
import Settings from './pages/Settings/Settings';
import Announcements from './Annouce/Annoucement';

const App = () => {
  const [currentView, setCurrentView] = useState('auth');
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  const handleLogin = (userData) => {
    console.log('Login attempt:', userData);
    
    // Extract user data properly
    const profileData = {
      id: userData?.user?.id || userData?.id,
      email: userData?.user?.email || userData?.email,
      username: userData?.user?.user_metadata?.username || userData?.username || userData?.email?.split('@')[0],
      fullName: userData?.user?.user_metadata?.full_name || userData?.fullName || userData?.user?.email?.split('@')[0],
      avatarUrl: userData?.user?.user_metadata?.avatar_url || userData?.avatarUrl,
      role: userData?.user?.user_metadata?.role || userData?.role || 'Admin'
    };
    
    setUser(userData?.user || userData);
    setUserProfile(profileData);
    setCurrentView('dashboard');
  };

  const handleRegister = (userData) => {
    console.log('Register attempt:', userData);
    
    // Extract user data properly
    const profileData = {
      id: userData?.user?.id || userData?.id,
      email: userData?.user?.email || userData?.email,
      username: userData?.user?.user_metadata?.username || userData?.username || userData?.email?.split('@')[0],
      fullName: userData?.user?.user_metadata?.full_name || userData?.fullName || userData?.user?.email?.split('@')[0],
      avatarUrl: userData?.user?.user_metadata?.avatar_url || userData?.avatarUrl,
      role: userData?.user?.user_metadata?.role || userData?.role || 'Admin'
    };
    
    setUser(userData?.user || userData);
    setUserProfile(profileData);
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    setUserProfile(null);
    setCurrentView('auth');
  };

  const handleNavigate = (page) => {
    setCurrentView(page);
  };

  const switchToRegister = () => {
    setCurrentView('register');
  };

  const switchToLogin = () => {
    setCurrentView('login');
  };

  const handleAuthSuccess = (userData) => {
    console.log('Authentication successful:', userData);
    
    // Extract user data properly
    const profileData = {
      id: userData?.user?.id || userData?.id,
      email: userData?.user?.email || userData?.email,
      username: userData?.user?.user_metadata?.username || userData?.username || userData?.email?.split('@')[0],
      fullName: userData?.user?.user_metadata?.full_name || userData?.fullName || userData?.user?.email?.split('@')[0],
      avatarUrl: userData?.user?.user_metadata?.avatar_url || userData?.avatarUrl,
      role: userData?.user?.user_metadata?.role || userData?.role || 'Admin'
    };
    
    setUser(userData?.user || userData);
    setUserProfile(profileData);
    setCurrentView('dashboard');
  };

  const handleProfileUpdate = (updatedData) => {
    setUserProfile(prev => ({
      ...prev,
      ...updatedData
    }));
  };

  // Authentication Views
  if (!user) {
    if (currentView === 'auth') {
      return <Auth onAuthSuccess={handleAuthSuccess} />;
    }
    
    if (currentView === 'register') {
      return (
        <Register 
          onRegister={handleRegister}
          onSwitchToLogin={switchToLogin}
        />
      );
    }
    
    return (
      <Login 
        onLogin={handleLogin}
        onSwitchToRegister={switchToRegister}
      />
    );
  }

  // Main Application Views (after authentication)
  const renderCurrentPage = () => {
    const pageProps = {
      onNavigate: handleNavigate,
      onLogout: handleLogout,
      userName: userProfile?.fullName || userProfile?.username || 'User',
      userRole: userProfile?.role || 'Admin',
      userEmail: userProfile?.email || user?.email,
      avatarUrl: userProfile?.avatarUrl,
      userId: user?.id,
      onProfileUpdate: handleProfileUpdate
    };

    switch (currentView) {
      case 'dashboard':
        return <Dashboard {...pageProps} />;
      case 'clients':
        return <Clients {...pageProps} />;
      case 'inventory':
        return <Inventory {...pageProps} />;
      case 'scheduling':
        return <Scheduling {...pageProps} />;
      case 'announcements':
        return <Announcements {...pageProps} />;
      case 'reports':
        return <Reports {...pageProps} />;
      case 'settings':
        return <Settings {...pageProps} />;
      default:
        return <Dashboard {...pageProps} />;
    }
  };

  return (
    <div className="App">
      {renderCurrentPage()}
    </div>
  );
};

export default App;