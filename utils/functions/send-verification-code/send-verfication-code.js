// supabase/functions/send-verification-code/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const { email } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({
        error: 'Email is required'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    ;
    // Store verification code in database
    const { error: insertError } = await supabase.from('verification_codes').insert({
      email: email.toLowerCase().trim(),
      code: code,
      expires_at: expiresAt.toISOString(),
      verified: false
    });
    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(JSON.stringify({
        error: 'Failed to create verification code'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Send email using Resend API
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'Perfectly Salon <onboarding@resend.dev>',
        to: [
          email
        ],
        subject: 'Your Verification Code - Perfectly Salon',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #db2777 0%, #f43f5e 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .code-box { background: white; border: 2px solid #db2777; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0; }
              .code { font-size: 32px; font-weight: bold; color: #db2777; letter-spacing: 5px; }
              .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Perfectly Salon</h1>
                <p>Email Verification</p>
              </div>
              <div class="content">
                <h2>Verify Your Email Address</h2>
                <p>Thank you for registering with Perfectly Salon! Please use the verification code below to complete your registration:</p>
                <div class="code-box">
                  <div class="code">${code}</div>
                </div>
                <p>This code will expire in 10 minutes.</p>
                <p>If you didn't request this code, please ignore this email.</p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} Perfectly Salon. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `
      })
    });
    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error('Resend API error:', errorData);
      return new Response(JSON.stringify({
        error: 'Failed to send verification email'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    return new Response(JSON.stringify({
      success: true,
      message: 'Verification code sent successfully'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
