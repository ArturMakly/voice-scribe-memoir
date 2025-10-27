import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    // We pass previous sessions back to the client so it can inject them as conversation items
    const { previousSessions } = await req.json().catch(() => ({ previousSessions: [] }));
    
    console.log(`Requesting ephemeral token for session (${previousSessions?.length || 0} previous sessions will be loaded by client)...`);

    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-realtime",
        voice: "Alloy",
        input_audio_transcription: {
          model: "whisper-1"
        },
        instructions: `You are a compassionate memoir guide helping someone tell their life story. 

Your role:
- Ask thoughtful, open-ended questions about their life experiences
- Listen actively and follow up on interesting details
- Guide them through different life chapters: childhood, family, career, relationships, challenges, achievements
- Be warm, empathetic, and encouraging
- Help them explore memories with gentle prompts
- Reference things they've shared in previous sessions naturally
- Build on themes and stories they've mentioned before
- Help them expand and add detail to previous memories

Keep responses conversational and natural. Make them feel comfortable sharing their story.`
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`Failed to get ephemeral token: ${response.status}`);
    }

    const data = await response.json();
    console.log('Ephemeral token received successfully');

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
