import React, { useState } from 'react';
import style from './landing.module.css';

const LandingLog = ({ logoSrc, logoAlt = "Logo", onLogin }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showOtpVerification, setShowOtpVerification] = useState(false);
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setShowOtpVerification(false);
    setOtp('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handleLogin = () => {
    // Basic validation
    if (email && password && !isSignUp) {
      // Simulate login success
      if (onLogin) {
        onLogin({ email, password });
      }
    }
  };

  const handleSignUp = () => {
    if (!showOtpVerification) {
      setShowOtpVerification(true);
    } else {
      console.log('Sign up completed with OTP:', otp);
      // Handle successful sign up here
    }
  };

  const handleBackToSignUp = () => {
    setShowOtpVerification(false);
    setOtp('');
  };

  return (
    <div className={style.container}>
      <div className={style.mainCard}>
        <div className={style.cardContainer}>
          {/* Form Section */}
          <div className={`${style.formSection} ${isSignUp ? style.signUp : ''}`}>
            <div className={style.formContent}>
              {/* Logo */}
              <div className={style.logo}>
                <div className={style.logoIcon}>
                  {logoSrc ? (
                    <img 
                      src={logoSrc} 
                      alt={logoAlt}
                      className={style.logoImage}
                    />
                  ) : (
                    <div className={style.logoSquare}></div>
                  )}
                </div>
                <span className={style.logoText}>Perfectly Salon</span>
              </div>

              {/* Form Title */}
              <h2 className={style.formTitle}>
                {showOtpVerification ? 'Verify OTP' : isSignUp ? 'Sign Up' : 'Welcome Admin'}
              </h2>

              {/* Form Fields */}
              {showOtpVerification ? (
                <div className={style.formFields}>
                  <div className={style.otpMessage}>
                    <p>We've sent a verification code to your email. Please enter the 6-digit code below:</p>
                  </div>
                  <div className={style.inputGroup}>
                    <input
                      type="text"
                      placeholder="Enter 6-digit OTP"
                      className={style.input}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      maxLength="6"
                    />
                  </div>
                  <div className={style.otpActions}>
                    <button
                      type="button"
                      className={style.backButton}
                      onClick={handleBackToSignUp}
                    >
                      Back to Sign Up
                    </button>
                    <button type="button" className={style.resendButton}>
                      Resend OTP
                    </button>
                  </div>
                </div>
              ) : (
                <div className={style.formFields}>
                  {isSignUp && (
                    <div className={style.inputGroup}>
                      <input
                        type="text"
                        placeholder="Full Name"
                        className={style.input}
                      />
                    </div>
                  )}

                  <div className={style.inputGroup}>
                    <input
                      type="email"
                      placeholder="Email Address"
                      className={style.input}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className={style.inputGroup}>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      className={style.input}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className={style.passwordToggle}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>

                  {isSignUp && (
                    <div className={style.inputGroup}>
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm Password"
                        className={style.input}
                      />
                      <button
                        type="button"
                        className={style.passwordToggle}
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Submit Button */}
              <button
                className={style.submitButton}
                onClick={showOtpVerification ? undefined : isSignUp ? handleSignUp : handleLogin}
              >
                {showOtpVerification ? 'VERIFY OTP' : isSignUp ? 'SIGN UP' : 'LOGIN'}
              </button>
            </div>
          </div>

          {/* Welcome Section */}
          <div className={`${style.welcomeSection} ${isSignUp ? style.signUp : ''}`}>
            <div className={style.welcomeBackground}>
              {/* Geometric Pattern */}
              <div className={style.geometricPattern}>
                <div className={style.gridPattern}>
                  <div className={style.grid}>
                    {Array.from({ length: 144 }, (_, i) => (
                      <div
                        key={i}
                        className={style.gridItem}
                        style={{ animationDelay: `${i * 0.05}s` }}
                      ></div>
                    ))}
                  </div>
                </div>

                {/* Floating Shapes - Beauty themed */}
                <div className={style.floatingShape1}></div>
                <div className={style.floatingShape2}></div>
                <div className={style.floatingShape3}></div>
              </div>

              {/* Welcome Content */}
              <div className={style.welcomeContent}>
                <button onClick={toggleMode} className={style.toggleButton}>
                  {isSignUp ? 'Log In' : 'Sign Up'}
                </button>

                <h1 className={style.welcomeTitle}>
                  Beauty Awaits at <span className={style.welcomeBrand}>Perfectly Salon</span>
                </h1>

                <p className={style.welcomeText}>
                  {isSignUp
                    ? 'Join thousands who trust us for premium beauty and wellness services. Your transformation starts here.'
                    : 'Experience luxury beauty treatments where artistry meets expertise. Book your perfect look today.'}
                </p>

                <div className={style.navigationDots}>
                  <div className={style.dot}></div>
                  <div className={`${style.dot} ${style.dotInactive}`}></div>
                  <div className={`${style.dot} ${style.dotInactive}`}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingLog;