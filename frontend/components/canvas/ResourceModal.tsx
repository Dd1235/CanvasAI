import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileUp, Link as LinkIcon, Type, Loader2, Globe } from "lucide-react";
import { toast } from "sonner";
import { uploadResource } from "@/lib/canvasai-api"; 

export function ResourceModal({ sessionId }: { sessionId: string }) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        await uploadResource(sessionId, {
          resource_type: file.type.includes('pdf') ? 'pdf' : 'text',
          content: text,
          metadata: { filename: file.name }
        });
        toast.success(`${file.name} indexed for grounding`);
        setOpen(false);
      } catch (err) {
        toast.error("Failed to upload document");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file); 
  };

  const handleLinkSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const url = formData.get('url') as string;

    setLoading(true);
    try {
      await uploadResource(sessionId, {
        resource_type: url.includes('youtube.com') ? 'youtube' : 'link',
        content: url,
        metadata: { url }
      });
      toast.success("Link added to grounding context");
      setOpen(false);
    } catch (err) {
      toast.error("Failed to process link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileUp className="w-4 h-4" /> Add Context
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-zinc-950 border-zinc-800 text-white">
        <DialogHeader>
          <DialogTitle>Grounding Resources</DialogTitle>
          <p className="text-sm text-zinc-400">Add documents or links to teach the AI your specific context.</p>
        </DialogHeader>
        
        <Tabs defaultValue="file" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-zinc-900">
            <TabsTrigger value="file"><FileUp className="w-4 h-4 mr-2"/>File</TabsTrigger>
            <TabsTrigger value="link"><LinkIcon className="w-4 h-4 mr-2"/>Link</TabsTrigger>
            <TabsTrigger value="text"><Type className="w-4 h-4 mr-2"/>Text</TabsTrigger>
          </TabsList>

          <TabsContent value="file" className="py-4">
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-lg p-6 hover:border-blue-500 transition-colors">
              <Input type="file" className="hidden" id="file-upload" onChange={handleFileUpload} disabled={loading} accept=".txt,.md,.csv,.json" />
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                {loading ? <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2" /> : <FileUp className="w-8 h-8 text-zinc-500 mb-2" />}
                <span className="text-sm font-medium">{loading ? "Uploading..." : "Click to upload Text/Markdown"}</span>
              </label>
            </div>
          </TabsContent>

          <TabsContent value="link" className="py-4">
            <form onSubmit={handleLinkSubmit} className="space-y-4">
              <Input name="url" placeholder="https://example.com/docs" className="bg-zinc-900 border-zinc-800" required />
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Globe className="w-4 h-4 mr-2" />}
                Index Website Content
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="text" className="py-4">
            <form onSubmit={async (e) => {
               e.preventDefault();
               const text = new FormData(e.currentTarget).get('raw_text') as string;
               setLoading(true);
               await uploadResource(sessionId, { resource_type: 'text', content: text });
               setLoading(false);
               setOpen(false);
               toast.success("Notes added to context");
            }} className="space-y-4">
              <Textarea name="raw_text" placeholder="Paste your lecture notes here..." className="bg-zinc-900 border-zinc-800 h-32 text-white" required />
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save Snippet
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}