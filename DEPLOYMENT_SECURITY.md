# Deployment & Security Checklist

## 1. Preparing for Deployment

- Build your app for production:
  - For React:  
    ```
    npm run build
    ```
- Choose a hosting provider (Vercel, Netlify, Firebase Hosting, AWS, etc.).
- Connect your custom domain via your hosting provider's dashboard.

## 2. Protecting Sensitive Files & API Keys

- **Never commit `.env` or secret files to your repository.**
- Add sensitive files to `.gitignore`:
  ```
  .env
  .env.local
  firebaseServiceAccount.json
  ```
- Store API keys and secrets in environment variables, not in your codebase.
- For frontend apps, only expose public keys (e.g., Firebase public config). Never expose private keys or service accounts.

## 3. Security Best Practices

- **Use HTTPS**: Always serve your app over HTTPS.
- **Set CORS policies**: Restrict API endpoints to only your domain.
- **Keep dependencies updated**: Run `npm audit` and update regularly.
- **Use strong authentication**: Rely on Firebase Auth or similar.
- **Validate all user input**: Prevent XSS and injection attacks.
- **Set up Content Security Policy (CSP)** headers.
- **Limit error details**: Don’t expose stack traces or sensitive info in errors.

## 4. After Deployment

- Test your site for vulnerabilities (e.g., [Mozilla Observatory](https://observatory.mozilla.org/), [SecurityHeaders.com](https://securityheaders.com/)).
- Monitor for suspicious activity.
- Regularly back up your data.

## 5. Example: Hiding API Keys

- In your code, access keys via `process.env.REACT_APP_FIREBASE_API_KEY` (or similar).
- In your hosting provider, set environment variables in their dashboard.

---

**Never share your private keys or secrets. If you suspect a leak, rotate your keys immediately.**

