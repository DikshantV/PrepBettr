import jsPDF from 'jspdf';
import mammoth from 'mammoth';

export interface ResumeData {
  personalInfo: {
    name: string;
    email: string;
    phone: string;
    location: string;
    website?: string;
    linkedin?: string;
    github?: string;
  };
  summary: string;
  experience: Array<{
    title: string;
    company: string;
    location: string;
    startDate: string;
    endDate: string;
    description: string[];
  }>;
  education: Array<{
    degree: string;
    institution: string;
    location: string;
    graduationDate: string;
    gpa?: string;
  }>;
  skills: {
    technical: string[];
    soft: string[];
  };
  projects: Array<{
    name: string;
    description: string;
    technologies: string[];
    link?: string;
  }>;
  certifications: Array<{
    name: string;
    issuer: string;
    date: string;
    link?: string;
  }>;
}

export interface ATSTemplate {
  name: string;
  description: string;
  keywords: string[];
  format: 'pdf' | 'docx';
}

export const ATS_TEMPLATES: Record<string, ATSTemplate> = {
  classic: {
    name: 'Classic ATS',
    description: 'Clean, professional format optimized for ATS parsing',
    keywords: ['professional', 'clean', 'ats-friendly', 'traditional'],
    format: 'pdf'
  },
  modern: {
    name: 'Modern ATS',
    description: 'Contemporary design with ATS compatibility',
    keywords: ['modern', 'contemporary', 'professional', 'clean'],
    format: 'pdf'
  },
  technical: {
    name: 'Technical ATS',
    description: 'Optimized for technical roles with emphasis on skills',
    keywords: ['technical', 'engineering', 'developer', 'skills-focused'],
    format: 'pdf'
  },
  minimal: {
    name: 'Minimal ATS',
    description: 'Simple, distraction-free format for maximum ATS compatibility',
    keywords: ['minimal', 'simple', 'clean', 'ats-optimized'],
    format: 'pdf'
  }
};

export class ResumeExportService {
  private static instance: ResumeExportService;

  public static getInstance(): ResumeExportService {
    if (!ResumeExportService.instance) {
      ResumeExportService.instance = new ResumeExportService();
    }
    return ResumeExportService.instance;
  }

