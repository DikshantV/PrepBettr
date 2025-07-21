# Resume Tailoring Feature - Dependencies

## NPM Dependencies (Frontend & Backend)

### Core Dependencies
```json
{
  "@google/generative-ai": "^0.21.0",
  "pdf-parse": "^1.1.1",
  "pdf-lib": "^1.17.1",
  "jspdf": "^2.5.1",
  "html2canvas": "^1.4.1",
  "mammoth": "^1.6.0",
  "cheerio": "^1.0.0-rc.12",
  "axios": "^1.6.0",
  "formidable": "^3.5.1",
  "mime-types": "^2.1.35"
}
```

### Development Dependencies
```json
{
  "@types/pdf-parse": "^1.1.1",
  "@types/formidable": "^3.4.5",
  "@types/mime-types": "^2.1.4",
  "@types/cheerio": "^0.22.35"
}
```

### UI Components (already in PrepBettr)
- `@radix-ui/react-dialog`
- `@radix-ui/react-progress` 
- `@radix-ui/react-toast`
- `framer-motion`
- `lucide-react`

## Google Gemini API Setup

### Environment Variables
```env
GOOGLE_GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-1.5-pro
GEMINI_TEMPERATURE=0.7
GEMINI_MAX_TOKENS=4096
```

### API Configuration
- Model: `gemini-1.5-pro` (recommended for complex text analysis)
- Temperature: 0.7 (balanced creativity/consistency)
- Max Tokens: 4096 (sufficient for resume content)
- Safety Settings: Medium (allow professional content)

## File Storage Configuration

### Temporary Storage (Development)
- Local filesystem with cleanup
- Maximum file size: 10MB
- Allowed types: PDF, DOC, DOCX, TXT
- Retention: 24 hours

### Production Storage (Recommended)
- AWS S3 or Google Cloud Storage
- Encryption at rest
- Lifecycle policies for cleanup
- CDN for file serving

## Performance Considerations

### Caching Strategy
- Redis for analysis results (1 hour TTL)
- File processing results (24 hour TTL)
- User preferences and configs

### Rate Limiting
- Gemini API: 60 requests/minute
- File uploads: 10 files/hour per user
- Processing queue for high-volume scenarios

## Security Measures

### File Validation
- MIME type verification
- File size limits
- Content scanning for malicious files
- Sandboxed processing environment

### Data Privacy
- Temporary file encryption
- Automatic cleanup after processing
- No persistent storage of resume content
- Audit logs for compliance

## Monitoring & Logging

### Metrics to Track
- Processing success/failure rates
- Average processing time
- Gemini API usage and costs
- File upload/download statistics
- User engagement metrics

### Error Handling
- Graceful degradation
- User-friendly error messages
- Retry mechanisms for API failures
- Fallback options for service outages
