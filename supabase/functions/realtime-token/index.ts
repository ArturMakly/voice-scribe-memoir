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

    // Get previous sessions context from request body
    const { previousSessions } = await req.json().catch(() => ({ previousSessions: [] }));
    
    // Build context from previous sessions
    let contextInstructions = '';
    if (previousSessions && previousSessions.length > 0) {
      contextInstructions = `\n\nPREVIOUS CONVERSATIONS:\nYou have already had ${previousSessions.length} conversation(s) with this person. Here's what they've shared:\n\n`;
      previousSessions.forEach((session: any, index: number) => {
        contextInstructions += `Session ${index + 1} (${new Date(session.started_at).toLocaleDateString()}):\n${session.transcript}\n\n`;
      });
      contextInstructions += `\nUse this context to ask deeper, more specific follow-up questions. Reference their previous stories naturally and help them expand on themes or time periods they've mentioned.`;
    }

    console.log(`Requesting ephemeral token with context from ${previousSessions?.length || 0} previous sessions...`);

    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: "sage",
        instructions: `You are a compassionate memoir guide helping someone tell their life story. 

Your role:
- Ask thoughtful, open-ended questions about their life experiences
- Listen actively and follow up on interesting details
- Guide them through different life chapters: childhood, family, career, relationships, challenges, achievements
- Be warm, empathetic, and encouraging
- Help them explore memories with gentle prompts
- Occasionally summarize what they've shared to help structure their story

Keep responses conversational and natural. Make them feel comfortable sharing their story.${contextInstructions}`
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
