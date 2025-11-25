// supabase/functions/register-user/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const { username, email, fullName, password } = await req.json();
    // Validate inputs
    if (!username || !email || !password) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Username, email, and password are required'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const normalizedEmail = email.toLowerCase().trim();
    // Check if email is verified
    const { data: verificationData, error: verificationError } = await supabase.from('verification_codes').select('*').eq('email', normalizedEmail).eq('verified', true).order('verified_at', {
      ascending: false
    }).limit(1);
    if (verificationError || !verificationData || verificationData.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Email not verified. Please verify your email first.'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Check if username already exists
    const { data: existingProfile } = await supabase.from('profiles').select('username').eq('username', username).single();
    if (existingProfile) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Username already taken'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Create user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        username: username,
        full_name: fullName || username
      }
    });
    if (authError) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({
        success: false,
        message: authError.message || 'Failed to create user'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Clean up used verification codes
    await supabase.from('verification_codes').delete().eq('email', normalizedEmail);
    return new Response(JSON.stringify({
      success: true,
      message: 'Account created successfully! You can now log in.',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        username: username
      }
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({
      success: false,
      message: error.message || 'An unexpected error occurred'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
