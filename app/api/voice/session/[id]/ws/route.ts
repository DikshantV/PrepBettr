export const runtime = 'edge';

/**
 * WebSocket proxy for Azure AI Foundry realtime voice sessions
 *
 * Route: /api/voice/session/[id]/ws
 * - Upgrades client HTTP request to WebSocket
 * - Connects to Azure Foundry realtime WebSocket (server-side)
 * - Bi-directionally pipes messages between client and Azure
 * - Ensures API keys remain on server only
 */

import type { NextRequest } from 'next/server';
import { getVoiceLiveClient } from '@/lib/azure-ai-foundry/voice/voice-live-client';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionId = params.id;

  // Validate session
  const voiceClient = getVoiceLiveClient();
  const session = voiceClient.getSession(sessionId);
  if (!session || !session.wsUrl) {
    return new Response('Session not found or missing WebSocket URL', { status: 404 });
  }

  // Create a WebSocket pair (client <-> server)
  const { 0: clientSocket, 1: serverSocket } = new (globalThis as any).WebSocketPair();

  // Accept the client side of the pair
  (clientSocket as any).accept();

  let upstream: WebSocket | null = null;
  let closed = false;

  const closeBoth = (code = 1000, reason = 'Normal Closure') => {
    if (closed) return;
    closed = true;
    try { (clientSocket as any).close(code, reason); } catch {}
    try { upstream?.close(code, reason); } catch {}
  };

  try {
    // Connect to Azure Foundry realtime WebSocket
    upstream = new WebSocket(session.wsUrl, ['realtime']);

    upstream.addEventListener('open', () => {
      // Connection established with Azure
      (clientSocket as any).send(JSON.stringify({ type: 'control', data: { connected: true }, sessionId }));
    });

    upstream.addEventListener('message', (event) => {
      try {
        // Forward as-is to client. If binary, forward binary; else text
        if (event.data instanceof ArrayBuffer || event.data instanceof Uint8Array) {
          (clientSocket as any).send(event.data as any);
        } else {
          (clientSocket as any).send(event.data as any);
        }
      } catch (err) {
        // Swallow send errors and close
        closeBoth(1011, 'Upstream->Client forward error');
      }
    });

    upstream.addEventListener('close', (event) => {
      closeBoth(event.code || 1000, event.reason || 'Upstream closed');
    });

    upstream.addEventListener('error', () => {
      closeBoth(1011, 'Upstream error');
    });

    // Forward messages from client -> upstream
    (clientSocket as any).addEventListener('message', (event: MessageEvent) => {
      try {
        if (upstream?.readyState === upstream?.OPEN) {
          if (event.data instanceof ArrayBuffer || event.data instanceof Uint8Array) {
            upstream.send(event.data as any);
          } else {
            upstream.send(event.data as any);
          }
        }
      } catch {
        closeBoth(1011, 'Client->Upstream forward error');
      }
    });

    (clientSocket as any).addEventListener('close', (event: CloseEvent) => {
      closeBoth(event.code || 1000, event.reason || 'Client closed');
    });

    (clientSocket as any).addEventListener('error', () => {
      closeBoth(1011, 'Client error');
    });

    // Return the other end of the pair to complete the upgrade
    return new Response(null, {
      status: 101,
      webSocket: serverSocket,
    } as any);
  } catch (err) {
    try { closeBoth(1011, 'WebSocket setup failure'); } catch {}
    return new Response('Failed to establish WebSocket proxy', { status: 500 });
  }
}