  async generatePDF(resumeData: ResumeData, template: string = 'classic'): Promise<Blob> {
    const pdf = new jsPDF();
    const templateConfig = ATS_TEMPLATES[template] || ATS_TEMPLATES.classic;

    // Set font for better ATS compatibility
    pdf.setFont('helvetica');
    
    let yPosition = 20;
    const lineHeight = 6;
    const pageHeight = pdf.internal.pageSize.height;
    const margin = 20;

    // Helper function to add text with automatic page breaks
    const addText = (text: string, fontSize: number = 10, isBold: boolean = false) => {
      if (yPosition > pageHeight - 30) {
        pdf.addPage();
        yPosition = 20;
      }

      pdf.setFontSize(fontSize);
      pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
      
      const lines = pdf.splitTextToSize(text, pdf.internal.pageSize.width - (margin * 2));
      
      for (const line of lines) {
        if (yPosition > pageHeight - 30) {
          pdf.addPage();
          yPosition = 20;
        }
        pdf.text(line, margin, yPosition);
        yPosition += lineHeight;
      }
    };

    const addSection = (title: string, content: string) => {
      yPosition += 5; // Extra space before section
      addText(title.toUpperCase(), 12, true);
      yPosition += 2;
      
      // Add underline for section headers
      pdf.setDrawColor(0);
      pdf.line(margin, yPosition, pdf.internal.pageSize.width - margin, yPosition);
      yPosition += 5;
      
      addText(content, 10, false);
      yPosition += 5;
    };

    try {
      // Header - Personal Information
      addText(resumeData.personalInfo.name.toUpperCase(), 16, true);
      yPosition += 2;

      const contactInfo = [
        resumeData.personalInfo.email,
        resumeData.personalInfo.phone,
        resumeData.personalInfo.location,
        resumeData.personalInfo.website,
        resumeData.personalInfo.linkedin,
        resumeData.personalInfo.github
      ].filter(Boolean).join(' | ');

      addText(contactInfo, 10, false);

      // Professional Summary
      if (resumeData.summary) {
        addSection('Professional Summary', resumeData.summary);
      }

      // Experience
      if (resumeData.experience.length > 0) {
        yPosition += 5;
        addText('PROFESSIONAL EXPERIENCE', 12, true);
        yPosition += 2;
        pdf.line(margin, yPosition, pdf.internal.pageSize.width - margin, yPosition);
        yPosition += 5;

        resumeData.experience.forEach((exp) => {
          addText(`${exp.title} | ${exp.company}`, 11, true);
          addText(`${exp.location} | ${exp.startDate} - ${exp.endDate}`, 9, false);
          
          exp.description.forEach((desc) => {
            addText(`• ${desc}`, 10, false);
          });
          yPosition += 3;
        });
      }

      // Education
      if (resumeData.education.length > 0) {
        addSection('Education', '');
        resumeData.education.forEach((edu) => {
          const eduText = `${edu.degree} | ${edu.institution} | ${edu.location} | ${edu.graduationDate}${edu.gpa ? ` | GPA: ${edu.gpa}` : ''}`;
          addText(eduText, 10, false);
        });
      }

      // Technical Skills
      if (resumeData.skills.technical.length > 0) {
        addSection('Technical Skills', resumeData.skills.technical.join(' • '));
      }

      // Soft Skills
      if (resumeData.skills.soft.length > 0) {
        addSection('Core Competencies', resumeData.skills.soft.join(' • '));
      }

      // Projects
      if (resumeData.projects.length > 0) {
        yPosition += 5;
        addText('PROJECTS', 12, true);
        yPosition += 2;
        pdf.line(margin, yPosition, pdf.internal.pageSize.width - margin, yPosition);
        yPosition += 5;

        resumeData.projects.forEach((project) => {
          addText(project.name, 11, true);
          addText(project.description, 10, false);
          addText(`Technologies: ${project.technologies.join(', ')}`, 9, false);
          if (project.link) {
            addText(`Link: ${project.link}`, 9, false);
          }
          yPosition += 3;
        });
      }

      // Certifications
      if (resumeData.certifications.length > 0) {
        addSection('Certifications', '');
        resumeData.certifications.forEach((cert) => {
          const certText = `${cert.name} | ${cert.issuer} | ${cert.date}${cert.link ? ` | ${cert.link}` : ''}`;
          addText(certText, 10, false);
        });
      }

      return new Blob([pdf.output('blob')], { type: 'application/pdf' });
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new Error('Failed to generate PDF resume');
    }
  }

  async generateDOCX(resumeData: ResumeData, template: string = 'classic'): Promise<Blob> {
    // Create HTML content for DOCX conversion
    const htmlContent = this.generateHTMLContent(resumeData, template);
    
    try {
      // Convert HTML to DOCX using mammoth (reverse process)
      // Note: For production, consider using a dedicated library like docx or officegen
      const docxBuffer = await this.htmlToDocx(htmlContent);
      return new Blob([docxBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });
    } catch (error) {
      console.error('Error generating DOCX:', error);
      throw new Error('Failed to generate DOCX resume');
    }
  }

