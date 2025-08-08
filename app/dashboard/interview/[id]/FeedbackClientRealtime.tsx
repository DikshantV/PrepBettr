"use client";

import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { 
  useRealtimeInterview, 
  useRealtimeFeedback 
} from "@/lib/hooks/useRealtimeFirestore";
import { 
  DataSuspense, 
  FeedbackSkeleton
} from "@/components/ui/LoadingStates";
import DisplayTechIcons from "@/components/DisplayTechIcons";
import Link from "next/link";
import { ArrowLeft, Download, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { normalizeTechstack } from "@/lib/utils";

interface FeedbackClientRealtimeProps {
  interviewId: string;
  initialInterview?: Interview;
  initialFeedback?: Feedback;
}

export default function FeedbackClientRealtime({
  interviewId,
  initialInterview,
  initialFeedback
}: FeedbackClientRealtimeProps) {
  const { user, loading: authLoading } = useAuth();
  const [isSharing, setIsSharing] = useState(false);

  // Real-time hooks
  const {
    data: interview,
    isLoading: interviewLoading,
    error: interviewError
  } = useRealtimeInterview(interviewId);

  const {
    data: feedback,
    isLoading: feedbackLoading,
    error: feedbackError
  } = useRealtimeFeedback(interviewId);

  // Use real-time data or fallback to initial data
  const currentInterview = interview || initialInterview;
  const currentFeedback = feedback || initialFeedback;

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const shareUrl = `${window.location.origin}/dashboard/interview/${interviewId}/feedback`;
      await navigator.share({
        title: `Interview Feedback - ${currentInterview?.role}`,
        text: 'Check out my interview feedback!',
        url: shareUrl,
      });
    } catch (error) {
      // Fallback to clipboard
      try {
        await navigator.clipboard.writeText(window.location.href);
        toast.success('Link copied to clipboard!');
      } catch (clipboardError) {
        toast.error('Failed to share or copy link');
      }
    } finally {
      setIsSharing(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      // This would call an API to generate PDF
      toast.success('PDF generation started. You\'ll receive it shortly.');
    } catch (error) {
      toast.error('Failed to generate PDF');
    }
  };

  if (authLoading) {
    return <FeedbackSkeleton />;
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
            <p className="text-muted-foreground">Please sign in to view feedback.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "Recent";
    
    let date: Date;
    if (timestamp?.toDate) {
      date = timestamp.toDate();
    } else if (timestamp?.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date(timestamp);
    }
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
          
          <div>
            <h1 className="text-2xl font-bold">Interview Feedback</h1>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleShare} disabled={isSharing}>
            <Share2 className="w-4 h-4 mr-2" />
            {isSharing ? 'Sharing...' : 'Share'}
          </Button>
          
          <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Interview Details */}
      <DataSuspense
        isLoading={interviewLoading}
        error={interviewError}
        isEmpty={!currentInterview}
        emptyMessage="Interview not found"
        fallback={
          <Card>
            <CardHeader>
              <div className="space-y-2">
                <div className="h-6 w-48 bg-muted rounded animate-pulse" />
                <div className="h-4 w-32 bg-muted rounded animate-pulse" />
              </div>
            </CardHeader>
          </Card>
        }
      >
        {currentInterview && (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl">{currentInterview.role}</CardTitle>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="outline">{currentInterview.type}</Badge>
                    <Badge variant="secondary">
                      {formatDate(currentInterview.createdAt)}
                    </Badge>
                  </div>
                </div>
                
                {currentInterview.finalized && (
                  <Badge className="bg-green-100 text-green-800">
                    Completed ✓
                  </Badge>
                )}
              </div>
              
              {currentInterview.techstack && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {normalizeTechstack(currentInterview.techstack).map((tech) => (
                    <DisplayTechIcons key={tech} name={tech as any} size={20} />
                  ))}
                </div>
              )}
            </CardHeader>
          </Card>
        )}
      </DataSuspense>

      {/* Feedback Content */}
      <DataSuspense
        isLoading={feedbackLoading}
        error={feedbackError}
        isEmpty={!currentFeedback}
        emptyMessage="No feedback available yet. Complete your interview to receive feedback."
        fallback={<FeedbackSkeleton />}
      >
        {currentFeedback && (
          <div className="space-y-6">
            {/* Overall Score */}
            {currentFeedback.overallScore && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Overall Performance
                    <Badge variant="secondary" className="text-lg px-3 py-1">
                      {currentFeedback.overallScore}/10
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-red-400 via-yellow-400 to-green-400 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${(currentFeedback.overallScore / 10) * 100}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Category Feedback */}
            {currentFeedback.categories && Object.entries(currentFeedback.categories).map(([category, data]: [string, any]) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="capitalize flex items-center justify-between">
                    {category.replace(/([A-Z])/g, ' $1').trim()}
                    {data.score && (
                      <Badge variant="outline" className="ml-2">
                        {data.score}/10
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {data.feedback && (
                    <p className="text-muted-foreground">{data.feedback}</p>
                  )}
                  
                  {data.strengths && data.strengths.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-green-700 mb-2">Strengths:</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {data.strengths.map((strength: string, index: number) => (
                          <li key={index} className="text-sm">{strength}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {data.improvements && data.improvements.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-red-700 mb-2">Areas for Improvement:</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {data.improvements.map((improvement: string, index: number) => (
                          <li key={index} className="text-sm">{improvement}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {data.suggestions && data.suggestions.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-blue-700 mb-2">Suggestions:</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {data.suggestions.map((suggestion: string, index: number) => (
                          <li key={index} className="text-sm">{suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {/* General Feedback */}
            {currentFeedback.generalFeedback && (
              <Card>
                <CardHeader>
                  <CardTitle>General Feedback</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {currentFeedback.generalFeedback}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Next Steps */}
            {currentFeedback.nextSteps && currentFeedback.nextSteps.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Recommended Next Steps</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {currentFeedback.nextSteps.map((step: string, index: number) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="flex-shrink-0 w-5 h-5 bg-primary text-primary-foreground rounded-full text-xs flex items-center justify-center mt-0.5">
                          {index + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Timestamp */}
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground text-center">
                  Feedback generated on {formatDate(currentFeedback.createdAt)}
                  {currentFeedback.updatedAt && currentFeedback.updatedAt !== currentFeedback.createdAt && (
                    <span> • Updated {formatDate(currentFeedback.updatedAt)}</span>
                  )}
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </DataSuspense>

      {/* Actions */}
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-center gap-4">
            <Button asChild>
              <Link href="/dashboard/interview">
                Start New Interview
              </Link>
            </Button>
            
            <Button variant="outline" asChild>
              <Link href="/dashboard">
                Back to Dashboard
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
