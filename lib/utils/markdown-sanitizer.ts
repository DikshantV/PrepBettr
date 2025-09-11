/**
 * Markdown Sanitizer for Text-to-Speech
 * 
 * Removes Markdown formatting symbols that should not be spoken aloud
 * while preserving the actual content and natural speech flow.
 */

/**
 * Strip Markdown formatting from text for TTS processing
 * @param text - Raw text that may contain Markdown formatting
 * @returns Clean text suitable for speech synthesis
 */
export function sanitizeTextForTTS(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let cleanText = text;

  // Remove headers (# ## ### etc.) but keep the text
  cleanText = cleanText.replace(/^#{1,6}\s+/gm, '');

  // Remove bold/italic formatting but keep the text
  cleanText = cleanText.replace(/\*\*\*(.*?)\*\*\*/g, '$1'); // Bold italic
  cleanText = cleanText.replace(/\*\*(.*?)\*\*/g, '$1'); // Bold
  cleanText = cleanText.replace(/\*(.*?)\*/g, '$1'); // Italic
  cleanText = cleanText.replace(/__(.*?)__/g, '$1'); // Bold alt
  cleanText = cleanText.replace(/_(.*?)_/g, '$1'); // Italic alt

  // Remove strikethrough but keep the text
  cleanText = cleanText.replace(/~~(.*?)~~/g, '$1');

  // Remove inline code formatting but keep the text
  cleanText = cleanText.replace(/`([^`]+)`/g, '$1');

  // Remove code blocks but keep the content with proper spacing
  cleanText = cleanText.replace(/```[\s\S]*?\n([\s\S]*?)```/g, '$1');

  // Remove blockquotes but keep the text
  cleanText = cleanText.replace(/^>\s+/gm, '');

  // Convert lists to natural speech format
  cleanText = cleanText.replace(/^\s*[-*+]\s+/gm, ''); // Remove bullet points
  cleanText = cleanText.replace(/^\s*\d+\.\s+/gm, ''); // Remove numbered list markers

  // Remove horizontal rules
  cleanText = cleanText.replace(/^[-*_]{3,}$/gm, '');

  // Remove table formatting - convert to sentences
  cleanText = cleanText.replace(/\|/g, ' '); // Remove table pipes
  cleanText = cleanText.replace(/^:?-+:?\s*$/gm, ''); // Remove table separators

  // Remove link formatting but keep the link text
  cleanText = cleanText.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');

  // Remove image alt text formatting
  cleanText = cleanText.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');

  // Remove reference-style links
  cleanText = cleanText.replace(/\[([^\]]*)\]\s*\[[^\]]*\]/g, '$1');

  // Clean up excessive whitespace and normalize
  cleanText = cleanText.replace(/\n{3,}/g, '\n\n'); // Max 2 line breaks
  cleanText = cleanText.replace(/[ \t]{2,}/g, ' '); // Multiple spaces to single
  cleanText = cleanText.trim();

  // Convert remaining line breaks to natural speech pauses
  cleanText = cleanText.replace(/\n\n+/g, '. '); // Double line breaks become sentence breaks
  cleanText = cleanText.replace(/\n/g, ' '); // Single line breaks become spaces

  // Clean up any double periods or spaces
  cleanText = cleanText.replace(/\.{2,}/g, '.'); 
  cleanText = cleanText.replace(/\s{2,}/g, ' ');

  return cleanText.trim();
}

/**
 * Additional sanitization for interview-specific content
 * @param text - Text from AI interviewer responses
 * @returns Text optimized for natural speech in interview context
 */
export function sanitizeInterviewText(text: string): string {
  let cleanText = sanitizeTextForTTS(text);

  // Replace technical abbreviations with full words for better pronunciation
  const technicalReplacements: Record<string, string> = {
    'API': 'A-P-I',
    'REST': 'REST',
    'HTTP': 'H-T-T-P',
    'HTTPS': 'H-T-T-P-S',
    'JSON': 'J-S-O-N',
    'XML': 'X-M-L',
    'SQL': 'S-Q-L',
    'HTML': 'H-T-M-L',
    'CSS': 'C-S-S',
    'URL': 'U-R-L',
    'UI/UX': 'User Interface and User Experience',
    'CRUD': 'Create, Read, Update, Delete',
    'MVC': 'Model View Controller'
  };

  for (const [abbr, replacement] of Object.entries(technicalReplacements)) {
    const regex = new RegExp(`\\b${abbr}\\b`, 'g');
    cleanText = cleanText.replace(regex, replacement);
  }

  // Ensure questions end with proper intonation
  if (cleanText.includes('?') && !cleanText.trim().endsWith('?')) {
    // Move question marks to end if they're in the middle
    cleanText = cleanText.replace(/\?([^?]*?)$/, '$1?');
  }

  return cleanText;
}

/**
 * Quick test function to verify sanitization
 * @param markdownText - Text to test
 */
export function testMarkdownSanitization(markdownText: string): void {
  console.log('Original:', markdownText);
  console.log('Sanitized:', sanitizeTextForTTS(markdownText));
  console.log('Interview-optimized:', sanitizeInterviewText(markdownText));
}

// Example usage:
// testMarkdownSanitization("Great! Let's **discuss** your experience with `React` and *Next.js*. ## Technical Questions\n\n- What is your favorite **API** design pattern?\n- How do you handle **error** handling in *production*?");
