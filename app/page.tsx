'use client';

import { FileInput } from './components/ui/button';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

// Use environment variables for Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function Home() {
  const [submitted, setSubmitted] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      setSelectedFile(file);
      setUploading(true);

      // Upload file to Supabase
      const { data, error } = await supabase.storage
        .from('cv-uploads')  // Replace 'cv-uploads' with your bucket name
        .upload(`cvs/${file.name}`, file, {
          cacheControl: '3600',
          upsert: false,
        });

      setUploading(false);

      if (error) {
        console.error('Error uploading file:', error.message);
        return;
      }

      // Store file info in sessionStorage
      if (data) {
        const filePath = data.path;
        sessionStorage.setItem('submittedCVPath', filePath);
        sessionStorage.setItem('submittedCVName', file.name);
        sessionStorage.setItem('submittedCVType', file.type);

        setSubmitted(true);
      }
    }
  };

  if (submitted) {
    setTimeout(() => {
      router.push('../pages/dashboard');
    }, 1000);
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-4xl font-bold mb-8 text-gray-800">Welcome to CV Submission</h1>
      {submitted ? (
        <div className="animate-pulse text-2xl text-green-600 font-semibold">
          CV Submitted Successfully!
        </div>
      ) : uploading ? (
        <div className="text-xl text-gray-600">Uploading...</div>
      ) : (
        <FileInput 
          className="px-6 py-3 text-lg font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors duration-300 shadow-lg"
          onChange={handleSubmit}
        >
          Submit Your CV
        </FileInput>
      )}
    </div>
  );
}
