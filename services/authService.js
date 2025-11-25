// admin/services/authService.js
import supabase from '../utils/supabase.js';

class AuthService {
  // Register user using Supabase Auth
  async registerUser(userData) {
    try {
      const { fullName, email, password } = userData;

      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            full_name: fullName
          },
          emailRedirectTo: `${window.location.origin}/verify-email`
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      // Check if user needs to confirm email
      if (data.user && !data.user.email_confirmed_at) {
        return {
          success: true,
          message: 'Registration successful! Please check your email to verify your account.',
          needsVerification: true,
          user: data.user
        };
      }

      return {
        success: true,
        message: 'Registration successful!',
        needsVerification: false,
        user: data.user
      };

    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        message: error.message || 'Registration failed'
      };
    }
  }

  // Login user using Supabase Auth
  async loginUser(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) {
        throw new Error(error.message);
      }

      // Get user profile
      const profile = await this.getUserProfile(data.user.id);

      return {
        success: true,
        message: 'Login successful!',
        user: data.user,
        profile: profile
      };

    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        message: error.message || 'Login failed'
      };
    }
  }

  // Resend verification email
  async resendVerification(email) {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/verify-email`
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      return {
        success: true,
        message: 'Verification email sent! Please check your inbox.'
      };

    } catch (error) {
      console.error('Resend verification error:', error);
      return {
        success: false,
        message: error.message || 'Failed to resend verification email'
      };
    }
  }

  // Get current user
  async getCurrentUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return null;
      }

      const profile = await this.getUserProfile(user.id);

      return {
        user,
        profile
      };

    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  }

  // Get user profile
  async getUserProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      return data;

    } catch (error) {
      console.error('Get user profile error:', error);
      return null;
    }
  }

  // Update user profile
  async updateProfile(userId, updates) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          ...updates,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return {
        success: true,
        message: 'Profile updated successfully',
        profile: data
      };

    } catch (error) {
      console.error('Update profile error:', error);
      return {
        success: false,
        message: error.message || 'Failed to update profile'
      };
    }
  }

  // Sign out
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        throw error;
      }

      return {
        success: true,
        message: 'Signed out successfully'
      };

    } catch (error) {
      console.error('Sign out error:', error);
      return {
        success: false,
        message: error.message || 'Sign out failed'
      };
    }
  }

  // Listen to auth changes
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
  }

  // Reset password
  async resetPassword(email) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        throw error;
      }

      return {
        success: true,
        message: 'Password reset email sent! Please check your inbox.'
      };

    } catch (error) {
      console.error('Reset password error:', error);
      return {
        success: false,
        message: error.message || 'Failed to send reset password email'
      };
    }
  }

  // Update password
  async updatePassword(newPassword) {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        throw error;
      }

      return {
        success: true,
        message: 'Password updated successfully'
      };

    } catch (error) {
      console.error('Update password error:', error);
      return {
        success: false,
        message: error.message || 'Failed to update password'
      };
    }
  }
}

export default new AuthService();