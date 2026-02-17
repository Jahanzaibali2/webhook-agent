import { useState, useRef, useCallback, useEffect } from "react";
import ublLogo from "@assets/public_ubl-logo_1757618792797.png";

interface ConnectionState {
  status: 'idle' | 'connecting' | 'listening' | 'speaking' | 'error';
  englishText: string;
  urduText: string;
}

interface TranscriptMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

export default function VoiceSupport() {
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: 'idle',
    englishText: "Click \"Call UBL\" to talk to Customer Support",
    urduText: "کسٹمر سپورٹ سے بات کرنے کے لیے \"Call UBL\" دبائیں"
  });

  const [isConnected, setIsConnected] = useState(false);
  const [transcriptMessages, setTranscriptMessages] = useState<TranscriptMessage[]>([]);
  const [currentAssistantText, setCurrentAssistantText] = useState("");
  const [callSummary, setCallSummary] = useState<string>("");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const currentResponseIdRef = useRef<string>("");

  const MODEL = "gpt-realtime";
  const OPENAI_WEBRTC_URL = (model: string) => `https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`;

  const containsHindiOrGurmukhi = useCallback((text: string): boolean => {
    const devanagariRegex = /[\u0900-\u097F]/;
    const gurmukhiRegex = /[\u0A00-\u0A7F]/;
    return devanagariRegex.test(text) || gurmukhiRegex.test(text);
  }, []);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcriptMessages, currentAssistantText]);

  const clearTranscript = useCallback(() => {
    setTranscriptMessages([]);
    setCurrentAssistantText("");
    setCallSummary("");
    currentResponseIdRef.current = "";
  }, []);

  const generateCallSummary = useCallback(async (messages: TranscriptMessage[]) => {
    if (messages.length === 0) {
      setCallSummary("");
      return;
    }

    setCallSummary("Generating summary...");

    try {
      const response = await fetch('/api/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages })
      });

      if (!response.ok) {
        throw new Error('Failed to generate summary');
      }

      const { summary } = await response.json();
      setCallSummary(summary);
    } catch (error) {
      console.error('Error generating summary:', error);
      setCallSummary("Unable to generate call summary at this time.");
    }
  }, []);

  const addTranscriptMessage = useCallback((role: 'user' | 'assistant', text: string) => {
    if (containsHindiOrGurmukhi(text)) {
      console.log("Filtered out Hindi/Gurmukhi text from transcript");
      return;
    }
    const message: TranscriptMessage = {
      id: Date.now().toString() + Math.random(),
      role,
      text,
      timestamp: Date.now()
    };
    setTranscriptMessages(prev => [...prev, message]);
  }, [containsHindiOrGurmukhi]);

  const setOrbState = useCallback((state: ConnectionState['status']) => {
    const dotEl = document.getElementById('dot');
    if (dotEl) {
      const states = ['idle', 'connecting', 'listening', 'speaking', 'error'];
      states.forEach(s => dotEl.classList.remove(s));
      if (state) dotEl.classList.add(state);
    }
  }, []);

  const updateStatus = useCallback((englishText: string, urduText: string, status: ConnectionState['status'] = 'idle') => {
    setConnectionState({ status, englishText, urduText });
    setOrbState(status);
  }, [setOrbState]);

  const setControlsState = useCallback((connected: boolean) => {
    setIsConnected(connected);
  }, []);

  const startConversation = async () => {
    try {
      clearTranscript();

      updateStatus("Requesting microphone access...", "مائیکروفون کی رسائی کی درخواست...", 'connecting');

      localStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

      updateStatus("Connecting to support system...", "سپورٹ سسٹم سے رابطہ...", 'connecting');

      const sessRes = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });

      if (!sessRes.ok) {
        const errorText = await sessRes.text();
        throw new Error(`Failed to create session: ${errorText}`);
      }

      const { client_secret } = await sessRes.json();
      if (!client_secret?.value) {
        throw new Error("No client secret received from server");
      }
      const ephemeralKey = client_secret.value;

      pcRef.current = new RTCPeerConnection();

      remoteAudioRef.current = document.createElement("audio");
      remoteAudioRef.current.autoplay = true;
      document.body.appendChild(remoteAudioRef.current);

      pcRef.current.ontrack = async (event) => {
        console.log("Remote audio track received:", event.streams[0]);
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
          try {
            await remoteAudioRef.current.play();
          } catch (error) {
            console.log("Autoplay failed, user gesture required:", error);
          }
        }
      };

      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      pcRef.current.addTrack(audioTrack, localStreamRef.current);

      pcRef.current.oniceconnectionstatechange = () => {
        if (pcRef.current) {
          console.log(`ICE connection state: ${pcRef.current.iceConnectionState}`);
        }
      };

      dcRef.current = pcRef.current.createDataChannel("oai-events");

      dcRef.current.onopen = () => {
        updateStatus("Configuring Urdu session...", "اردو سیشن کی تشکیل...", 'connecting');

        const sessionConfig = {
          type: "session.update",
          session: {
            input_audio_transcription: { model: "whisper-1" },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 400,
              create_response: true,
              interrupt_response: true
            }
          }
        };

        if (dcRef.current) {
          dcRef.current.send(JSON.stringify(sessionConfig));
        }

        updateStatus("Connected. How can I help you today?", "رابطہ ہو گیا۔ آج میں آپ کی کیسے مدد کر سکتا ہوں؟", 'listening');
        setControlsState(true);
      };

      dcRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("Received server event:", data);

          if (data.type === 'conversation.item.input_audio_transcription.completed') {
            if (data.transcript) {
              addTranscriptMessage('user', data.transcript);
            }
          }

          else if (data.type === 'response.audio_transcript.delta') {
            if (data.delta && !containsHindiOrGurmukhi(data.delta)) {
              setCurrentAssistantText(prev => prev + data.delta);
            }
          }

          else if (data.type === 'response.audio_transcript.done') {
            if (data.transcript) {
              addTranscriptMessage('assistant', data.transcript);
              setCurrentAssistantText("");
            }
            updateStatus("AI is responding...", "AI جواب دے رہا ہے...", 'speaking');
          }

          else if (data.type === 'response.done') {
            updateStatus("Listening... Please speak", "سن رہا ہوں... براہ کرم بولیں", 'listening');
          }

          else if (data.type === 'response.output_item.added') {
            if (data.item?.id) {
              currentResponseIdRef.current = data.item.id;
            }
          }

          else if (data.type === 'response.text.delta') {
            if (data.delta && !containsHindiOrGurmukhi(data.delta)) {
              setCurrentAssistantText(prev => prev + data.delta);
            }
          }

          else if (data.type === 'response.text.done') {
            if (data.text) {
              addTranscriptMessage('assistant', data.text);
              setCurrentAssistantText("");
            }
          }

        } catch (e) {
          console.log("Received non-JSON server event:", event.data);
        }
      };

      const offer = await pcRef.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });
      await pcRef.current.setLocalDescription(offer);

      const sdpRes = await fetch(OPENAI_WEBRTC_URL(MODEL), {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${ephemeralKey}`,
          "OpenAI-Beta": "realtime=v1",
          "Content-Type": "application/sdp"
        },
        body: offer.sdp
      });

      if (!sdpRes.ok) {
        const text = await sdpRes.text();
        throw new Error(`SDP negotiation failed: ${text}`);
      }

      const answerSdp = await sdpRes.text();
      const answer = { type: "answer" as RTCSdpType, sdp: answerSdp };
      await pcRef.current.setRemoteDescription(answer);

    } catch (error) {
      console.error('Connection error:', error);
      updateStatus(
        `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        "رابطہ ناکام۔ دوبارہ کوشش کریں۔",
        'error'
      );
      setControlsState(false);

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
    }
  };

  const stopConversation = async () => {
    try {
      updateStatus("Disconnecting...", "رابطہ منقطع کر رہے ہیں...", 'connecting');

      generateCallSummary(transcriptMessages);

      if (dcRef.current && dcRef.current.readyState === "open") {
        dcRef.current.close();
      }

      if (pcRef.current) {
        pcRef.current.close();
      }

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }

      if (remoteAudioRef.current) {
        document.body.removeChild(remoteAudioRef.current);
        remoteAudioRef.current = null;
      }

      dcRef.current = null;
      pcRef.current = null;

      updateStatus("Conversation ended. Thank you!", "بات چیت ختم ہوئی۔ شکریہ!", 'idle');
      setControlsState(false);

    } catch (error) {
      console.error('Disconnect error:', error);
      updateStatus("Error disconnecting", "رابطہ منقطع کرنے میں خرابی", 'error');
    }
  };

  return (
    <div className="min-h-screen">
      <header className="bi-header">
        <div className="header-inner">
          <img src={ublLogo} alt="UBL - where you come first" className="logo" />
          <div className="brand">
            <div className="title">UBL Customer Support</div>
            <div className="subtitle urdu" dir="rtl" lang="ur">آواز کے ذریعے کسٹمر سپورٹ</div>
          </div>
        </div>
      </header>
      <main>
        <section className="container">
          <aside className="intro card">
            <p className="hello">Hello,</p>
            <h1 className="question">
              How May <span className="lime-underline">We Help</span> You?
            </h1>
            <div className="chips">
              <span className="chip">Balance</span>
              <span className="chip">Card Block</span>
              <span className="chip">Financing</span>
              <span className="chip">Card Activation</span>
              <span className="chip">Internet Banking</span>
            </div>
            <div className="motif">
              <span className="dot blue"></span>
              <span className="dot green"></span>
            </div>
          </aside>

          <section className="agent card">
            <div id="dot" className="orb idle" aria-hidden="true">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
                  stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="ripple r1"></span>
              <span className="ripple r2"></span>
              <span className="ripple r3"></span>
            </div>

            <h2 className="headline">Click "<span style={{ color: '#007DC5' }}>Call UBL</span>" to talk to Customer Support</h2>
            <p className="helper urdu" dir="rtl" lang="ur">
              {connectionState.urduText}
            </p>

            <div className="actions">
              <button id="startBtn" className="btn primary" onClick={startConversation} disabled={isConnected}>
                <span className="spinner" aria-hidden="true"></span>
                <span>Call UBL</span>
              </button>
              <button id="stopBtn" className="btn ghost" onClick={stopConversation} disabled={!isConnected}>Stop</button>
            </div>

            <div id="status" className="status" role="status" aria-live="polite">
              • {connectionState.status === 'idle' ? 'Ready to connect' :
                connectionState.status === 'connecting' ? 'Connecting...' :
                  connectionState.status === 'listening' ? 'Connected & Listening' :
                    connectionState.status === 'speaking' ? 'AI Speaking' : 'Connection Error'}
            </div>

            <details className="subs">
              <summary>Show Live Transcript</summary>
              <div className="subs-body" ref={transcriptRef}>
                {transcriptMessages.length === 0 && !currentAssistantText && (
                  <div className="transcript-empty">Transcript will appear here during the call...</div>
                )}
                {transcriptMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={msg.role === 'user' ? 'bubble r' : 'bubble l'}
                  >
                    {msg.text}
                  </div>
                ))}
                {currentAssistantText && (
                  <div className="bubble l streaming">
                    {currentAssistantText}
                    <span className="cursor">▊</span>
                  </div>
                )}
              </div>
            </details>

            {callSummary && (
              <div className="call-summary">
                <h3 className="summary-title">Call Summary</h3>
                <div className="summary-content">
                  {callSummary.split('\n').map((line, index) => (
                    line && <p key={index}>{line}</p>
                  ))}
                </div>
              </div>
            )}
          </section>
        </section>
      </main>
      <footer className="bi-footer">
        Microphone permission required • Urdu, English and Arabic support
      </footer>
    </div>
  );
}
