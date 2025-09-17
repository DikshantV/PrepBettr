// Type declarations for optional email dependencies
// These modules might not be installed, so we handle them gracefully

declare module 'resend' {
  export class Resend {
    constructor(apiKey: string);
    emails: {
      send: (params: {
        from: string;
        to: string[];
        subject: string;
        html: string;
      }) => Promise<{ data: { id: string } | null; error: any }>;
    };
  }
}

declare module 'nodemailer' {
  export interface TransportOptions {
    service?: string;
    host?: string;
    port?: number;
    secure?: boolean;
    auth?: {
      user: string;
      pass: string;
    };
  }

  export interface MailOptions {
    from: string;
    to: string;
    subject: string;
    html: string;
  }

  export interface Transporter {
    sendMail: (options: MailOptions) => Promise<any>;
  }

  export function createTransport(options: TransportOptions): Transporter;
}