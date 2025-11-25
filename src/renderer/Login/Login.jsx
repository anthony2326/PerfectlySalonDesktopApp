import React, { useState, useEffect } from 'react';
import styles from './Login.module.css';
import supabase from '../../../utils/supabase';

const Login = ({ logoSrc, logoAlt = "Logo", onLogin, onSwitchToRegister }) => {
  const [step, setStep] = useState(1);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [error, setError] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    if (otp.length === 6 && step === 2) {
      handleVerifyOtp();
    }
  }, [otp, step]);

  const validateCredentials = () => {
    if (!identifier.trim()) {
      setError('Email or username is required');
      return false;
    }
    if (!password) {
      setError('Password is required');
      return false;
    }
    return true;
  };

  const handleCredentialsSubmit = async () => {
    if (!validateCredentials()) return;

    setLoading(true);
    setError('');

    try {
      let email = identifier.trim();
      
      if (!/\S+@\S+\.\S+/.test(identifier)) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('email')
          .eq('username', identifier.toLowerCase().trim())
          .single();

        if (profileError || !profileData) {
          setError('Invalid username or password');
          setLoading(false);
          return;
        }
        email = profileData.email;
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password: password,
      });

      if (authError) {
        setError('Invalid email/username or password');
        setLoading(false);
        return;
      }

      await supabase.auth.signOut();

      setUserEmail(email);
      setUserId(authData.user.id);
      await sendOtpCode(email);
      
    } catch (err) {
      setError('Login failed. Please try again.');
      console.error('Login error:', err);
      setLoading(false);
    }
  };

  const sendOtpCode = async (email) => {
    setSendingOtp(true);
    setError('');

    try {
      const { data, error } = await supabase.functions.invoke('send-verification-code', {
        body: { email: email.toLowerCase() }
      });

      if (error) {
        console.error('Error sending OTP:', error);
        setError('Failed to send verification code. Please try again.');
        setLoading(false);
        setSendingOtp(false);
        return;
      }

      if (data && data.success) {
        setStep(2);
        setCountdown(60);
        setLoading(false);
        setSendingOtp(false);
      } else {
        setError(data?.error || 'Failed to send verification code');
        setLoading(false);
        setSendingOtp(false);
      }
    } catch (err) {
      console.error('OTP send error:', err);
      setError('Failed to send verification code. Please try again.');
      setLoading(false);
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) return;

    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.functions.invoke('verify-code', {
        body: { 
          email: userEmail.toLowerCase(),
          code: otp.trim()
        }
      });

      if (error || !data || !data.verified) {
        setError('Invalid or expired verification code');
        setOtp('');
        setLoading(false);
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: userEmail.toLowerCase(),
        password: password,
      });

      if (authError) {
        setError('Login failed. Please try again.');
        setLoading(false);
        return;
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      await supabase
        .from('email_verifications')
        .delete()
        .eq('email', userEmail.toLowerCase())
        .eq('verified', true);

      if (onLogin) {
        onLogin({
          user: authData.user,
          profile: profileData,
          email: userEmail,
          userName: profileData?.full_name || profileData?.username || 'User',
          userRole: profileData?.role || 'Admin'
        });
      }

    } catch (err) {
      console.error('OTP verification error:', err);
      setError('Verification failed. Please try again.');
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;
    await sendOtpCode(userEmail);
  };

  const handleBackToCredentials = () => {
    setStep(1);
    setOtp('');
    setError('');
    setCountdown(0);
  };

  const handleOtpChange = (e) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    if (value.length <= 6) {
      setOtp(value);
      if (error) setError('');
    }
  };

  const handleInputChange = (setter) => (e) => {
    setter(e.target.value);
    if (error) setError('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      if (step === 1) {
        handleCredentialsSubmit();
      } else if (step === 2 && otp.length === 6) {
        handleVerifyOtp();
      }
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.mainCard}>
        <div className={styles.cardContainer}>
          <div className={styles.formSection}>
            <div className={styles.formContent}>
              <div className={styles.logo}>
                <div className={styles.logoIcon}>
                  {logoSrc ? (
                    <img 
                      src={logoSrc} 
                      alt={logoAlt}
                      className={styles.logoImage}
                    />
                  ) : (
                    <div className={styles.logoSquare}></div>
                  )}
                </div>
                <span className={styles.logoText}>Perfectly Salon</span>
              </div>

              <h2 className={styles.formTitle}>
                {step === 1 ? 'Welcome Admin' : 'Enter Verification Code'}
              </h2>

              {step === 2 && (
                <p className={styles.otpInstruction}>
                  We've sent a 6-digit code to {userEmail}
                </p>
              )}

              {error && (
                <div className={styles.errorMessage}>
                  {error}
                </div>
              )}

              {step === 1 ? (
                <div className={styles.formFields}>
                  <div className={styles.inputGroup}>
                    <input
                      type="text"
                      placeholder="Email or Username"
                      className={styles.input}
                      value={identifier}
                      onChange={handleInputChange(setIdentifier)}
                      onKeyPress={handleKeyPress}
                      disabled={loading}
                      required
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      className={styles.input}
                      value={password}
                      onChange={handleInputChange(setPassword)}
                      onKeyPress={handleKeyPress}
                      disabled={loading}
                      required
                    />
                    <button
                      type="button"
                      className={styles.passwordToggle}
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={loading}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>

                  <button
                    className={styles.submitButton}
                    onClick={handleCredentialsSubmit}
                    disabled={loading || sendingOtp}
                  >
                    {loading || sendingOtp ? 'Sending Code...' : 'CONTINUE'}
                  </button>
                </div>
              ) : (
                <div className={styles.formFields}>
                  <div className={styles.inputGroup}>
                    <input
                      type="text"
                      placeholder="Enter 6-digit code"
                      className={styles.otpInput}
                      value={otp}
                      onChange={handleOtpChange}
                      onKeyPress={handleKeyPress}
                      disabled={loading}
                      required
                      maxLength={6}
                      autoFocus
                    />
                  </div>

                  <div className={styles.otpActions}>
                    <button
                      type="button"
                      className={styles.resendButton}
                      onClick={handleResendOtp}
                      disabled={countdown > 0 || loading}
                    >
                      {countdown > 0 ? `Resend in ${countdown}s` : 'Resend Code'}
                    </button>
                  </div>

                  <div className={styles.buttonRow}>
                    <button
                      className={styles.backButton}
                      onClick={handleBackToCredentials}
                      disabled={loading}
                    >
                      BACK
                    </button>
                    <button
                      className={styles.submitButton}
                      onClick={handleVerifyOtp}
                      disabled={loading || otp.length !== 6}
                    >
                      {loading ? 'Verifying...' : 'VERIFY'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className={styles.welcomeSection}>
            <div className={styles.welcomeBackground}>
              <div className={styles.geometricPattern}>
                <div className={styles.gridPattern}>
                  <div className={styles.grid}>
                    {Array.from({ length: 144 }, (_, i) => (
                      <div
                        key={i}
                        className={styles.gridItem}
                        style={{ animationDelay: `${i * 0.05}s` }}
                      ></div>
                    ))}
                  </div>
                </div>

                <div className={styles.floatingShape1}></div>
                <div className={styles.floatingShape2}></div>
                <div className={styles.floatingShape3}></div>
              </div>

              <div className={styles.welcomeContent}>
                <button 
                  onClick={onSwitchToRegister} 
                  className={styles.toggleButton}
                  disabled={loading}
                >
                  Sign Up
                </button>

                <h1 className={styles.welcomeTitle}>
                  Beauty Awaits at <span className={styles.welcomeBrand}>Perfectly Salon</span>
                </h1>

                <p className={styles.welcomeText}>
                  Experience luxury beauty treatments where artistry meets expertise. Book your perfect look today.
                </p>

                <div className={styles.navigationDots}>
                  <div className={styles.dot}></div>
                  <div className={`${styles.dot} ${styles.dotInactive}`}></div>
                  <div className={`${styles.dot} ${styles.dotInactive}`}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;