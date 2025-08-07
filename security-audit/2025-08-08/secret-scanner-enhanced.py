#!/usr/bin/env python3
"""
Enhanced Hard-coded Secrets & High-Risk Strings Scanner
Performs deterministic regex scans with improved false positive filtering
"""

import re
import os
import csv
import subprocess
from pathlib import Path
from typing import List, Tuple, Dict, Any
import json

class EnhancedSecretScanner:
    def __init__(self):
        # Define regex patterns for different secret types
        self.patterns = {
            'base64_pem': {
                'pattern': r'-----BEGIN [A-Z ]+-----[A-Za-z0-9+/\s]+=*-----END [A-Z ]+-----',
                'description': 'Base64 PEM encoded private keys/certificates',
                'min_entropy': 4.0
            },
            'hex_32_40_chars': {
                'pattern': r'\b[a-fA-F0-9]{32,40}\b',
                'description': '32-40 character hex strings (API keys, tokens)',
                'min_entropy': 3.5,
                'exclusions': ['0000000000000000', 'ffffffffffffffff']
            },
            'azure_key_format': {
                'pattern': r'[a-zA-Z0-9/+]{43}=',
                'description': 'Azure storage/service keys (base64, 44 chars ending with =)',
                'min_entropy': 4.0,
                'exclude_contexts': ['integrity', 'sha512', 'package-lock']
            },
            'cfdj_prefix': {
                'pattern': r'CfDJ[a-zA-Z0-9_-]+',
                'description': 'ASP.NET Core Data Protection keys (CfDJ prefix)',
                'min_entropy': 4.0
            },
            'private_key_markers': {
                'pattern': r'(private[_-]?key|privatekey)[\"\']?\s*[:=]\s*[\"\']?[a-zA-Z0-9/+=_-]{20,}',
                'description': 'Private key variable assignments',
                'flags': re.IGNORECASE,
                'exclude_contexts': ['your-', 'example', 'placeholder', 'template']
            },
            'api_key_patterns': {
                'pattern': r'(api[_-]?key|apikey|secret[_-]?key|secretkey|access[_-]?key|accesskey)[\"\']?\s*[:=]\s*[\"\']?[a-zA-Z0-9/+=_-]{20,}',
                'description': 'API key variable assignments',
                'flags': re.IGNORECASE,
                'exclude_contexts': ['your-', 'your_', 'example', 'placeholder', 'template', 'here']
            },
            'jwt_tokens': {
                'pattern': r'eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*',
                'description': 'JWT tokens (base64url encoded)',
                'min_entropy': 4.0
            },
            'aws_access_key': {
                'pattern': r'AKIA[0-9A-Z]{16}',
                'description': 'AWS Access Key ID'
            },
            'github_token': {
                'pattern': r'ghp_[a-zA-Z0-9]{36}',
                'description': 'GitHub Personal Access Token'
            },
            'firebase_config': {
                'pattern': r'(firebase[_-]?config|firebaseConfig)[\"\']?\s*[:=]\s*\{[^}]+\}',
                'description': 'Firebase configuration objects',
                'flags': re.IGNORECASE | re.DOTALL,
                'exclude_contexts': ['your-', 'example', 'placeholder']
            },
            'connection_strings': {
                'pattern': r'(connection[_-]?string|connectionstring|database[_-]?url)[\"\']?\s*[:=]\s*[\"\'][^\"\']{20,}[\"\']',
                'description': 'Database connection strings',
                'flags': re.IGNORECASE,
                'exclude_contexts': ['$', 'your-', 'example']
            },
            'oauth_secrets': {
                'pattern': r'(client[_-]?secret|clientsecret|oauth[_-]?secret)[\"\']?\s*[:=]\s*[\"\']?[a-zA-Z0-9/+=_-]{20,}',
                'description': 'OAuth client secrets',
                'flags': re.IGNORECASE,
                'exclude_contexts': ['your-', 'example', 'placeholder']
            }
        }
        
        # File extensions to scan
        self.scannable_extensions = {
            '.js', '.ts', '.jsx', '.tsx', '.json', '.env', '.yaml', '.yml',
            '.py', '.cs', '.java', '.go', '.php', '.rb', '.sh', '.bash',
            '.config', '.xml', '.properties', '.ini', '.conf', '.cfg',
            '.md', '.txt', '.sql', '.html', '.css', '.scss'
        }

        # Common false positive patterns
        self.false_positive_patterns = [
            r'example',
            r'placeholder',
            r'your[-_]',
            r'template',
            r'demo',
            r'test[-_]',
            r'sample',
            r'sha\d+',
            r'integrity',
            r'checksum'
        ]

    def calculate_entropy(self, text: str) -> float:
        """Calculate Shannon entropy of text"""
        if not text:
            return 0.0
        
        import math
        from collections import Counter
        
        # Get probability of each character
        counter = Counter(text)
        length = len(text)
        
        entropy = 0.0
        for count in counter.values():
            p = count / length
            entropy -= p * math.log2(p)
        
        return entropy

    def is_false_positive(self, match_text: str, context: str, pattern_info: Dict[str, Any]) -> bool:
        """Check if match is likely a false positive"""
        
        # Check for explicitly excluded contexts
        if 'exclude_contexts' in pattern_info:
            for exclude in pattern_info['exclude_contexts']:
                if exclude in context.lower():
                    return True
        
        # Check minimum entropy if specified
        if 'min_entropy' in pattern_info:
            entropy = self.calculate_entropy(match_text)
            if entropy < pattern_info['min_entropy']:
                return True
        
        # Check for exclusions list
        if 'exclusions' in pattern_info:
            if match_text.lower() in [ex.lower() for ex in pattern_info['exclusions']]:
                return True
        
        # Check against common false positive patterns
        for fp_pattern in self.false_positive_patterns:
            if re.search(fp_pattern, context.lower()):
                return True
        
        return False

    def get_tracked_files(self) -> List[str]:
        """Get list of all git-tracked files"""
        try:
            result = subprocess.run(
                ['git', 'ls-files'], 
                capture_output=True, 
                text=True, 
                check=True
            )
            return result.stdout.strip().split('\n')
        except subprocess.CalledProcessError as e:
            print(f"Error getting tracked files: {e}")
            return []

    def should_scan_file(self, file_path: str) -> bool:
        """Determine if file should be scanned based on extension and content"""
        path = Path(file_path)
        
        # Skip node_modules and other common non-source directories
        if any(part.startswith('.') or part in ['node_modules', 'dist', 'build', '__pycache__'] 
               for part in path.parts):
            return False
            
        # Skip package-lock.json (too many false positives)
        if path.name == 'package-lock.json':
            return False
            
        # Check if file extension is scannable
        if path.suffix.lower() in self.scannable_extensions:
            return True
            
        # Check files without extensions (might be scripts)
        if not path.suffix:
            try:
                with open(file_path, 'rb') as f:
                    # Read first few bytes to check if it's text
                    sample = f.read(1024)
                    return sample.decode('utf-8', errors='ignore').isprintable()
            except:
                return False
                
        return False

    def scan_file(self, file_path: str) -> List[Dict[str, Any]]:
        """Scan a single file for secret patterns"""
        findings = []
        
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                
            lines = content.split('\n')
            
            for pattern_name, pattern_info in self.patterns.items():
                pattern = pattern_info['pattern']
                flags = pattern_info.get('flags', 0)
                description = pattern_info['description']
                
                regex = re.compile(pattern, flags)
                
                # Search line by line to get line numbers
                for line_no, line in enumerate(lines, 1):
                    matches = regex.finditer(line)
                    
                    for match in matches:
                        match_text = match.group(0)
                        
                        # Check if this is a false positive
                        if self.is_false_positive(match_text, line, pattern_info):
                            continue
                        
                        # Create sample showing first and last 4 chars
                        if len(match_text) > 8:
                            sample = f"{match_text[:4]}...{match_text[-4:]}"
                        else:
                            sample = match_text
                        
                        findings.append({
                            'file': file_path,
                            'line': line_no,
                            'pattern': pattern_name,
                            'description': description,
                            'sample': sample,
                            'full_match': match_text,
                            'context': line.strip()[:200] + ('...' if len(line.strip()) > 200 else ''),
                            'entropy': round(self.calculate_entropy(match_text), 2)
                        })
                        
        except Exception as e:
            print(f"Error scanning {file_path}: {e}")
            
        return findings

    def categorize_finding(self, finding: Dict[str, Any]) -> str:
        """Categorize finding as encrypted, test data, or production"""
        file_path = finding['file'].lower()
        context = finding['context'].lower()
        pattern = finding['pattern']
        full_match = finding['full_match'].lower()
        
        # Test data indicators
        test_indicators = [
            'test', 'spec', 'mock', 'fixture', 'sample', 'example', 'demo',
            'fake', 'dummy', '.test.', '.spec.', '/tests/', '/test/',
            'testing', '__tests__', 'readme', 'documentation'
        ]
        
        # Encrypted data indicators
        encrypted_indicators = [
            'cfdj', 'encrypted', 'cipher', 'encoded', 'protected'
        ]
        
        # Example/placeholder indicators
        placeholder_indicators = [
            'your-', 'your_', 'example', 'placeholder', 'template', 'here',
            'replace-with', 'change-this'
        ]
        
        # Check for example/placeholder data first
        if any(indicator in file_path for indicator in placeholder_indicators):
            return 'EXAMPLE'
        if any(indicator in context for indicator in placeholder_indicators):
            return 'EXAMPLE'
        if any(indicator in full_match for indicator in placeholder_indicators):
            return 'EXAMPLE'
        
        # Check for test data
        if any(indicator in file_path for indicator in test_indicators):
            return 'TEST_DATA'
        if any(indicator in context for indicator in test_indicators):
            return 'TEST_DATA'
        
        # Check for encrypted data
        if pattern in ['cfdj_prefix', 'encrypted_keys_dotnet']:
            return 'ENCRYPTED'
        if any(indicator in context for indicator in encrypted_indicators):
            return 'ENCRYPTED'
        
        # Development/example files
        if any(env in file_path for env in ['.env.example', '.env.sample', 'example', 'sample']):
            return 'EXAMPLE'
        
        # Check entropy - very low entropy might be test data
        if finding.get('entropy', 0) < 2.0:
            return 'LOW_ENTROPY'
        
        # Default to production for anything else
        return 'PRODUCTION'

    def scan_all_files(self) -> List[Dict[str, Any]]:
        """Scan all tracked files for secrets"""
        tracked_files = self.get_tracked_files()
        all_findings = []
        
        print(f"Scanning {len(tracked_files)} tracked files...")
        
        scanned_count = 0
        for file_path in tracked_files:
            if not os.path.exists(file_path):
                continue
                
            if self.should_scan_file(file_path):
                findings = self.scan_file(file_path)
                for finding in findings:
                    finding['category'] = self.categorize_finding(finding)
                all_findings.extend(findings)
                scanned_count += 1
                
        print(f"Scanned {scanned_count} files, found {len(all_findings)} potential secrets")
        return all_findings

    def save_to_csv(self, findings: List[Dict[str, Any]], output_file: str = 'hardcoded-secrets.csv'):
        """Save findings to CSV file"""
        if not findings:
            print("No findings to save")
            return
            
        fieldnames = ['file', 'line', 'pattern', 'description', 'sample', 'category', 'entropy', 'context']
        
        with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            
            for finding in findings:
                writer.writerow({
                    'file': finding['file'],
                    'line': finding['line'],
                    'pattern': finding['pattern'],
                    'description': finding['description'],
                    'sample': finding['sample'],
                    'category': finding['category'],
                    'entropy': finding.get('entropy', 0),
                    'context': finding['context']
                })
                
        print(f"Results saved to {output_file}")

    def print_summary(self, findings: List[Dict[str, Any]]):
        """Print summary of findings"""
        if not findings:
            print("No potential secrets found.")
            return
            
        print(f"\n=== ENHANCED SCAN SUMMARY ===")
        print(f"Total findings: {len(findings)}")
        
        # Group by category
        by_category = {}
        for finding in findings:
            category = finding['category']
            by_category.setdefault(category, []).append(finding)
        
        for category, items in by_category.items():
            print(f"{category}: {len(items)} findings")
        
        # Group by pattern
        by_pattern = {}
        for finding in findings:
            pattern = finding['pattern']
            by_pattern.setdefault(pattern, []).append(finding)
        
        print(f"\n=== BY PATTERN ===")
        for pattern, items in sorted(by_pattern.items()):
            print(f"{pattern}: {len(items)} findings")
        
        # Show high-risk findings only
        production_findings = [f for f in findings if f['category'] == 'PRODUCTION']
        if production_findings:
            print(f"\n=== HIGH RISK (PRODUCTION) FINDINGS ===")
            for finding in production_findings[:10]:  # Show first 10
                print(f"  {finding['file']}:{finding['line']} - {finding['pattern']} - {finding['sample']} (entropy: {finding.get('entropy', 0)})")
            if len(production_findings) > 10:
                print(f"  ... and {len(production_findings) - 10} more")
        
        # Show encrypted findings
        encrypted_findings = [f for f in findings if f['category'] == 'ENCRYPTED']
        if encrypted_findings:
            print(f"\n=== ENCRYPTED SECRETS (PROPERLY PROTECTED) ===")
            for finding in encrypted_findings[:5]:  # Show first 5
                print(f"  {finding['file']}:{finding['line']} - {finding['pattern']} - {finding['sample']}")

def main():
    scanner = EnhancedSecretScanner()
    findings = scanner.scan_all_files()
    
    # Print summary to console
    scanner.print_summary(findings)
    
    # Save to CSV
    scanner.save_to_csv(findings)
    
    # Also save detailed JSON for further analysis if needed
    with open('hardcoded-secrets-detailed-enhanced.json', 'w') as f:
        json.dump(findings, f, indent=2, default=str)
    
    print(f"\nDetailed results also saved to hardcoded-secrets-detailed-enhanced.json")
    print(f"\n=== ANALYSIS COMPLETE ===")
    
    # Provide recommendations
    production_count = len([f for f in findings if f['category'] == 'PRODUCTION'])
    if production_count > 0:
        print(f"\n⚠️  SECURITY ALERT: {production_count} potential production secrets found!")
        print("📋 RECOMMENDED ACTIONS:")
        print("   1. Review all PRODUCTION findings immediately")
        print("   2. Move secrets to environment variables or Azure Key Vault")
        print("   3. Rotate any exposed API keys or tokens")
        print("   4. Add secrets to .gitignore to prevent future commits")
    else:
        print("\n✅ No production secrets detected - good security posture!")

if __name__ == "__main__":
    main()
