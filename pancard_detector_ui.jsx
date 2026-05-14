import { useState, useRef, useCallback, useEffect } from "react";

const COLORS = {
  neonCyan: "#00f5ff",
  neonGreen: "#39ff14",
  neonPink: "#ff0090",
  neonYellow: "#ffff00",
  neonPurple: "#bf00ff",
  electric: "#7df9ff",
};

const particleCount = 38;

function useParticles() {
  const [particles] = useState(() =>
    Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      speedX: (Math.random() - 0.5) * 0.12,
      speedY: (Math.random() - 0.5) * 0.12,
      color: [COLORS.neonCyan, COLORS.neonGreen, COLORS.neonPink, COLORS.neonPurple, COLORS.electric][Math.floor(Math.random() * 5)],
      opacity: Math.random() * 0.6 + 0.2,
    }))
  );
  const posRef = useRef(particles.map(p => ({ x: p.x, y: p.y })));
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => {
      posRef.current = posRef.current.map((pos, i) => {
        let nx = pos.x + particles[i].speedX;
        let ny = pos.y + particles[i].speedY;
        if (nx < 0 || nx > 100) nx = pos.x - particles[i].speedX;
        if (ny < 0 || ny > 100) ny = pos.y - particles[i].speedY;
        return { x: nx, y: ny };
      });
      setTick(t => t + 1);
    }, 50);
    return () => clearInterval(iv);
  }, [particles]);

  return { particles, posRef };
}

function ParticleField() {
  const { particles, posRef } = useParticles();
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {particles.map((p, i) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: `${posRef.current[i]?.x ?? p.x}%`,
            top: `${posRef.current[i]?.y ?? p.y}%`,
            width: p.size * 2,
            height: p.size * 2,
            borderRadius: "50%",
            background: p.color,
            opacity: p.opacity,
            boxShadow: `0 0 ${p.size * 4}px ${p.color}`,
            transition: "left 0.05s linear, top 0.05s linear",
          }}
        />
      ))}
    </div>
  );
}

function ScanLine({ active }) {
  const [pos, setPos] = useState(0);
  useEffect(() => {
    if (!active) return;
    const iv = setInterval(() => setPos(p => (p + 1.5) % 100), 16);
    return () => clearInterval(iv);
  }, [active]);
  if (!active) return null;
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", borderRadius: 16 }}>
      <div style={{
        position: "absolute", left: 0, right: 0, top: `${pos}%`,
        height: 3,
        background: `linear-gradient(90deg, transparent, ${COLORS.neonCyan}, ${COLORS.neonGreen}, ${COLORS.neonCyan}, transparent)`,
        boxShadow: `0 0 20px ${COLORS.neonCyan}, 0 0 40px ${COLORS.neonGreen}`,
        opacity: 0.9,
        transition: "top 0.016s linear",
      }} />
    </div>
  );
}

function AnimatedBBox({ bbox, label, confidence, imageW, imageH, containerW, containerH }) {
  const [dashOffset, setDashOffset] = useState(0);
  const [glow, setGlow] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => {
      setDashOffset(d => (d - 1) % 30);
      setGlow(g => Math.sin(Date.now() / 400) * 0.5 + 0.5);
    }, 30);
    return () => clearInterval(iv);
  }, []);

  const scaleX = containerW / imageW;
  const scaleY = containerH / imageH;
  const x1 = bbox.x1 * imageW * scaleX;
  const y1 = bbox.y1 * imageH * scaleY;
  const x2 = bbox.x2 * imageW * scaleX;
  const y2 = bbox.y2 * imageH * scaleY;
  const w = x2 - x1;
  const h = y2 - y1;
  const cornerLen = Math.min(w, h) * 0.18;
  const glowColor = COLORS.neonGreen;
  const glowAlpha = 0.4 + glow * 0.6;

  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
      <defs>
        <filter id="glow-filter">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <rect
        x={x1} y={y1} width={w} height={h}
        fill={`rgba(57,255,20,${0.05 + glow * 0.07})`}
        stroke={glowColor}
        strokeWidth={3}
        strokeDasharray="8 4"
        strokeDashoffset={dashOffset}
        filter="url(#glow-filter)"
        rx={4}
      />
      {[
        [[x1, y1], [x1 + cornerLen, y1], [x1, y1 + cornerLen]],
        [[x2, y1], [x2 - cornerLen, y1], [x2, y1 + cornerLen]],
        [[x1, y2], [x1 + cornerLen, y2], [x1, y2 - cornerLen]],
        [[x2, y2], [x2 - cornerLen, y2], [x2, y2 - cornerLen]],
      ].map(([[ox, oy], [ex1, ey1], [ex2, ey2]], ci) => (
        <g key={ci}>
          <line x1={ox} y1={oy} x2={ex1} y2={ey1} stroke={COLORS.neonCyan} strokeWidth={5} strokeLinecap="round" />
          <line x1={ox} y1={oy} x2={ex2} y2={ey2} stroke={COLORS.neonCyan} strokeWidth={5} strokeLinecap="round" />
        </g>
      ))}
      <rect
        x={x1} y={Math.max(0, y1 - 36)}
        width={Math.max(160, w * 0.7)}
        height={34}
        fill="rgba(0,0,0,0.82)"
        stroke={COLORS.neonGreen}
        strokeWidth={1.5}
        rx={6}
      />
      <text
        x={x1 + 10}
        y={Math.max(0, y1 - 36) + 22}
        fill={COLORS.neonGreen}
        fontSize={13}
        fontFamily="'Courier New', monospace"
        fontWeight="bold"
        letterSpacing={2}
      >
        ◆ PANCARD  {(confidence * 100).toFixed(1)}%
      </text>
    </svg>
  );
}

