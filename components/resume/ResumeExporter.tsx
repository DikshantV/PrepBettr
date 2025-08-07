'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, Zap, Eye, Star } from 'lucide-react';
import { toast } from 'sonner';
import { ResumeData, ATS_TEMPLATES } from '@/lib/services/resume-export-service';

interface ResumeExporterProps {
  resumeData: ResumeData;
  onExport?: (format: string, template: string) => void;
}

export default function ResumeExporter({ resumeData, onExport }: ResumeExporterProps) {
  const [selectedTemplate, setSelectedTemplate] = useState('classic');
  const [selectedFormat, setSelectedFormat] = useState('pdf');
  const [optimizeKeywords, setOptimizeKeywords] = useState(false);
  const [jobDescription, setJobDescription] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [atsScore, setATSScore] = useState<number | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleExport = async () => {
    if (!resumeData) {
      toast.error('No resume data available');
      return;
    }

    setIsExporting(true);
    
    try {
      const requestBody = {
        resumeData,
        template: selectedTemplate,
        format: selectedFormat,
        optimizeKeywords: optimizeKeywords && jobDescription.trim() !== '',
        jobDescription: optimizeKeywords ? {
          title: 'Target Position',
          requirements: jobDescription.split('\n').filter(line => line.trim() !== ''),
          preferredSkills: [],
          responsibilities: []
        } : undefined
      };

      const response = await fetch('/api/resume/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const contentDisposition = response.headers.get('content-disposition');
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `resume.${selectedFormat}`;
        
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`Resume exported successfully as ${selectedFormat.toUpperCase()}`);
      onExport?.(selectedFormat, selectedTemplate);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export resume');
    } finally {
      setIsExporting(false);
    }
  };

  const analyzeATSCompatibility = async () => {
    setIsAnalyzing(true);
    
    try {
      const response = await fetch('/api/resume/keywords', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'ats-score',
          resumeData
        }),
      });

      if (!response.ok) {
        throw new Error('ATS analysis failed');
      }

      const { score } = await response.json();
      setATSScore(score.overallScore);
      
      if (score.recommendations?.length > 0) {
        toast.info(`ATS Score: ${score.overallScore}/100`, {
          description: score.recommendations[0]
        });
      }
    } catch (error) {
      console.error('ATS analysis error:', error);
      toast.error('Failed to analyze ATS compatibility');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getATSScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <Card className="w-full max-w-2xl mx-auto bg-gray-900 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Download className="h-5 w-5" />
          Export Resume
        </CardTitle>
        <CardDescription className="text-gray-400">
          Generate ATS-friendly PDF or DOCX resumes with keyword optimization
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Template Selection */}
        <div className="space-y-3">
          <Label className="text-white">ATS Template</Label>
          <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
            <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
              <SelectValue placeholder="Choose a template" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-600">
              {Object.entries(ATS_TEMPLATES).map(([key, template]) => (
                <SelectItem key={key} value={key} className="text-white hover:bg-gray-700">
                  <div className="flex flex-col">
                    <span>{template.name}</span>
                    <span className="text-sm text-gray-400">{template.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Template Tags */}
          <div className="flex flex-wrap gap-1">
            {ATS_TEMPLATES[selectedTemplate]?.keywords.map((keyword) => (
              <Badge key={keyword} variant="secondary" className="text-xs">
                {keyword}
              </Badge>
            ))}
          </div>
        </div>

        {/* Format Selection */}
        <div className="space-y-3">
          <Label className="text-white">Export Format</Label>
          <Select value={selectedFormat} onValueChange={setSelectedFormat}>
            <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-600">
              <SelectItem value="pdf" className="text-white hover:bg-gray-700">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  PDF (Recommended for ATS)
                </div>
              </SelectItem>
              <SelectItem value="docx" className="text-white hover:bg-gray-700">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  DOCX (Editable)
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Keyword Optimization */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-white">Optimize Keywords</Label>
            <Switch 
              checked={optimizeKeywords} 
              onCheckedChange={setOptimizeKeywords}
            />
          </div>
          
          {optimizeKeywords && (
            <div className="space-y-2">
              <Label className="text-gray-300">Job Description</Label>
              <Textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the job description here to optimize your resume with relevant keywords..."
                className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 min-h-[120px]"
              />
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Zap className="h-4 w-4" />
                AI will naturally integrate relevant keywords from the job description
              </div>
            </div>
          )}
        </div>

        {/* ATS Compatibility Check */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-white">ATS Compatibility</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={analyzeATSCompatibility}
              disabled={isAnalyzing}
              className="bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
            >
              {isAnalyzing ? (
                'Analyzing...'
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Check Score
                </>
              )}
            </Button>
          </div>
          
          {atsScore !== null && (
            <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-md">
              <Star className={`h-5 w-5 ${getATSScoreColor(atsScore)}`} />
              <div>
                <span className={`text-lg font-semibold ${getATSScoreColor(atsScore)}`}>
                  {atsScore}/100
                </span>
                <p className="text-sm text-gray-400">
                  {atsScore >= 80 ? 'Excellent ATS compatibility' :
                   atsScore >= 60 ? 'Good ATS compatibility' :
                   'Needs improvement for ATS compatibility'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Export Button */}
        <Button 
          onClick={handleExport} 
          disabled={isExporting || !resumeData}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          size="lg"
        >
          {isExporting ? (
            'Exporting...'
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Export {selectedFormat.toUpperCase()} Resume
            </>
          )}
        </Button>

        {/* Additional Info */}
        <div className="text-sm text-gray-400 space-y-1">
          <p>• ATS-optimized templates ensure your resume passes automated screening</p>
          <p>• Keyword optimization uses AI to naturally integrate job-relevant terms</p>
          <p>• Generated files follow industry best practices for formatting</p>
        </div>
      </CardContent>
    </Card>
  );
}
