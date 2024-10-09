'use client';
import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';

GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.7.76/pdf.worker.mjs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface Role {
  title: string;
  description: string;
  matchScore: number;
}

export default function UserProfile() {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [jobMatches, setJobMatches] = useState<string[]>([]);
    const [summaryText, setSummaryText] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [recommendedRoles, setRecommendedRoles] = useState<Role[]>([]);
  const [isRolesAnimating, setIsRolesAnimating] = useState(false);

  const updateRolesWithAnimation = (newRoles: Role[]) => {
    setIsRolesAnimating(true);
    setTimeout(() => {
      setRecommendedRoles(newRoles);
      setIsRolesAnimating(false);
    }, 300);
  };

  const router = useRouter();

  const [aiProfile, setAiProfile] = useState<{
    name: string;
    title: string;
    summary: string;
    skills: string[];
  } | null>(null);

  const [careerPath, setCareerPath] = useState([
    { role: "Senior Software Engineer", company: "TechCorp", period: "2020 - Present" },
    { role: "Full Stack Developer", company: "WebSolutions Inc.", period: "2017 - 2020" },
    { role: "Junior Developer", company: "StartupXYZ", period: "2015 - 2017" }
  ]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const submittedCVPath = sessionStorage.getItem('submittedCVPath');
      const submittedCVName = sessionStorage.getItem('submittedCVName');
      const submittedCVType = sessionStorage.getItem('submittedCVType');

      if (submittedCVPath && submittedCVName && submittedCVType) {
        setFileUrl(`${supabaseUrl}/storage/v1/object/public/cv-uploads/${submittedCVPath}`);
        setFileName(submittedCVName);
        setFileType(submittedCVType);
      } else {
        setError('No CV found in session storage.');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to fetch data. Please try again.');
    }
  };

  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await getDocument({ data: arrayBuffer }).promise;
    const maxPages = pdf.numPages;
    let extractedText = '';

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => (item as any).str).join(' ');
      extractedText += ` ${pageText}`;
    }

    return extractedText;
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      setUploading(true);
      setIsExtracting(true);

      try {
        const { data, error } = await supabase.storage
          .from('cv-uploads')
          .upload(`cvs/${file.name}`, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (error) throw error;

        const extractedText = await extractTextFromPDF(file);

        if (data) {
          const filePath = data.path;
          sessionStorage.setItem('submittedCVPath', filePath);
          sessionStorage.setItem('submittedCVName', file.name);
          sessionStorage.setItem('submittedCVType', file.type);

          const { error: insertError } = await supabase.from('pdf_texts').insert([
            { file_url: `${supabaseUrl}/storage/v1/object/public/cv-uploads/${filePath}`, text: extractedText },
          ]);

          if (insertError) throw insertError;

          setExtractedText(extractedText);
          fetchData();
        }
      } catch (error) {
        console.error('Error processing file:', error);
        setError('An error occurred while processing the file.');
      } finally {
        setUploading(false);
        setIsExtracting(false);
      }
    }
  };
  const updateSummaryWithAnimation = (newText: string) => {
    setIsAnimating(true);
    setTimeout(() => {
      setSummaryText(newText);
      setIsAnimating(false);
    }, 300); // Match this timing with CSS transition duration
  };