function StatPill({ label, value, color }) {
  return (
    <div style={{
      background: "rgba(0,0,0,0.5)",
      border: `1px solid ${color}40`,
      borderRadius: 10,
      padding: "10px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 2,
      boxShadow: `0 0 14px ${color}20`,
    }}>
      <div style={{ color: "#888", fontSize: 10, letterSpacing: 2, textTransform: "uppercase" }}>{label}</div>
      <div style={{ color, fontSize: 16, fontWeight: 700, fontFamily: "monospace" }}>{value}</div>
    </div>
  );
}

async function detectPanCard(base64Image, mimeType) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: `You are a PAN card detector. Analyze the image and return ONLY a valid JSON object with no other text. The JSON must have these exact fields:
- detected: boolean (true if a PAN card is found)
- confidence: number between 0.0 and 1.0
- bbox: object with x1, y1, x2, y2 as normalized values between 0.0 and 1.0 (where 0,0 is top-left and 1,1 is bottom-right). If not detected, use {x1:0,y1:0,x2:1,y2:1}
- message: string with a brief description

Return ONLY the JSON object, nothing else.`,
      messages: [{
        role: "user",
        content: [{
          type: "image",
          source: { type: "base64", media_type: mimeType, data: base64Image }
        }, {
          type: "text",
          text: "Detect the PAN card in this image and return the bounding box coordinates."
        }]
      }]
    })
  });
  const data = await resp.json();
  const raw = data.content?.[0]?.text ?? "{}";
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

