import { NextRequest, NextResponse } from 'next/server';
import { resumeExportService } from '@/lib/services/resume-export-service';
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
      resumeData,
      template = 'classic',
      format = 'pdf',
      optimizeKeywords = false,
      jobDescription
    } = body;

    // Validate resume data
    const validation = resumeExportService.validateResumeData(resumeData);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: 'Invalid resume data', details: validation.errors },
        { status: 400 }
      );
    }

    let processedResumeData = resumeData;

    // Optimize keywords if requested
    if (optimizeKeywords && jobDescription) {
      try {
        const optimizedSections = await keywordOptimizerService.optimizeResumeContent(
          resumeData,
          jobDescription,
          ['summary', 'experience', 'skills']
        );

        // Merge optimized content back into resume data
        processedResumeData = {
          ...resumeData,
          ...optimizedSections
        };
      } catch (error) {
        console.warn('Keyword optimization failed, using original resume:', error);
      }
    }

    // Generate resume based on format
    let resumeBlob: Blob;
    let contentType: string;
    let fileExtension: string;

    if (format === 'docx') {
      resumeBlob = await resumeExportService.generateDOCX(processedResumeData, template);
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      fileExtension = 'docx';
    } else {
      resumeBlob = await resumeExportService.generatePDF(processedResumeData, template);
      contentType = 'application/pdf';
      fileExtension = 'pdf';
    }

    // Convert blob to buffer for response
    const buffer = Buffer.from(await resumeBlob.arrayBuffer());
    
    // Generate filename
    const fileName = `${resumeData.personalInfo.name.replace(/\s+/g, '_')}_Resume_${template}.${fileExtension}`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': buffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('Resume export error:', error);
    return NextResponse.json(
      { error: 'Failed to export resume' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const templates = resumeExportService.getAvailableTemplates();
    
    return NextResponse.json({
      templates,
      supportedFormats: ['pdf', 'docx']
    });
  } catch (error) {
    console.error('Error getting templates:', error);
    return NextResponse.json(
      { error: 'Failed to get templates' },
      { status: 500 }
    );
  }
}