// Modify the generateProfileSummary function
const generateRoleRecommendations = async (profileSummary: string) => {
  try {
    const promptResponse = await fetch('/rolesPrompt.json');
    if (!promptResponse.ok) {
      throw new Error(`Failed to fetch roles prompt template: ${promptResponse.statusText}`);
    }

    const promptData = await promptResponse.json();
    const formattedPrompt = promptData.prompt.replace('{profileSummary}', profileSummary);

    const response = await fetch(process.env.NEXT_PUBLIC_AZURE_OPENAI_ENDPOINT as string, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.NEXT_PUBLIC_AZURE_OPENAI_API_KEY as string,
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: formattedPrompt }],
        max_tokens: 4000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`Error from OpenAI API: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.choices && data.choices.length > 0) {
      const generatedRoles = JSON.parse(data.choices[0].message.content);
      updateRolesWithAnimation(generatedRoles);
    }
  } catch (error) {
    console.error('Error generating role recommendations:', error);
    setError(`Failed to generate role recommendations. Error: ${error.message}`);
  }
};

const generateProfileSummary = async (extractedText: string) => {
  try {
    const promptResponse = await fetch('/profilePrompt.json');
    if (!promptResponse.ok) {
      throw new Error(`Failed to fetch prompt template: ${promptResponse.statusText}`);
    }

    const promptData = await promptResponse.json();
    const formattedPrompt = promptData.prompt.replace('{extractedText}', extractedText);

    const response = await fetch(process.env.NEXT_PUBLIC_AZURE_OPENAI_ENDPOINT as string, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.NEXT_PUBLIC_AZURE_OPENAI_API_KEY as string,
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: formattedPrompt }],
        max_tokens: 4000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`Error from OpenAI API: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.choices && data.choices.length > 0) {
      const generatedProfileContent = data.choices[0].message.content;
      console.log('Generated profile content:', generatedProfileContent);
      
      try {
        const profileData = JSON.parse(generatedProfileContent);
        setAiProfile(profileData);
        
        // Animate the summary update
        updateSummaryWithAnimation(profileData.summary);
      } catch (parseError) {
        console.error('Error parsing profile data:', parseError);
        // If parsing fails, try to use the raw text
        updateSummaryWithAnimation(generatedProfileContent);
      }
    }
  } catch (error) {
    console.error('Error generating profile summary:', error);
    setError(`Failed to generate profile summary. Error: ${error.message}`);
  }
};

  const handleExtractText = async () => {
    if (!fileUrl) {
      setError('No file uploaded. Please upload a CV first.');
      return;
    }

    setIsExtracting(true);
    setError(null);

    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const file = new File([blob], fileName || 'cv.pdf', { type: fileType || 'application/pdf' });

      const extractedText = await extractTextFromPDF(file);
      setExtractedText(extractedText);

      // Generate profile summary using AI
      await generateProfileSummary(extractedText);

      // Mock suggestions and job matches (replace with actual API calls in production)
      setSuggestions(['Add more quantifiable achievements', 'Improve your summary statement', 'Include relevant keywords', 'Enhance your skills section']);
      setJobMatches(['Software Engineer at TechCorp', 'Full Stack Developer at WebSolutions', 'Frontend Specialist at UX Innovators']);
    } catch (error) {
      console.error('Error extracting text:', error);
      setError('Failed to extract text. Please try again or upload a different file.');
    } finally {
      setIsExtracting(false);
    }
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-6">
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => router.push('/')}
              className="p-2 rounded-full bg-gray-70 hover:bg-gray-100 transition-colors shadow-md"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-3xl font-bold text-white">Your Profile</h1>
          </div>
          <label className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors cursor-pointer shadow-md">
            {uploading ? 'Uploading...' : 'Upload New CV'}
            <input
              type="file"
              className="hidden"
              onChange={handleUpload}
              accept=".pdf,.doc,.docx"
            />
          </label>
        </header>

        <div className="grid grid-cols-12 gap-6">
        {/* Profile Summary */}
        <div className="col-span-12 lg:col-span-4 bg-gray-70 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Profile Summary
        </h2>
        
        <p className={`text-sm mb-4 text-gray-300 bg-gray-800 rounded-lg p-4 transition-opacity duration-300 ease-in-out ${isAnimating ? 'opacity-0' : 'opacity-100'}`} style={{ maxHeight: '250px', overflowY: 'auto' }}>
          {summaryText || (aiProfile ? aiProfile.summary : 'Summary will be displayed here once generated')}
        </p>
        <div className="flex flex-wrap gap-2">
          {aiProfile && aiProfile.skills.map((skill, index) => (
            <span key={index} className="px-2 py-1 bg-gray-200 text-gray-400 rounded-full text-xs">
              {skill}
            </span>
          ))}
        </div>
        {/* Recommended Roles Section */}
      <div className="col-span-12 lg:col-span-4 bg-gray-70 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Recommended Roles
        </h2>
        <div className={`space-y-4 transition-opacity duration-300 ease-in-out ${isRolesAnimating ? 'opacity-0' : 'opacity-100'}`}>
          {recommendedRoles.length > 0 ? (
            recommendedRoles.map((role, index) => (
              <div key={index} className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-300">{role.title}</h3>
                  <span className="px-2 py-1 bg-blue-600 text-white text-sm rounded-full">
                    {role.matchScore}% Match
                  </span>
                </div>
                <p className="text-sm text-gray-400">{role.description}</p>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <p className="mt-2 text-sm text-gray-500">
                Role recommendations will appear here after analyzing your profile
              </p>
            </div>
          )}
        </div>
      </div>

      </div>


          {/* CV Preview */}
          <div className="col-span-12 lg:col-span-4 bg-gray-70 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Your CV
            </h2>
            <div className="aspect-[3/4] bg-gray-100 rounded-lg flex items-center justify-center shadow-inner mb-4">
              {fileUrl && fileType ? (
                fileType === 'application/pdf' ? (
                  <iframe
                    src={fileUrl}
                    width="100%"
                    height="100%"
                    title="CV Preview"
                    className="rounded-lg shadow-sm"
                  />
                ) : (
                  <img src={fileUrl} alt="Submitted CV" className="w-full h-auto rounded-lg shadow-sm" />
                )
              ) : (
                <p className="text-gray-500">No CV uploaded yet</p>
              )}
            </div>
            <button
              className={`w-full px-4 py-2 rounded-md text-white font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                isExtracting || !fileUrl
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
              onClick={handleExtractText}
              disabled={isExtracting || !fileUrl}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className={`inline-block mr-2 h-4 w-4 ${isExtracting ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {isExtracting ? 'Extracting...' : 'Extract Text & Analyze'}
            </button>
          </div>

          {/* Extracted Text */}
          <div className="col-span-12 lg:col-span-4 bg-gray-70 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Extracted Text
            </h2>
            <div className="h-64 bg-gray-800 rounded-lg p-4 overflow-y-auto shadow-inner">
              {extractedText ? (
                <p className="text-sm">{extractedText}</p>
              ) : error ? (
                <p className="text-red-500">{error}</p>
              ) : (
                <p className="text-gray-500">No text extracted yet. Click 'Extract Text & Analyze' to begin.</p>
              )}
            </div>
          </div>
{/* Career Path */}
<div className="col-span-12 lg:col-span-6 bg-gray-70 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Career Path
            </h2>
            <ol className="relative border-l border-gray-200">
              {careerPath.map((job, index) => (
                <li key={index} className="mb-10 ml-4">
                  <div className="absolute w-3 h-3 bg-blue-600 rounded-full mt-1.5 -left-1.5 border border-white"></div>
                  <time className="mb-1 text-sm font-normal leading-none text-gray-400">{job.period}</time>
                  <h3 className="text-lg font-semibold">{job.role}</h3>
                  <p className="mb-4 text-base font-normal text-gray-500">{job.company}</p>
                </li>
              ))}
            </ol>
          </div>

          {/* CV Upgrade Suggestions */}
          <div className="col-span-12 lg:col-span-3 bg-gray-70 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              CV Upgrade Suggestions
            </h2>
            <ul className="space-y-2">
              {suggestions.length > 0 ? (
                suggestions.map((suggestion, index) => (
                  <li key={index} className="flex items-start space-x-3 p-2 bg-gray-100 rounded-lg">
                    <span className="inline-flex items-center justify-center rounded-full bg-blue-600 text-white w-6 h-6 text-xs font-medium flex-shrink-0">
                      {index + 1}
                    </span>
                    <p className="text-sm">{suggestion}</p>
                  </li>
                ))
              ) : (
                <p className="text-gray-500">No suggestions available. Extract your CV text to get personalized suggestions.</p>
              )}
            </ul>
          </div>

          {/* Job Matches */}
          <div className="col-span-12 lg:col-span-3 bg-gray-70 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Job Matches
            </h2>
            <ul className="space-y-2">
              {jobMatches.length > 0 ? (
                jobMatches.map((job, index) => (
                  <li key={index} className="p-2 bg-gray-100 rounded-lg text-sm">
                    {job}
                  </li>
                ))
              ) : (
                <p className="text-gray-500">No job matches available. Extract your CV text to find relevant job opportunities.</p>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}