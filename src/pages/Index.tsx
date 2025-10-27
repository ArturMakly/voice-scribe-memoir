import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import VoiceInterface from '@/components/VoiceInterface';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, LogOut } from 'lucide-react';
import { User } from '@supabase/supabase-js';

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [transcript, setTranscript] = useState<Array<{ speaker: string; text: string }>>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate('/auth');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleTranscript = async (text: string, speaker: 'user' | 'assistant') => {
    let sessionId = sessionIdRef.current;

    // Create session on first user message (use ref to prevent race conditions)
    if (!sessionId && speaker === 'user') {
      console.log('Creating new session...');
      const { data, error } = await supabase
        .from('memoir_sessions')
        .insert({ user_id: user!.id, title: 'New Session' })
        .select()
        .single();

      if (error) {
        console.error('Error creating session:', error);
        toast({
          title: "Error creating session",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      console.log('Session created:', data.id);
      sessionId = data.id;
      sessionIdRef.current = data.id;
      setCurrentSessionId(data.id);
    }

    // Use functional setState to ensure we work with the latest state
    setTranscript(prevTranscript => {
      const updatedTranscript = [...prevTranscript, { speaker, text }];
      
      // Save to database if we have a session (async operation outside of setState)
      if (sessionId) {
        const transcriptText = updatedTranscript.map(t => `${t.speaker}: ${t.text}`).join('\n\n');
        console.log(`Updating session ${sessionId} with transcript (${transcriptText.length} chars)`);
        
        supabase
          .from('memoir_sessions')
          .update({ 
            transcript: transcriptText,
            updated_at: new Date().toISOString()
          })
          .eq('id', sessionId)
          .then(({ error }) => {
            if (error) {
              console.error('Error updating session:', error);
            } else {
              console.log('Session transcript updated successfully');
            }
          });
      }
      
      return updatedTranscript;
    });
  };

  const endSession = async () => {
    if (!currentSessionId) return;

    try {
      const fullTranscript = transcript.map(t => `${t.speaker}: ${t.text}`).join('\n\n');
      
      await supabase
        .from('memoir_sessions')
        .update({ 
          status: 'completed',
          ended_at: new Date().toISOString(),
          transcript: fullTranscript
        })
        .eq('id', currentSessionId);

      const userContent = transcript
        .filter(t => t.speaker === 'user')
        .map(t => t.text)
        .join('\n\n');

      if (userContent) {
        const { data: existingChapters } = await supabase
          .from('memoir_chapters')
          .select('chapter_number')
          .eq('user_id', user!.id)
          .order('chapter_number', { ascending: false })
          .limit(1);

        const nextChapterNum = existingChapters && existingChapters.length > 0 
          ? existingChapters[0].chapter_number + 1 
          : 1;

        await supabase
          .from('memoir_chapters')
          .insert({
            session_id: currentSessionId,
            user_id: user!.id,
            title: `Chapter ${nextChapterNum}`,
            content: userContent,
            chapter_number: nextChapterNum
          });
      }

      toast({
        title: "Session completed",
        description: "Your memoir has been saved.",
      });

      sessionIdRef.current = null;
      setCurrentSessionId(null);
      setTranscript([]);
    } catch (error: any) {
      toast({
        title: "Error saving session",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen memoir-gradient">
      <div className="container max-w-4xl mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-serif font-bold mb-2">Memoir</h1>
            <p className="text-muted-foreground">Share your story, one conversation at a time</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/chapters')}
              className="gap-2"
            >
              <BookOpen className="h-4 w-4" />
              View Chapters
            </Button>
            <Button
              variant="ghost"
              onClick={handleSignOut}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>

        <Card className="memoir-gradient border-border/50 mb-8">
          <CardHeader>
            <CardTitle className="font-serif text-center">Record Your Story</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center py-12">
            <VoiceInterface
              onSpeakingChange={setIsSpeaking}
              onTranscript={handleTranscript}
            />
            {currentSessionId && (
              <Button
                variant="outline"
                onClick={endSession}
                className="mt-6"
              >
                Save & End Session
              </Button>
            )}
          </CardContent>
        </Card>

        {transcript.length > 0 && (
          <Card className="memoir-gradient border-border/50">
            <CardHeader>
              <CardTitle className="font-serif">Conversation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {transcript.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg ${
                      item.speaker === 'user' 
                        ? 'bg-accent/30 ml-8' 
                        : 'bg-primary/10 mr-8'
                    }`}
                  >
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {item.speaker === 'user' ? 'You' : 'Guide'}
                    </p>
                    <p className="font-serif text-foreground/90">{item.text}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Index;
