#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Parse Firebase scan results into structured JSON
 */
function parseFirebaseScan() {
  const firebaseLines = fs.readFileSync('raw-scan/firebase.txt', 'utf8').split('\n').filter(line => line.trim());
  
  const firebaseData = {
    imports: [],
    services: [],
    methods: [],
    files: new Set()
  };

  const servicePatterns = {
    auth: /auth|authentication|signIn|signUp|signOut|onAuthStateChanged|FirebaseUser|getAuth|GoogleAuthProvider/i,
    firestore: /firestore|collection|doc|getDoc|getDocs|query|where|orderBy|setDoc|addDoc|updateDoc|deleteDoc|onSnapshot/i,
    storage: /storage|uploadBytes|getDownloadURL|ref|getStorage|Storage/i,
    admin: /firebase-admin|cert|initializeApp|getApps/i,
    functions: /firebase-functions|onCall|onWrite|onCreate|onUpdate|onDelete/i
  };

  firebaseLines.forEach(line => {
    const match = line.match(/^(.+?):(\d+):(.+)$/);
    if (!match) return;
    
    const [_, filePath, lineNumber, content] = match;
    firebaseData.files.add(filePath);
    
    // Extract imports
    const importMatch = content.match(/import\s+.*from\s+['"](.*firebase.*)['"]/i);
    if (importMatch) {
      firebaseData.imports.push({
        file: filePath,
        line: parseInt(lineNumber),
        import: importMatch[1],
        fullStatement: content.trim()
      });
    }
    
    // Categorize by service type
    for (const [service, pattern] of Object.entries(servicePatterns)) {
      if (pattern.test(content)) {
        firebaseData.services.push({
          file: filePath,
          line: parseInt(lineNumber),
          service,
          content: content.trim()
        });
        break;
      }
    }
    
    // Extract method calls
    const methodMatches = content.match(/(\w+)\s*\(/g);
    if (methodMatches) {
      methodMatches.forEach(methodMatch => {
        const method = methodMatch.replace('(', '');
        if (['getAuth', 'getFirestore', 'getStorage', 'collection', 'doc', 'signInWithPopup', 'onAuthStateChanged'].includes(method)) {
          firebaseData.methods.push({
            file: filePath,
            line: parseInt(lineNumber),
            method,
            context: content.trim()
          });
        }
      });
    }
  });

  firebaseData.files = Array.from(firebaseData.files);
  return firebaseData;
}

/**
 * Parse Azure scan results into structured JSON
 */
function parseAzureScan() {
  const azureLines = fs.readFileSync('raw-scan/azure.txt', 'utf8').split('\n').filter(line => line.trim());
  
  const azureData = {
    imports: [],
    services: [],
    methods: [],
    files: new Set()
  };

  const servicePatterns = {
    keyvault: /@azure\/keyvault|SecretClient|getSecret/i,
    identity: /@azure\/identity|DefaultAzureCredential/i,
    openai: /azure.*openai|OpenAI|chat\.completions/i,
    speech: /microsoft-cognitiveservices-speech|SpeechSDK|SpeechConfig|SpeechRecognizer|SpeechSynthesizer/i,
    storage: /@azure\/storage|BlobServiceClient|QueueServiceClient/i,
    cosmos: /@azure\/cosmos|CosmosClient/i,
    functions: /@azure\/functions|app\./i,
    insights: /applicationinsights|@microsoft\/applicationinsights/i,
    monitor: /@azure\/monitor/i,
    formrecognizer: /@azure\/ai-form-recognizer/i,
    appconfig: /@azure\/app-configuration/i
  };

  azureLines.forEach(line => {
    const match = line.match(/^(.+?):(\d+):(.+)$/);
    if (!match) return;
    
    const [_, filePath, lineNumber, content] = match;
    azureData.files.add(filePath);
    
    // Extract imports
    const importMatch = content.match(/import\s+.*from\s+['"](.*azure.*|.*microsoft-cognitiveservices.*)['"]/i);
    if (importMatch) {
      azureData.imports.push({
        file: filePath,
        line: parseInt(lineNumber),
        import: importMatch[1],
        fullStatement: content.trim()
      });
    }
    
    // Categorize by service type
    for (const [service, pattern] of Object.entries(servicePatterns)) {
      if (pattern.test(content)) {
        azureData.services.push({
          file: filePath,
          line: parseInt(lineNumber),
          service,
          content: content.trim()
        });
        break;
      }
    }
    
    // Extract method calls
    const clientMatches = content.match(/new\s+(\w+Client|\w+Service|\w+Config|\w+Recognizer|\w+Synthesizer)/g);
    if (clientMatches) {
      clientMatches.forEach(clientMatch => {
        const client = clientMatch.replace('new ', '');
        azureData.methods.push({
          file: filePath,
          line: parseInt(lineNumber),
          method: client,
          type: 'client_initialization',
          context: content.trim()
        });
      });
    }
  });

  azureData.files = Array.from(azureData.files);
  return azureData;
}

// Process the scans
const firebaseData = parseFirebaseScan();
const azureData = parseAzureScan();

// Save structured data
fs.writeFileSync('raw-scan/firebase.json', JSON.stringify(firebaseData, null, 2));
fs.writeFileSync('raw-scan/azure.json', JSON.stringify(azureData, null, 2));

console.log('✅ Scan results processed');
console.log(`🔥 Firebase: ${firebaseData.files.length} files, ${firebaseData.imports.length} imports, ${firebaseData.services.length} services`);
console.log(`☁️  Azure: ${azureData.files.length} files, ${azureData.imports.length} imports, ${azureData.services.length} services`);