export default function PanCardDetector() {
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [imageMime, setImageMime] = useState("image/jpeg");
  const [imageDims, setImageDims] = useState({ w: 1, h: 1 });
  const [containerDims, setContainerDims] = useState({ w: 1, h: 1 });
  const [detecting, setDetecting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [hoverBtn, setHoverBtn] = useState(false);
  const [pulse, setPulse] = useState(0);

  const imgWrapRef = useRef(null);
  const imgRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const iv = setInterval(() => setPulse(p => p + 1), 60);
    return () => clearInterval(iv);
  }, []);

  const glowPulse = Math.sin(pulse / 8) * 0.5 + 0.5;

  const onFile = useCallback((file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setImageFile(file);
    setImageMime(file.type);
    setResult(null);
    setError(null);
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    const reader = new FileReader();
    reader.onload = e => {
      const full = e.target.result;
      setImageBase64(full.split(",")[1]);
      const img = new Image();
      img.onload = () => setImageDims({ w: img.naturalWidth, h: img.naturalHeight });
      img.src = full;
    };
    reader.readAsDataURL(file);
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    onFile(e.dataTransfer.files[0]);
  }, [onFile]);

  const onImgLoad = useCallback(() => {
    if (imgRef.current) {
      const rect = imgRef.current.getBoundingClientRect();
      setContainerDims({ w: imgRef.current.clientWidth, h: imgRef.current.clientHeight });
    }
  }, []);

  const runDetect = async () => {
    if (!imageBase64 || detecting) return;
    setDetecting(true);
    setResult(null);
    setError(null);
    try {
      const res = await detectPanCard(imageBase64, imageMime);
      setResult(res);
      if (imgRef.current) {
        setContainerDims({ w: imgRef.current.clientWidth, h: imgRef.current.clientHeight });
      }
    } catch (e) {
      setError("Detection failed: " + e.message);
    } finally {
      setDetecting(false);
    }
  };

  const auroraStyle = {
    background: `
      radial-gradient(ellipse 120% 80% at 0% 0%, rgba(0,245,255,0.18) 0%, transparent 55%),
      radial-gradient(ellipse 90% 70% at 100% 0%, rgba(191,0,255,0.18) 0%, transparent 55%),
      radial-gradient(ellipse 80% 60% at 50% 100%, rgba(57,255,20,0.15) 0%, transparent 55%),
      radial-gradient(ellipse 60% 50% at 80% 50%, rgba(255,0,144,0.1) 0%, transparent 55%),
      #040810
    `,
  };

  const cardStyle = {
    background: "rgba(8,12,24,0.82)",
    border: `1px solid rgba(0,245,255,${0.2 + glowPulse * 0.1})`,
    borderRadius: 20,
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    boxShadow: `0 0 ${30 + glowPulse * 20}px rgba(0,245,255,${0.06 + glowPulse * 0.04}), 0 24px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)`,
  };

  const detected = result?.detected;

  return (
    <div style={{ minHeight: "100vh", position: "relative", overflow: "hidden", ...auroraStyle, fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#e8f4ff" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Share+Tech+Mono&display=swap');
        @keyframes rotate-border { to { --angle: 360deg; } }
        @keyframes neon-flicker { 0%,100%{opacity:1} 92%{opacity:0.9} 94%{opacity:0.6} 96%{opacity:1} }
        @keyframes float-up { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes shimmer { 0%{background-position:200% 50%} 100%{background-position:-200% 50%} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
        .neon-title { animation: neon-flicker 5s infinite; }
        .float-logo { animation: float-up 4s ease-in-out infinite; }
        .shimmer-text {
          background: linear-gradient(90deg, #00f5ff, #39ff14, #bf00ff, #ff0090, #00f5ff);
          background-size: 300% 100%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 4s linear infinite;
        }
        .detect-btn {
          background: linear-gradient(135deg, #00c8ff, #0040ff, #7700ff);
          border: none;
          border-radius: 14px;
          color: #fff;
          font-size: 15px;
          font-weight: 700;
          padding: 14px 32px;
          cursor: pointer;
          width: 100%;
          letter-spacing: 2px;
          text-transform: uppercase;
          font-family: 'Rajdhani', 'Segoe UI', sans-serif;
          transition: all 0.2s;
          position: relative;
          overflow: hidden;
        }
        .detect-btn:not(:disabled):hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(0,200,255,0.5), 0 0 60px rgba(0,64,255,0.3);
        }
        .detect-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .detect-btn::after {
          content:'';
          position:absolute;
          inset:0;
          background:linear-gradient(180deg,rgba(255,255,255,0.12) 0%,transparent 100%);
        }
        .drop-zone-active {
          border-color: #00f5ff !important;
          box-shadow: 0 0 30px rgba(0,245,255,0.3) !important;
        }
        .cursor-blink { animation: blink 1s step-end infinite; }
      `}</style>

      <ParticleField />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 900, margin: "0 auto", padding: "0 20px 60px" }}>

        {/* ─── Header ─── */}
        <div style={{ textAlign: "center", padding: "48px 0 36px" }}>
          <div className="float-logo" style={{ marginBottom: 16 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 72, height: 72, borderRadius: 18,
              background: "linear-gradient(135deg, rgba(0,245,255,0.15), rgba(57,255,20,0.1))",
              border: "2px solid rgba(0,245,255,0.4)",
              boxShadow: "0 0 30px rgba(0,245,255,0.25), 0 0 60px rgba(57,255,20,0.1)",
              fontSize: 32,
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="5" width="20" height="14" rx="3" stroke={COLORS.neonCyan} strokeWidth="2" />
                <circle cx="8" cy="10" r="2" fill={COLORS.neonGreen} />
                <line x1="13" y1="9" x2="20" y2="9" stroke={COLORS.neonCyan} strokeWidth="1.5" />
                <line x1="13" y1="12" x2="20" y2="12" stroke={COLORS.neonCyan} strokeWidth="1.5" />
                <line x1="6" y1="15" x2="18" y2="15" stroke={COLORS.neonGreen} strokeWidth="1.5" />
              </svg>
            </div>
          </div>
          <h1 className="neon-title shimmer-text" style={{
            fontFamily: "'Rajdhani', sans-serif", fontSize: "clamp(2rem,6vw,3.4rem)",
            fontWeight: 700, letterSpacing: 4, margin: "0 0 10px", lineHeight: 1,
          }}>
            PANCARD DETECTOR
          </h1>
          <div style={{
            color: COLORS.neonCyan, fontFamily: "'Share Tech Mono', monospace",
            fontSize: 12, letterSpacing: 4, opacity: 0.8, marginBottom: 8
          }}>
            AI-POWERED DOCUMENT DETECTION SYSTEM
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap", marginTop: 14 }}>
            {["YOLOv8 MODEL", "REAL-TIME", "BOUNDING BOX"].map(tag => (
              <span key={tag} style={{
                background: "rgba(0,245,255,0.08)", border: "1px solid rgba(0,245,255,0.3)",
                borderRadius: 20, padding: "3px 12px", fontSize: 10,
                color: COLORS.neonCyan, letterSpacing: 2, fontFamily: "monospace",
              }}>{tag}</span>
            ))}
          </div>
        </div>

        {/* ─── Main Card ─── */}
        <div style={{ ...cardStyle, padding: 28, marginBottom: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

            {/* LEFT: Upload */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ fontSize: 10, letterSpacing: 3, color: "#00f5ff", fontFamily: "monospace" }}>
                <span className="cursor-blink">▶</span> STEP 01 — UPLOAD IMAGE
              </div>

              {/* Drop zone */}
              <div
                className={dragging ? "drop-zone-active" : ""}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                style={{
                  border: `2px dashed ${imageUrl ? COLORS.neonGreen : "rgba(0,245,255,0.3)"}`,
                  borderRadius: 14, minHeight: 200,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", position: "relative", overflow: "hidden",
                  background: imageUrl ? "rgba(57,255,20,0.04)" : "rgba(0,245,255,0.03)",
                  transition: "all 0.3s",
                  boxShadow: imageUrl ? `0 0 20px rgba(57,255,20,0.15)` : "none",
                }}
              >
                {imageUrl ? (
                  <img src={imageUrl} alt="preview" style={{
                    maxWidth: "100%", maxHeight: 200, objectFit: "contain", display: "block",
                    borderRadius: 10,
                  }} />
                ) : (
                  <div style={{ textAlign: "center", padding: 24 }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: 14,
                      background: "rgba(0,245,255,0.08)", border: "1px solid rgba(0,245,255,0.2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      margin: "0 auto 12px",
                    }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={COLORS.neonCyan} strokeWidth="1.8" strokeLinecap="round">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    </div>
                    <div style={{ color: "#c8e8ff", fontSize: 14, fontWeight: 600 }}>Drop PAN card image</div>
                    <div style={{ color: "#5580a0", fontSize: 11, marginTop: 4 }}>or click to browse</div>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={e => onFile(e.target.files[0])} />

              {imageFile && (
                <div style={{
                  background: "rgba(57,255,20,0.06)", border: "1px solid rgba(57,255,20,0.2)",
                  borderRadius: 10, padding: "8px 14px", fontSize: 12,
                  color: COLORS.neonGreen, fontFamily: "monospace",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <span>◆ {imageFile.name.length > 24 ? imageFile.name.slice(0, 22) + "…" : imageFile.name}</span>
                  <span style={{ opacity: 0.7 }}>{(imageFile.size / 1024).toFixed(0)} KB</span>
                </div>
              )}

              <button
                className="detect-btn"
                disabled={!imageBase64 || detecting}
                onClick={runDetect}
              >
                {detecting ? (
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" stroke="white" strokeWidth="2.5" fill="none" style={{ animation: "shimmer 1s linear infinite" }}>
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                    ANALYZING...
                  </span>
                ) : "⚡ DETECT PANCARD"}
              </button>

              {error && (
                <div style={{
                  background: "rgba(255,0,80,0.1)", border: "1px solid rgba(255,0,80,0.3)",
                  borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#ff6088"
                }}>⚠ {error}</div>
              )}
            </div>

            {/* RIGHT: Result */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ fontSize: 10, letterSpacing: 3, color: detected ? COLORS.neonGreen : "#00f5ff", fontFamily: "monospace" }}>
                <span className="cursor-blink">▶</span> STEP 02 — DETECTION RESULT
              </div>

              <div style={{
                flex: 1, minHeight: 200, borderRadius: 14, overflow: "hidden",
                background: "rgba(0,0,0,0.4)", border: "1px solid rgba(0,245,255,0.15)",
                position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {imageUrl && (result || detecting) ? (
                  <>
                    <img
                      ref={imgRef}
                      src={imageUrl}
                      alt="detection"
                      onLoad={onImgLoad}
                      style={{ maxWidth: "100%", maxHeight: 200, objectFit: "contain", display: "block" }}
                    />
                    <ScanLine active={detecting} />
                    {result?.detected && result.bbox && (
                      <AnimatedBBox
                        bbox={result.bbox}
                        label="PANCARD"
                        confidence={result.confidence}
                        imageW={imageDims.w}
                        imageH={imageDims.h}
                        containerW={containerDims.w}
                        containerH={containerDims.h}
                      />
                    )}
                  </>
                ) : (
                  <div style={{ textAlign: "center", color: "#2a4060" }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <div style={{ marginTop: 10, fontSize: 13 }}>Result appears here</div>
                  </div>
                )}
              </div>

              {result && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <StatPill label="STATUS" value={result.detected ? "✓ DETECTED" : "✗ NOT FOUND"} color={result.detected ? COLORS.neonGreen : "#ff4060"} />
                  <StatPill label="CONFIDENCE" value={result.confidence ? `${(result.confidence * 100).toFixed(1)}%` : "—"} color={COLORS.neonCyan} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── Result Banner ─── */}
        {result && (
          <div style={{
            ...cardStyle,
            padding: "18px 28px",
            border: `1px solid ${detected ? COLORS.neonGreen : "#ff4060"}40`,
            boxShadow: `0 0 40px ${detected ? COLORS.neonGreen : "#ff4060"}15, 0 16px 40px rgba(0,0,0,0.4)`,
            display: "flex", alignItems: "center", gap: 20,
          }}>
            <div style={{
              fontSize: 36, width: 60, height: 60, borderRadius: 12, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: detected ? "rgba(57,255,20,0.1)" : "rgba(255,64,96,0.1)",
              border: `2px solid ${detected ? COLORS.neonGreen : "#ff4060"}50`,
              boxShadow: `0 0 20px ${detected ? COLORS.neonGreen : "#ff4060"}20`,
            }}>
              {detected ? "✓" : "✗"}
            </div>
            <div>
              <div style={{
                fontFamily: "'Rajdhani', sans-serif", fontSize: 20, fontWeight: 700,
                color: detected ? COLORS.neonGreen : "#ff4060", letterSpacing: 2, marginBottom: 4,
              }}>
                {detected ? "PANCARD DETECTED" : "NO PANCARD FOUND"}
              </div>
              <div style={{ color: "#6080a0", fontSize: 13, fontFamily: "monospace" }}>
                {result.message}
              </div>
            </div>
            {detected && (
              <div style={{ marginLeft: "auto", textAlign: "right" }}>
                <div style={{ color: "#4060a0", fontSize: 10, letterSpacing: 2, marginBottom: 4 }}>CONFIDENCE</div>
                <div style={{ fontFamily: "monospace", fontSize: 28, fontWeight: 700, color: COLORS.neonCyan }}>
                  {(result.confidence * 100).toFixed(1)}%
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── How It Works ─── */}
        <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          {[
            { num: "01", icon: "⬆", title: "UPLOAD", desc: "Drop any PAN card image — JPG, PNG, WEBP, BMP", color: COLORS.neonCyan },
            { num: "02", icon: "⚡", title: "DETECT", desc: "AI model analyzes and localizes the card boundary", color: COLORS.neonPurple },
            { num: "03", icon: "◆", title: "RESULT", desc: "Bounding box with PANCARD label and confidence", color: COLORS.neonGreen },
          ].map(s => (
            <div key={s.num} style={{
              background: "rgba(8,12,24,0.7)", border: `1px solid ${s.color}25`,
              borderRadius: 14, padding: "18px 20px",
              boxShadow: `0 0 20px ${s.color}08`,
            }}>
              <div style={{ color: s.color, fontSize: 10, letterSpacing: 3, fontFamily: "monospace", marginBottom: 8 }}>
                {s.num}
              </div>
              <div style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 15, fontWeight: 700, color: s.color, letterSpacing: 2, marginBottom: 6 }}>
                {s.title}
              </div>
              <div style={{ color: "#4060a0", fontSize: 12, lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          ))}
        </div>

        {/* ─── Footer ─── */}
        <div style={{ textAlign: "center", marginTop: 40, color: "#2a4060", fontSize: 11, letterSpacing: 2, fontFamily: "monospace" }}>
          PANCARD DETECTOR v2.0 · YOLOv8 + CLAUDE AI · BUILT WITH FASTAPI + OPENCV
        </div>
      </div>
    </div>
  );
}
