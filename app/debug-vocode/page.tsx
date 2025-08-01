"use client";

import { useState } from 'react';

export default function DebugVocode() {
    const [logs, setLogs] = useState<string[]>([]);
    
    const addLog = (message: string) => {
        setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
        console.log(message);
    };

    const testEnvironmentVariables = () => {
        addLog('=== Environment Variables Test ===');
        addLog(`NEXT_PUBLIC_VOCODE_API_KEY: ${process.env.NEXT_PUBLIC_VOCODE_API_KEY ? 'SET' : 'MISSING'}`);
        addLog(`NEXT_PUBLIC_VOCODE_ASSISTANT_ID: ${process.env.NEXT_PUBLIC_VOCODE_ASSISTANT_ID ? 'SET' : 'MISSING'}`);
        addLog(`NEXT_PUBLIC_VOCODE_BASE_URL: ${process.env.NEXT_PUBLIC_VOCODE_BASE_URL || 'DEFAULT'}`);
        addLog(`API Key Length: ${process.env.NEXT_PUBLIC_VOCODE_API_KEY?.length || 0}`);
        addLog(`Assistant ID: ${process.env.NEXT_PUBLIC_VOCODE_ASSISTANT_ID || 'MISSING'}`);
    };

    const testVocodeImport = async () => {
        addLog('=== Vocode Import Test ===');
        try {
            const { vocode } = await import('@/lib/vocode.sdk');
            addLog('✅ Vocode SDK imported successfully');
            addLog(`Vocode instance: ${typeof vocode}`);
        } catch (error: any) {
            addLog(`❌ Vocode SDK import failed: ${error.message}`);
        }
    };

    const testVocodeStart = async () => {
        addLog('=== Vocode Start Test ===');
        try {
            const { vocode } = await import('@/lib/vocode.sdk');
            const assistantId = process.env.NEXT_PUBLIC_VOCODE_ASSISTANT_ID;
            
            if (!assistantId) {
                addLog('❌ Assistant ID is missing');
                return;
            }

            addLog(`🎯 Attempting to start Vocode with assistant: ${assistantId}`);
            
            const result = await vocode.start(assistantId, {
                variableValues: {
                    username: 'TestUser'
                },
                clientMessages: [],
                serverMessages: []
            });
            
            addLog(`✅ Vocode started successfully: ${JSON.stringify(result)}`);
        } catch (error: any) {
            addLog(`❌ Vocode start failed: ${error.message}`);
            addLog(`❌ Error details: ${JSON.stringify(error, null, 2)}`);
        }
    };

    const testWebhookEndpoint = async () => {
        addLog('=== Webhook Endpoint Test ===');
        try {
            const response = await fetch('/api/vocode/webhook', {
                method: 'GET'
            });
            const data = await response.text();
            addLog(`✅ Webhook endpoint response: ${response.status} - ${data}`);
        } catch (error: any) {
            addLog(`❌ Webhook endpoint test failed: ${error.message}`);
        }
    };

    const testVocodeEvents = async () => {
        addLog('=== Vocode Events Test ===');
        try {
            const { vocode } = await import('@/lib/vocode.sdk');
            
            // Set up event listeners
            const onCallStart = () => addLog('🟢 Event: call-start');
            const onCallEnd = () => addLog('🔴 Event: call-end');
            const onSpeechStart = () => addLog('🎤 Event: speech-start');
            const onSpeechEnd = () => addLog('🎤 Event: speech-end');
            const onMessage = (message: any) => {
                addLog(`📨 Event: message - Type: ${message.type}`);
                if (message.type === 'function-call') {
                    addLog(`🔧 Function call: ${message.functionCall?.name}`);
                }
                if (message.type === 'transcript') {
                    addLog(`📝 Transcript: ${message.transcript}`);
                }
            };
            const onError = (error: any) => addLog(`❌ Event: error - ${error.message}`);
            
            vocode.on('call-start', onCallStart);
            vocode.on('call-end', onCallEnd);
            vocode.on('speech-start', onSpeechStart);
            vocode.on('speech-end', onSpeechEnd);
            vocode.on('message', onMessage);
            vocode.on('error', onError);
            
            addLog('🎯 Event listeners registered. Starting Vocode call...');
            
            const assistantId = process.env.NEXT_PUBLIC_VOCODE_ASSISTANT_ID;
            await vocode.start(assistantId!, {
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
                vocode.stop();
                
                // Cleanup event listeners
                vocode.off('call-start', onCallStart);
                vocode.off('call-end', onCallEnd);
                vocode.off('speech-start', onSpeechStart);
                vocode.off('speech-end', onSpeechEnd);
                vocode.off('message', onMessage);
                vocode.off('error', onError);
            }, 30000);
            
        } catch (error: any) {
            addLog(`❌ Vocode events test failed: ${error.message}`);
        }
    };

    const testMicrophonePermissions = async () => {
        addLog('=== Microphone Permissions Test ===');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            addLog('✅ Microphone permission granted');
            stream.getTracks().forEach(track => track.stop());
        } catch (error: any) {
            addLog(`❌ Microphone permission denied: ${error.message}`);
        }
    };

    const testVocodeConfiguration = () => {
        addLog('=== Vocode Configuration Test ===');
        try {
            const { vocodeInterviewer } = require('@/constants');
            addLog('✅ Vocode interviewer configuration loaded');
            addLog(`Configuration: ${JSON.stringify(vocodeInterviewer, null, 2)}`);
        } catch (error: any) {
            addLog(`❌ Failed to load Vocode configuration: ${error.message}`);
        }
    };

    const clearLogs = () => {
        setLogs([]);
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Vocode Debug Console</h1>
            
            <div className="grid grid-cols-3 gap-4 mb-6">
                <button 
                    onClick={testEnvironmentVariables}
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                    Test Environment Variables
                </button>
                
                <button 
                    onClick={testVocodeImport}
                    className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                >
                    Test Vocode Import
                </button>
                
                <button 
                    onClick={testVocodeStart}
                    className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600"
                >
                    Test Vocode Start
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
                    onClick={testVocodeEvents}
                    className="bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600"
                >
                    Test Vocode Events
                </button>
                
                <button 
                    onClick={testVocodeConfiguration}
                    className="bg-teal-500 text-white px-4 py-2 rounded hover:bg-teal-600"
                >
                    Test Configuration
                </button>
                
                <button 
                    onClick={clearLogs}
                    className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 col-span-2"
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
