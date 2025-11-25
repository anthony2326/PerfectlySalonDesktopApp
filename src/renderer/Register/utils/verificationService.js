// src/services/verificationService.js
import supabase from '../../../../utils/supabase';

class VerificationService {
  async sendVerificationCode(email) {
    try {
      console.log('Sending verification code to:', email);
      
      const { data, error } = await supabase.functions.invoke('send-verification-code', {
        body: { email: email.toLowerCase().trim() }
      });

      console.log('Send code response:', { data, error });

      if (error) {
        console.error('Error sending verification code:', error);
        return {
          success: false,
          error: error.message || 'Failed to send verification code'
        };
      }

      if (data && data.success) {
        return {
          success: true,
          message: data.message || 'Verification code sent to your email'
        };
      }

      if (data && data.error) {
        return {
          success: false,
          error: data.error
        };
      }

      return {
        success: false,
        error: 'Failed to send verification code'
      };
    } catch (err) {
      console.error('Exception sending verification code:', err);
      return {
        success: false,
        error: err.message || 'An unexpected error occurred'
      };
    }
  }

  async verifyCode(email, code) {
    try {
      console.log('Verifying code for:', email);
      
      const { data, error } = await supabase.functions.invoke('verify-code', {
        body: { 
          email: email.toLowerCase().trim(),
          code: code.trim()
        }
      });

      console.log('Verify code response:', { data, error });

      if (error) {
        console.error('Error verifying code:', error);
        return {
          verified: false,
          error: error.message || 'Failed to verify code'
        };
      }

      if (data && data.verified) {
        return {
          verified: true,
          message: data.message || 'Email verified successfully'
        };
      }

      return {
        verified: false,
        error: data?.error || 'Invalid or expired verification code'
      };
    } catch (err) {
      console.error('Exception verifying code:', err);
      return {
        verified: false,
        error: err.message || 'An unexpected error occurred'
      };
    }
  }

  async registerUser(userData) {
    try {
      console.log('Registering user:', userData.username, userData.email);
      
      // Check if email was verified (use email_verifications table)
      const { data: verificationCheck, error: verifyCheckError } = await supabase
        .from('email_verifications')
        .select('verified')
        .eq('email', userData.email.toLowerCase())
        .eq('verified', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (verifyCheckError || !verificationCheck || verificationCheck.length === 0) {
        return {
          success: false,
          message: 'Email not verified. Please verify your email first.'
        };
      }

      // Check if username already exists
      const { data: existingUsername, error: usernameError } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', userData.username.toLowerCase())
        .maybeSingle();

      if (existingUsername) {
        return {
          success: false,
          message: 'Username already taken. Please choose another one.'
        };
      }

      // Create user with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email.toLowerCase(),
        password: userData.password,
        options: {
          data: {
            username: userData.username.toLowerCase(),
            full_name: userData.fullName || userData.username
          }
        }
      });

      if (authError) {
        console.error('Registration error:', authError);
        
        // Handle specific error cases
        if (authError.message.includes('User already registered')) {
          return {
            success: false,
            message: 'An account with this email already exists.'
          };
        }
        
        return {
          success: false,
          message: authError.message || 'Failed to create account'
        };
      }

      if (!authData.user) {
        return {
          success: false,
          message: 'Failed to create account. Please try again.'
        };
      }

      // Wait a bit for the trigger to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Update profile with additional info (in case trigger didn't set everything)
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: authData.user.id,
          username: userData.username.toLowerCase(),
          full_name: userData.fullName || userData.username
        }, {
          onConflict: 'id'
        });

      if (profileError) {
        console.warn('Profile update warning:', profileError);
        // Don't fail registration if profile update fails
      }

      // Clean up used verification codes from email_verifications table
      await supabase
        .from('email_verifications')
        .delete()
        .eq('email', userData.email.toLowerCase())
        .eq('verified', true);

      // Sign out the user so they can login
      await supabase.auth.signOut();

      return {
        success: true,
        message: 'Account created successfully! Please login to continue.',
        user: {
          id: authData.user.id,
          email: authData.user.email,
          username: userData.username
        }
      };
    } catch (err) {
      console.error('Exception registering user:', err);
      return {
        success: false,
        message: err.message || 'An unexpected error occurred'
      };
    }
  }

  async resendVerification(email) {
    return await this.sendVerificationCode(email);
  }
}

export default new VerificationService();