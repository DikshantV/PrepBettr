"use client";

import { useState } from 'react';

export default function DebugVapi() {
    const [logs, setLogs] = useState<string[]>([]);
    
    const addLog = (message: string) => {
        setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
        console.log(message);
    };

    const testEnvironmentVariables = () => {
        addLog('=== Environment Variables Test ===');
        addLog(`NEXT_PUBLIC_VAPI_WEB_TOKEN: ${process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN ? 'SET' : 'MISSING'}`);
        addLog(`NEXT_PUBLIC_VAPI_ASSISTANT_ID: ${process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID ? 'SET' : 'MISSING'}`);
        addLog(`Token Length: ${process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN?.length || 0}`);
        addLog(`Assistant ID: ${process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID || 'MISSING'}`);
    };

    const testVapiImport = async () => {
        addLog('=== VAPI Import Test ===');
        try {
            const { vapi } = await import('@/lib/vapi.sdk');
            addLog('✅ VAPI SDK imported successfully');
            addLog(`VAPI instance: ${typeof vapi}`);
        } catch (error) {
            addLog(`❌ VAPI SDK import failed: ${error.message}`);
        }
    };

    const testVapiStart = async () => {
        addLog('=== VAPI Start Test ===');
        try {
            const { vapi } = await import('@/lib/vapi.sdk');
            const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;
            
            if (!assistantId) {
                addLog('❌ Assistant ID is missing');
                return;
            }

            addLog(`🎯 Attempting to start VAPI with assistant: ${assistantId}`);
            
            const result = await vapi.start(assistantId, {
                variableValues: {
                    username: 'TestUser'
                },
                clientMessages: [],
                serverMessages: []
            });
            
            addLog(`✅ VAPI started successfully: ${JSON.stringify(result)}`);
        } catch (error) {
            addLog(`❌ VAPI start failed: ${error.message}`);
            addLog(`❌ Error details: ${JSON.stringify(error, null, 2)}`);
        }
    };

    const testWebhookEndpoint = async () => {
        addLog('=== Webhook Endpoint Test ===');
        try {
            const response = await fetch('/api/vapi/webhook', {
                method: 'GET'
            });
            const data = await response.text();
            addLog(`✅ Webhook endpoint response: ${response.status} - ${data}`);
        } catch (error) {
            addLog(`❌ Webhook endpoint test failed: ${error.message}`);
        }
    };

    const testVapiEvents = async () => {
        addLog('=== VAPI Events Test ===');
        try {
            const { vapi } = await import('@/lib/vapi.sdk');
            
            // Set up event listeners
            const onCallStart = () => addLog('🟢 Event: call-start');
            const onCallEnd = () => addLog('🔴 Event: call-end');
            const onSpeechStart = () => addLog('🎤 Event: speech-start');
            const onSpeechEnd = () => addLog('🎤 Event: speech-end');
            const onMessage = (message) => {
                addLog(`📨 Event: message - Type: ${message.type}`);
                if (message.type === 'function-call') {
                    addLog(`🔧 Function call: ${message.functionCall?.name}`);
                }
                if (message.type === 'transcript') {
                    addLog(`📝 Transcript: ${message.transcript}`);
                }
            };
            const onError = (error) => addLog(`❌ Event: error - ${error.message}`);
            
            vapi.on('call-start', onCallStart);
            vapi.on('call-end', onCallEnd);
            vapi.on('speech-start', onSpeechStart);
            vapi.on('speech-end', onSpeechEnd);
            vapi.on('message', onMessage);
            vapi.on('error', onError);
            
            addLog('🎯 Event listeners registered. Starting VAPI call...');
            
            const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;
            await vapi.start(assistantId, {
                variableValues: {
                    username: 'TestUser'
                },
                clientMessages: [],
                serverMessages: []
            });
            
            addLog('📞 Call started. Waiting for events...');
            
            // Auto cleanup after 30 seconds
            setTimeout(() => {
                addLog('⏰ 30 seconds elapsed. Stopping call...');
                vapi.stop();
                
                // Cleanup event listeners
                vapi.off('call-start', onCallStart);
                vapi.off('call-end', onCallEnd);
                vapi.off('speech-start', onSpeechStart);
                vapi.off('speech-end', onSpeechEnd);
                vapi.off('message', onMessage);
                vapi.off('error', onError);
            }, 30000);
            
        } catch (error) {
            addLog(`❌ VAPI events test failed: ${error.message}`);
        }
    };

    const testMicrophonePermissions = async () => {
        addLog('=== Microphone Permissions Test ===');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            addLog('✅ Microphone permission granted');
            stream.getTracks().forEach(track => track.stop());
        } catch (error) {
            addLog(`❌ Microphone permission denied: ${error.message}`);
        }
    };

    const clearLogs = () => {
        setLogs([]);
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">VAPI Debug Console</h1>
            
            <div className="grid grid-cols-3 gap-4 mb-6">
                <button 
                    onClick={testEnvironmentVariables}
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                    Test Environment Variables
                </button>
                
                <button 
                    onClick={testVapiImport}
                    className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                >
                    Test VAPI Import
                </button>
                
                <button 
                    onClick={testVapiStart}
                    className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600"
                >
                    Test VAPI Start
                </button>
                
                <button 
                    onClick={testWebhookEndpoint}
                    className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
                >
                    Test Webhook
                </button>
                
                <button 
                    onClick={testMicrophonePermissions}
                    className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
                >
                    Test Microphone
                </button>
                
                <button 
                    onClick={testVapiEvents}
                    className="bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600"
                >
                    Test VAPI Events
                </button>
                
                <button 
                    onClick={clearLogs}
                    className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 col-span-3"
                >
                    Clear Logs
                </button>
            </div>

            <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-sm max-h-96 overflow-y-auto">
                <h3 className="text-white mb-2">Debug Logs:</h3>
                {logs.length === 0 ? (
                    <p className="text-gray-500">No logs yet. Click a test button above.</p>
                ) : (
                    logs.map((log, index) => (
                        <div key={index} className="mb-1">{log}</div>
                    ))
                )}
            </div>
        </div>
    );
}
