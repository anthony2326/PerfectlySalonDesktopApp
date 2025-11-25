import React, { useState, useEffect } from 'react';
import styles from './Register.module.css';
import verificationService from '../Register/utils/verificationService';

const Register = ({ logoSrc, logoAlt = "Logo", onRegister, onSwitchToLogin }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    fullName: '',
    age: '',
    contactNumber: '',
    email: '',
    verificationCode: '',
    username: '',
    password: '',
    confirmPassword: ''
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [codeSent, setCodeSent] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(''); // 'success' or 'error'
  const [modalMessage, setModalMessage] = useState('');

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Auto-verify when 6 digits entered
  useEffect(() => {
    if (formData.verificationCode.length === 6 && !isVerified && !verifyingCode && codeSent) {
      handleVerifyCode();
    }
  }, [formData.verificationCode, isVerified, verifyingCode, codeSent]);

  const showModalMessage = (type, message) => {
    setModalType(type);
    setModalMessage(message);
    setShowModal(true);
    setTimeout(() => setShowModal(false), 3000);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Special handling for contact number - only numbers
    if (name === 'contactNumber') {
      const cleaned = value.replace(/[^0-9]/g, '');
      if (cleaned.length <= 11) {
        setFormData(prev => ({ ...prev, [name]: cleaned }));
      }
      return;
    }
    
    // Special handling for age - only numbers
    if (name === 'age') {
      const cleaned = value.replace(/[^0-9]/g, '');
      if (cleaned.length <= 3) {
        setFormData(prev => ({ ...prev, [name]: cleaned }));
      }
      return;
    }
    
    // Special handling for verification code
    if (name === 'verificationCode') {
      const cleaned = value.replace(/[^0-9]/g, '');
      if (cleaned.length <= 6) {
        setFormData(prev => ({ ...prev, [name]: cleaned }));
        if (isVerified && cleaned !== formData.verificationCode) {
          setIsVerified(false);
        }
      }
      return;
    }

    // Special handling for email
    if (name === 'email') {
      setFormData(prev => ({ ...prev, [name]: value }));
      if (codeSent) {
        setCodeSent(false);
        setIsVerified(false);
        setFormData(prev => ({ ...prev, verificationCode: '' }));
      }
      if (error) setError('');
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const validateStep1 = () => {
    if (!formData.fullName.trim()) {
      setError('Full name is required');
      return false;
    }
    if (formData.fullName.trim().length < 2) {
      setError('Full name must be at least 2 characters');
      return false;
    }
    if (!formData.age) {
      setError('Age is required');
      return false;
    }
    const ageNum = parseInt(formData.age);
    if (ageNum < 13 || ageNum > 120) {
      setError('Age must be between 13 and 120');
      return false;
    }
    if (!formData.contactNumber) {
      setError('Contact number is required');
      return false;
    }
    if (formData.contactNumber.length !== 11) {
      setError('Contact number must be 11 digits');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.email.trim()) {
      setError('Email is required');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }
    if (!isVerified) {
      setError('Please verify your email first');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!formData.username.trim()) {
      setError('Username is required');
      return false;
    }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(formData.username.trim())) {
      setError('Username must be 3-20 characters (letters, numbers, underscores only)');
      return false;
    }
    if (!formData.password) {
      setError('Password is required');
      return false;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    setError('');
    
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    } else if (currentStep === 2 && validateStep2()) {
      setCurrentStep(3);
    }
  };

  const handleBack = () => {
    setError('');
    setCurrentStep(currentStep - 1);
  };

  const handleSendCode = async () => {
    if (!formData.email.trim()) {
      setError('Please enter your email address');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    setSendingCode(true);
    setError('');

    const result = await verificationService.sendVerificationCode(formData.email);
    setSendingCode(false);

    if (result.success) {
      setCodeSent(true);
      setCountdown(60);
      setIsVerified(false);
      setFormData(prev => ({ ...prev, verificationCode: '' }));
      showModalMessage('success', 'Verification code sent! Please check your email.');
    } else {
      setError(result.error || 'Failed to send verification code');
    }
  };

  const handleVerifyCode = async () => {
    if (formData.verificationCode.length !== 6) {
      return;
    }

    if (!codeSent) {
      setError('Please request a verification code first');
      return;
    }

    setVerifyingCode(true);
    setError('');

    const result = await verificationService.verifyCode(formData.email, formData.verificationCode);
    setVerifyingCode(false);

    if (result.verified) {
      setIsVerified(true);
      showModalMessage('success', '✓ Email verified successfully!');
    } else {
      setFormData(prev => ({ ...prev, verificationCode: '' }));
      setIsVerified(false);
      const friendlyError = result.error?.includes('FunctionsHttpError') || result.error?.includes('Edge Function')
        ? 'Invalid or expired verification code'
        : result.error || 'Invalid or expired verification code';
      showModalMessage('error', '✕ ' + friendlyError);
    }
  };

  const handleSignUp = async () => {
    if (!validateStep3()) return;

    setLoading(true);
    setError('');

    try {
      const result = await verificationService.registerUser({
        username: formData.username,
        email: formData.email,
        fullName: formData.fullName,
        password: formData.password
      });

      if (result.success) {
        showModalMessage('success', 'Account created successfully!');
        if (onRegister) {
          setTimeout(() => {
            onRegister({
              user: result.user,
              formData: formData
            });
          }, 1500);
        }
        setTimeout(() => {
          setFormData({
            fullName: '',
            age: '',
            contactNumber: '',
            email: '',
            verificationCode: '',
            username: '',
            password: '',
            confirmPassword: ''
          });
          setCurrentStep(1);
          setCodeSent(false);
          setIsVerified(false);
        }, 2000);
      } else {
        setError(result.message || 'Registration failed. Please try again.');
      }
    } catch (err) {
      setError('Registration failed. Please try again.');
      console.error('Registration error:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <>
            <div className={styles.inputGroup}>
              <input
                type="text"
                name="fullName"
                placeholder="Full Name"
                className={styles.input}
                value={formData.fullName}
                onChange={handleInputChange}
                disabled={loading}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <input
                type="text"
                name="age"
                placeholder="Age"
                className={styles.input}
                value={formData.age}
                onChange={handleInputChange}
                disabled={loading}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <input
                type="text"
                name="contactNumber"
                placeholder="Contact Number (11 digits)"
                className={styles.input}
                value={formData.contactNumber}
                onChange={handleInputChange}
                disabled={loading}
                required
              />
            </div>

            <button
              className={styles.submitButton}
              onClick={handleNext}
              disabled={loading}
            >
              NEXT
            </button>
          </>
        );

      case 2:
        return (
          <>
            <div className={styles.inputGroup}>
              <input
                type="email"
                name="email"
                placeholder="Email Address"
                className={styles.input}
                value={formData.email}
                onChange={handleInputChange}
                disabled={loading || isVerified}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <div className={styles.verificationRow}>
                <input
                  type="text"
                  name="verificationCode"
                  placeholder="6-digit code"
                  className={`${styles.verificationInput} ${isVerified ? styles.verificationInputVerified : ''}`}
                  value={formData.verificationCode}
                  onChange={handleInputChange}
                  disabled={loading || isVerified || verifyingCode || !codeSent}
                  required
                  maxLength={6}
                />
                <button
                  type="button"
                  className={`${styles.verifyButton} ${(sendingCode || countdown > 0 || isVerified) ? styles.verifyButtonDisabled : ''}`}
                  onClick={handleSendCode}
                  disabled={sendingCode || loading || countdown > 0 || isVerified}
                >
                  {sendingCode ? 'Sending...' : countdown > 0 ? `${countdown}s` : codeSent ? 'Resend' : 'Send Code'}
                </button>
              </div>
              
              {!codeSent && !isVerified && (
                <div className={styles.hintText}>
                  Click "Send Code" to receive verification code via email
                </div>
              )}
              
              {verifyingCode && (
                <div className={styles.verifiedText}>
                  Verifying...
                </div>
              )}
              
              {isVerified && (
                <div className={styles.verifiedText}>
                  ✓ Email verified successfully
                </div>
              )}
            </div>

            <div className={styles.buttonRow}>
              <button
                className={styles.backButton}
                onClick={handleBack}
                disabled={loading}
              >
                BACK
              </button>
              <button
                className={styles.submitButton}
                onClick={handleNext}
                disabled={loading}
              >
                NEXT
              </button>
            </div>
          </>
        );

      case 3:
        return (
          <>
            <div className={styles.inputGroup}>
              <input
                type="text"
                name="username"
                placeholder="Username"
                className={styles.input}
                value={formData.username}
                onChange={handleInputChange}
                disabled={loading}
                required
                maxLength={20}
              />
            </div>

            <div className={styles.inputGroup}>
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Password (min. 6 characters)"
                className={styles.input}
                value={formData.password}
                onChange={handleInputChange}
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

            <div className={styles.inputGroup}>
              <input
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                placeholder="Confirm Password"
                className={styles.input}
                value={formData.confirmPassword}
                onChange={handleInputChange}
                disabled={loading}
                required
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={loading}
              >
                {showConfirmPassword ? "Hide" : "Show"}
              </button>
            </div>

            <div className={styles.buttonRow}>
              <button
                className={styles.backButton}
                onClick={handleBack}
                disabled={loading}
              >
                BACK
              </button>
              <button
                className={styles.submitButton}
                onClick={handleSignUp}
                disabled={loading}
              >
                {loading ? 'Creating Account...' : 'SIGN UP'}
              </button>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className={styles.container}>
      {/* Modal */}
      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modal} ${modalType === 'success' ? styles.modalSuccess : styles.modalError}`}>
            <div className={styles.modalIcon}>
              {modalType === 'success' ? '✓' : '✕'}
            </div>
            <p className={styles.modalMessage}>{modalMessage}</p>
          </div>
        </div>
      )}

      <div className={styles.mainCard}>
        <div className={styles.cardContainer}>
          {/* Welcome Section */}
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
                <button onClick={onSwitchToLogin} className={styles.toggleButton}>
                  Log In
                </button>

                <h1 className={styles.welcomeTitle}>
                  Beauty Awaits at <span className={styles.welcomeBrand}>Perfectly Salon</span>
                </h1>

                <p className={styles.welcomeText}>
                  Join thousands who trust us for premium beauty and wellness services. Your transformation starts here.
                </p>

                <div className={styles.navigationDots}>
                  <div className={currentStep === 1 ? styles.dot : styles.dotInactive}></div>
                  <div className={currentStep === 2 ? styles.dot : styles.dotInactive}></div>
                  <div className={currentStep === 3 ? styles.dot : styles.dotInactive}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Form Section */}
          <div className={styles.formSection}>
            <div className={styles.formContent}>
              {/* Logo */}
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
                Sign Up - Step {currentStep} of 3
              </h2>

              {/* Error Message */}
              {error && (
                <div className={styles.errorMessage}>
                  {error}
                </div>
              )}

              {/* Progress Bar */}
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill} 
                  style={{ width: `${(currentStep / 3) * 100}%` }}
                ></div>
              </div>

              {/* Form Fields */}
              <div className={styles.formFields}>
                {renderStepContent()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;