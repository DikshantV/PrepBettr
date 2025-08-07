import { NextRequest, NextResponse } from 'next/server';
import { keywordOptimizerService } from '@/lib/services/keyword-optimizer-service';
import { verifySession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await verifySession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      action,
      resumeData,
      jobDescription,
      targetRole,
      targetIndustry,
      experienceLevel = 'mid'
    } = body;

    switch (action) {
      case 'analyze':
        if (!resumeData) {
          return NextResponse.json(
            { error: 'Resume data is required for analysis' },
            { status: 400 }
          );
        }

        const analysis = await keywordOptimizerService.analyzeKeywords(
          resumeData,
          jobDescription,
          targetRole,
          targetIndustry
        );

        return NextResponse.json({ analysis });

      case 'optimize':
        if (!resumeData || !jobDescription) {
          return NextResponse.json(
            { error: 'Resume data and job description are required for optimization' },
            { status: 400 }
          );
        }

        const optimizedContent = await keywordOptimizerService.optimizeResumeContent(
          resumeData,
          jobDescription,
          ['summary', 'experience', 'skills']
        );

        return NextResponse.json({ optimizedContent });

      case 'suggestions':
        if (!targetRole || !targetIndustry) {
          return NextResponse.json(
            { error: 'Target role and industry are required for keyword suggestions' },
            { status: 400 }
          );
        }

        const suggestions = await keywordOptimizerService.generateKeywordSuggestions(
          targetRole,
          targetIndustry,
          experienceLevel
        );

        return NextResponse.json({ suggestions });

      case 'ats-score':
        if (!resumeData) {
          return NextResponse.json(
            { error: 'Resume data is required for ATS scoring' },
            { status: 400 }
          );
        }

        const score = await keywordOptimizerService.scoreAtsCompatibility(resumeData);
        return NextResponse.json({ score });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: analyze, optimize, suggestions, ats-score' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Keyword optimization error:', error);
    return NextResponse.json(
      { 
        error: 'Keyword optimization failed',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