  private generateHTMLContent(resumeData: ResumeData, template: string): string {
    const templateConfig = ATS_TEMPLATES[template] || ATS_TEMPLATES.classic;
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { 
              font-family: 'Times New Roman', serif; 
              font-size: 12pt; 
              line-height: 1.4; 
              margin: 1in; 
              color: #000;
            }
            .header { text-align: center; margin-bottom: 20pt; }
            .name { font-size: 16pt; font-weight: bold; text-transform: uppercase; }
            .contact { font-size: 10pt; margin-top: 5pt; }
            .section-title { 
              font-size: 12pt; 
              font-weight: bold; 
              text-transform: uppercase; 
              border-bottom: 1pt solid #000; 
              margin-top: 15pt; 
              margin-bottom: 10pt; 
            }
            .job-title { font-weight: bold; }
            .job-details { font-size: 10pt; font-style: italic; }
            ul { margin: 5pt 0; padding-left: 15pt; }
            li { margin-bottom: 3pt; }
            .project-name { font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="name">${resumeData.personalInfo.name}</div>
            <div class="contact">
              ${[
                resumeData.personalInfo.email,
                resumeData.personalInfo.phone,
                resumeData.personalInfo.location,
                resumeData.personalInfo.website,
                resumeData.personalInfo.linkedin,
                resumeData.personalInfo.github
              ].filter(Boolean).join(' | ')}
            </div>
          </div>

          ${resumeData.summary ? `
            <div class="section-title">Professional Summary</div>
            <p>${resumeData.summary}</p>
          ` : ''}

          ${resumeData.experience.length > 0 ? `
            <div class="section-title">Professional Experience</div>
            ${resumeData.experience.map(exp => `
              <div style="margin-bottom: 15pt;">
                <div class="job-title">${exp.title} | ${exp.company}</div>
                <div class="job-details">${exp.location} | ${exp.startDate} - ${exp.endDate}</div>
                <ul>
                  ${exp.description.map(desc => `<li>${desc}</li>`).join('')}
                </ul>
              </div>
            `).join('')}
          ` : ''}

          ${resumeData.education.length > 0 ? `
            <div class="section-title">Education</div>
            ${resumeData.education.map(edu => `
              <p>${edu.degree} | ${edu.institution} | ${edu.location} | ${edu.graduationDate}${edu.gpa ? ` | GPA: ${edu.gpa}` : ''}</p>
            `).join('')}
          ` : ''}

          ${resumeData.skills.technical.length > 0 ? `
            <div class="section-title">Technical Skills</div>
            <p>${resumeData.skills.technical.join(' • ')}</p>
          ` : ''}

          ${resumeData.skills.soft.length > 0 ? `
            <div class="section-title">Core Competencies</div>
            <p>${resumeData.skills.soft.join(' • ')}</p>
          ` : ''}

          ${resumeData.projects.length > 0 ? `
            <div class="section-title">Projects</div>
            ${resumeData.projects.map(project => `
              <div style="margin-bottom: 10pt;">
                <div class="project-name">${project.name}</div>
                <p>${project.description}</p>
                <p><strong>Technologies:</strong> ${project.technologies.join(', ')}</p>
                ${project.link ? `<p><strong>Link:</strong> ${project.link}</p>` : ''}
              </div>
            `).join('')}
          ` : ''}

          ${resumeData.certifications.length > 0 ? `
            <div class="section-title">Certifications</div>
            ${resumeData.certifications.map(cert => `
              <p>${cert.name} | ${cert.issuer} | ${cert.date}${cert.link ? ` | ${cert.link}` : ''}</p>
            `).join('')}
          ` : ''}
        </body>
      </html>
    `;
  }

  private async htmlToDocx(html: string): Promise<ArrayBuffer> {
    // This is a simplified implementation
    // In production, use a proper HTML to DOCX converter like html-docx-js
    const encoder = new TextEncoder();
    const htmlBytes = encoder.encode(html);
    
    // Return HTML as bytes for now - in production, convert to proper DOCX format
    return htmlBytes.buffer;
  }

  getAvailableTemplates(): Record<string, ATSTemplate> {
    return ATS_TEMPLATES;
  }

  validateResumeData(data: Partial<ResumeData>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.personalInfo?.name) {
      errors.push('Name is required');
    }

    if (!data.personalInfo?.email) {
      errors.push('Email is required');
    }

    if (!data.personalInfo?.phone) {
      errors.push('Phone number is required');
    }

    if (!data.experience || data.experience.length === 0) {
      errors.push('At least one work experience entry is required');
    }

    if (!data.education || data.education.length === 0) {
      errors.push('At least one education entry is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export const resumeExportService = ResumeExportService.getInstance();
