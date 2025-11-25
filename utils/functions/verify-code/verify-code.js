// supabase/functions/verify-code/index.ts
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
    const { email, code } = await req.json();
    if (!email || !code) {
      return new Response(JSON.stringify({
        error: 'Email and code are required'
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
    // Find the verification code
    const { data: verificationData, error: fetchError } = await supabase.from('verification_codes').select('*').eq('email', email.toLowerCase().trim()).eq('code', code).eq('verified', false).gt('expires_at', new Date().toISOString()).order('created_at', {
      ascending: false
    }).limit(1).single();
    if (fetchError || !verificationData) {
      return new Response(JSON.stringify({
        verified: false,
        error: 'Invalid or expired verification code'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Mark as verified
    const { error: updateError } = await supabase.from('verification_codes').update({
      verified: true
    }).eq('id', verificationData.id);
    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(JSON.stringify({
        error: 'Failed to verify code'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    return new Response(JSON.stringify({
      verified: true,
      message: 'Email verified successfully'
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
