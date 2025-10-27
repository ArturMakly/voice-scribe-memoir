import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { RealtimeChat } from '@/utils/RealtimeAudio';
import { supabase } from '@/integrations/supabase/client';
import { Mic, MicOff, Loader2 } from 'lucide-react';

interface VoiceInterfaceProps {
  onSpeakingChange: (speaking: boolean) => void;
  onTranscript: (text: string, speaker: 'user' | 'assistant') => void;
}

const VoiceInterface: React.FC<VoiceInterfaceProps> = ({ onSpeakingChange, onTranscript }) => {
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const chatRef = useRef<RealtimeChat | null>(null);
  const transcriptBufferRef = useRef({ user: '', assistant: '' });

  const handleMessage = (event: any) => {
    console.log('Received event:', event.type);
    
    if (event.type === 'response.audio.delta') {
      setIsSpeaking(true);
      onSpeakingChange(true);
    } else if (event.type === 'response.audio.done') {
      setIsSpeaking(false);
      onSpeakingChange(false);
    } else if (event.type === 'conversation.item.input_audio_transcription.completed') {
      const userText = event.transcript;
      if (userText) {
        onTranscript(userText, 'user');
      }
    } else if (event.type === 'response.audio_transcript.delta') {
      transcriptBufferRef.current.assistant += event.delta;
    } else if (event.type === 'response.audio_transcript.done') {
      const fullTranscript = transcriptBufferRef.current.assistant;
      if (fullTranscript) {
        onTranscript(fullTranscript, 'assistant');
        transcriptBufferRef.current.assistant = '';
      }
    }
  };

  const startConversation = async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }
      
      // Fetch all previous completed sessions to provide context
      const { data: previousSessions } = await supabase
        .from('memoir_sessions')
        .select('started_at, transcript')
        .eq('user_id', session.user.id)
        .eq('status', 'completed')
        .order('started_at', { ascending: true });
      
      console.log(`Loading ${previousSessions?.length || 0} previous sessions into AI memory`);
      
      const tokenUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/realtime-token`;
      
      chatRef.current = new RealtimeChat(handleMessage);
      await chatRef.current.init(tokenUrl, session.access_token, previousSessions || []);
      setIsConnected(true);
      
      toast({
        title: "Connected",
        description: "Voice interface is ready. Start speaking to share your story.",
      });
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast({
        title: "Connection Error",
        description: error instanceof Error ? error.message : 'Failed to start conversation',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const endConversation = () => {
    chatRef.current?.disconnect();
    setIsConnected(false);
    setIsSpeaking(false);
    onSpeakingChange(false);
  };

  useEffect(() => {
    return () => {
      chatRef.current?.disconnect();
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-6">
      {!isConnected ? (
        <Button 
          onClick={startConversation}
          disabled={isLoading}
          size="lg"
          className="memoir-gradient hover:opacity-90 transition-smooth text-primary-foreground shadow-lg h-14 px-8"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Mic className="mr-2 h-5 w-5" />
              Start Recording
            </>
          )}
        </Button>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-smooth ${
            isSpeaking ? 'speaking-glow bg-primary/20' : 'bg-accent'
          }`}>
            <Mic className={`h-12 w-12 ${isSpeaking ? 'text-primary animate-pulse' : 'text-primary'}`} />
          </div>
          <Button 
            onClick={endConversation}
            variant="outline"
            size="lg"
            className="h-12 px-6"
          >
            <MicOff className="mr-2 h-4 w-4" />
            End Session
          </Button>
        </div>
      )}
    </div>
  );
};

export default VoiceInterface;
