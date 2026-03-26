import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createRow, deleteRow, listRows, updateRow } from '@/lib/db';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Upload, FileText, Trash2, Loader2, Star } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';

export default function Resumes() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  const { data: resumes = [], isLoading } = useQuery({
    queryKey: ['resumes'],
    queryFn: () => listRows('resumes', '-created_at'),
  });

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    if (!uploadName) setUploadName(file.name.replace(/\.[^/.]+$/, ''));
  };

  const handleUpload = async () => {
    if (!selectedFile) { toast.error('Please select a file'); return; }
    if (!uploadName.trim()) { toast.error('Please enter a name for this resume'); return; }
    try {
      setUploading(true);
      const filePath = `${Date.now()}-${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage.from('resumes').upload(filePath, selectedFile, {
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const { data: fileData } = supabase.storage.from('resumes').getPublicUrl(filePath);
      const file_url = fileData.publicUrl;
      const isFirst = resumes.length === 0;
      await createRow('resumes', {
        name: uploadName.trim(),
        file_url,
        file_name: selectedFile.name,
        is_default: isFirst,
      });
      toast.success('Resume uploaded successfully');
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
      setSelectedFile(null);
      setUploadName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      toast.error(error?.message || 'Resume upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteRow('resumes', id);
      toast.success('Resume deleted');
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
    } catch (error) {
      toast.error(error?.message || 'Failed to delete resume');
    }
  };

  const handleSetDefault = async (resume) => {
    try {
      // Unset all defaults, then set the selected one
      await Promise.all(resumes.map(r =>
        updateRow('resumes', r.id, { is_default: r.id === resume.id })
      ));
      toast.success(`"${resume.name}" set as default`);
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
    } catch (error) {
      toast.error(error?.message || 'Failed to set default resume');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title="Resumes"
        description="Upload and manage your CVs. Select one when creating an application."
      />

      {/* Upload Card */}
      <Card className="mb-6">
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label>Resume Name</Label>
            <Input
              value={uploadName}
              onChange={e => setUploadName(e.target.value)}
              placeholder="e.g. Software Engineer CV 2026"
            />
          </div>
          <div className="space-y-2">
            <Label>File (PDF, DOC, DOCX)</Label>
            <div
              className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {selectedFile ? (
                <div className="flex items-center justify-center gap-2 text-sm text-foreground">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="font-medium">{selectedFile.name}</span>
                  <span className="text-muted-foreground">({(selectedFile.size / 1024).toFixed(0)} KB)</span>
                </div>
              ) : (
                <div className="text-muted-foreground text-sm">
                  <Upload className="w-6 h-6 mx-auto mb-2" />
                  Click to choose a file
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>
          <Button onClick={handleUpload} disabled={uploading || !selectedFile} className="w-full">
            {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Upload Resume
          </Button>
        </CardContent>
      </Card>

      {/* Resume List */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : resumes.length === 0 ? (
        <EmptyState icon={FileText} title="No resumes yet" description="Upload your first CV above." />
      ) : (
        <div className="space-y-3">
          {resumes.map(resume => (
            <Card key={resume.id}>
              <CardContent className="py-4 px-5 flex items-center gap-4">
                <FileText className="w-5 h-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{resume.name}</span>
                    {resume.is_default && (
                      <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                        <Star className="w-3 h-3" /> Default
                      </span>
                    )}
                  </div>
                  {resume.file_name && (
                    <p className="text-xs text-muted-foreground truncate">{resume.file_name}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!resume.is_default && (
                    <Button variant="ghost" size="sm" onClick={() => handleSetDefault(resume)} className="text-xs h-7">
                      Set Default
                    </Button>
                  )}
                  <a href={resume.file_url} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm" className="h-7 text-xs">View</Button>
                  </a>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(resume.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}