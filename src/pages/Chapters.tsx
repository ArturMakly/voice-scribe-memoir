import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, BookOpen, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Chapter {
  id: string;
  title: string;
  content: string;
  chapter_number: number;
  created_at: string;
}

const Chapters = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    loadChapters();
  }, []);

  const loadChapters = async () => {
    try {
      const { data, error } = await supabase
        .from('memoir_chapters')
        .select('*')
        .order('chapter_number', { ascending: true });

      if (error) throw error;
      setChapters(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading chapters",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startEdit = (chapter: Chapter) => {
    setEditingId(chapter.id);
    setEditContent(chapter.content);
  };

  const saveEdit = async (id: string) => {
    try {
      const { error } = await supabase
        .from('memoir_chapters')
        .update({ content: editContent })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Chapter updated",
        description: "Your changes have been saved.",
      });

      setEditingId(null);
      loadChapters();
    } catch (error: any) {
      toast({
        title: "Error saving chapter",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen memoir-gradient flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="h-12 w-12 text-primary animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your chapters...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen memoir-gradient p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Record
          </Button>
          <h1 className="text-3xl font-serif font-bold">Your Chapters</h1>
        </div>

        {chapters.length === 0 ? (
          <Card className="memoir-gradient border-border/50">
            <CardContent className="pt-12 pb-12 text-center">
              <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg text-muted-foreground">
                No chapters yet. Start recording to create your first chapter.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {chapters.map((chapter) => (
              <Card key={chapter.id} className="memoir-gradient border-border/50">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Chapter {chapter.chapter_number}
                      </p>
                      <CardTitle className="font-serif">{chapter.title}</CardTitle>
                    </div>
                    {editingId !== chapter.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(chapter)}
                        className="gap-2"
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {editingId === chapter.id ? (
                    <div className="space-y-4">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full min-h-[200px] p-4 rounded-lg bg-background border border-border font-serif text-foreground resize-none"
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={() => saveEdit(chapter.id)}
                          className="bg-primary hover:bg-primary/90"
                        >
                          Save Changes
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="font-serif text-foreground/90 whitespace-pre-wrap leading-relaxed">
                      {chapter.content}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Chapters;
