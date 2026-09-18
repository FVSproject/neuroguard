// NeuroGuard  —  Unit 1 Smart Pacifier  —  embedded dashboard (EN + AR)
// Single-page HTML/CSS/JS served from PROGMEM by the ESP32-S3 SoftAP.
#pragma once
#include <Arduino.h>

const char INDEX_HTML[] PROGMEM = R"HTML(<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#FFE3E1">
<title>NeuroGuard · Smart Pacifier</title>
<style>
:root{
  --bg-1:#FFF5E4; --bg-2:#FFE3E1; --bg-3:#E4F1FF;
  --card:#FFFFFF; --text:#4A4E69; --muted:#9A9AB5;
  --nns:#FF9AA2; --resp:#7CB4E0; --env:#7DCEA0;
  --alert:#FF6B6B; --ok:#7DCEA0; --warn:#FFC168;
  --shadow:0 10px 30px rgba(74,78,105,.08);
  --shadow-hover:0 14px 40px rgba(74,78,105,.14);
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{min-height:100%}
body{
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Nunito","Segoe UI Arabic","Noto Naskh Arabic",sans-serif;
  color:var(--text);
  background:linear-gradient(135deg,var(--bg-1) 0%,var(--bg-2) 50%,var(--bg-3) 100%);
  background-attachment:fixed;
  line-height:1.6;
  overflow-x:hidden;
}
html[dir="rtl"] body{line-height:1.75}
/* floating decorations */
.decor{position:fixed;pointer-events:none;opacity:.45;z-index:0}
.d1{top:6%;right:6%;animation:float 9s ease-in-out infinite}
.d2{top:62%;left:4%;animation:float 12s ease-in-out infinite reverse}
.d3{top:18%;left:8%;animation:float 14s ease-in-out infinite}
.d4{bottom:8%;right:9%;animation:float 11s ease-in-out infinite reverse}
.d5{top:40%;right:14%;animation:float 16s ease-in-out infinite}
@keyframes float{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-24px) rotate(6deg)}}
@keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
@keyframes pulse{0%{transform:scale(1.15)}100%{transform:scale(1)}}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulseAlert{0%,100%{transform:scale(1);box-shadow:0 0 0 rgba(255,107,107,.5)}50%{transform:scale(1.04);box-shadow:0 0 60px rgba(255,107,107,.5)}}
@keyframes sparkle{0%,100%{opacity:.4}50%{opacity:1}}

/* header */
header{position:relative;z-index:1;padding:26px 20px 8px;text-align:center;animation:fadeIn .6s}
.logo{display:inline-flex;align-items:center;gap:14px;font-size:30px;font-weight:800;letter-spacing:-.5px}
.logo .badge{width:52px;height:52px;background:linear-gradient(135deg,#FFAAA5,#FFD3B6);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:var(--shadow);animation:breathe 4s ease-in-out infinite}
.logo .badge svg{width:34px;height:34px;color:#fff}
.subtitle{color:var(--muted);font-size:14px;margin-top:6px}

/* hero */
.hero{position:relative;z-index:1;max-width:900px;margin:16px auto 20px;padding:24px 26px;background:rgba(255,255,255,.75);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-radius:24px;box-shadow:var(--shadow);text-align:center;animation:fadeIn .7s}
.hero h1{font-size:19px;margin-bottom:10px;font-weight:800}
.hero p{font-size:14px;color:var(--muted);max-width:640px;margin:0 auto}
.hero .tags{margin-top:14px;display:flex;flex-wrap:wrap;justify-content:center;gap:8px}
.tag{background:rgba(255,154,162,.15);color:#c96b74;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700}
.tag.b{background:rgba(124,180,224,.18);color:#3d7fb8}
.tag.g{background:rgba(125,206,160,.20);color:#2e8659}

/* status bar */
.status-bar{position:relative;z-index:1;display:flex;justify-content:center;gap:10px;padding:10px 20px 4px;flex-wrap:wrap;font-size:13px;animation:fadeIn .8s}
.status-pill{background:rgba(255,255,255,.75);backdrop-filter:blur(10px);padding:7px 14px;border-radius:999px;display:inline-flex;align-items:center;gap:8px;box-shadow:0 2px 10px rgba(74,78,105,.05)}
.dot{width:9px;height:9px;border-radius:50%;background:var(--ok);box-shadow:0 0 0 3px rgba(125,206,160,.25);animation:sparkle 1.8s ease-in-out infinite}
.dot.warn{background:var(--warn);box-shadow:0 0 0 3px rgba(255,193,104,.3)}
.dot.err{background:var(--alert);box-shadow:0 0 0 3px rgba(255,107,107,.3)}

/* language toggle */
.lang-btn{background:linear-gradient(135deg,#FFAAA5,#B5A8F0);color:#fff;border:none;padding:7px 16px;border-radius:999px;font-size:13px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:8px;box-shadow:0 4px 14px rgba(181,168,240,.35);transition:transform .15s,box-shadow .15s;font-family:inherit}
.lang-btn:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(181,168,240,.5)}
.lang-btn svg{width:16px;height:16px}

/* grid */
.grid{position:relative;z-index:1;max-width:1200px;margin:0 auto;padding:16px 20px 60px;display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:22px}
.card{background:var(--card);border-radius:26px;padding:22px 24px;box-shadow:var(--shadow);transition:transform .25s ease,box-shadow .25s ease;animation:fadeIn .8s;position:relative;overflow:hidden}
.card::before{content:"";position:absolute;top:0;left:0;right:0;height:4px;border-radius:26px 26px 0 0}
.card.nns::before{background:linear-gradient(90deg,#FFAAA5,#FFD3B6)}
.card.resp::before{background:linear-gradient(90deg,#7CB4E0,#A0D2EB)}
.card.env::before{background:linear-gradient(90deg,#7DCEA0,#B8E4C9)}
.card.cardio::before{background:linear-gradient(90deg,#F5A9B8,#F17A9E)}
.card.motion::before{background:linear-gradient(90deg,#B5A8F0,#C7BDF7)}
.card.offline{opacity:.75}
.card.offline .metric-val{color:var(--muted)}
.card:hover{transform:translateY(-4px);box-shadow:var(--shadow-hover)}

.card-head{display:flex;align-items:center;gap:14px;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid rgba(0,0,0,.05)}
.card-head .icon{width:48px;height:48px;padding:10px;border-radius:14px;flex-shrink:0}
.card-head .icon svg{width:100%;height:100%}
.card.nns    .card-head .icon{background:rgba(255,154,162,.14);color:var(--nns)}
.card.resp   .card-head .icon{background:rgba(124,180,224,.16);color:var(--resp)}
.card.env    .card-head .icon{background:rgba(125,206,160,.18);color:var(--env)}
.card.cardio .card-head .icon{background:rgba(241,122,158,.16);color:#e26a92}
.card.motion .card-head .icon{background:rgba(181,168,240,.20);color:#8b7ee0}
.card-head h2{font-size:17px;font-weight:800}
.card-head p{font-size:12px;color:var(--muted);margin-top:2px}

.metric{padding:12px 0;border-bottom:1px dashed rgba(0,0,0,.06)}
.metric:last-child{border-bottom:none;padding-bottom:2px}
.metric-row{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.metric-name{font-weight:700;font-size:14px}
.metric-val{font-size:22px;font-weight:800;font-variant-numeric:tabular-nums;transition:color .3s;direction:ltr;unicode-bidi:isolate}
.metric-val.pulse{animation:pulse .45s ease-out}
.card.nns    .metric-val.pulse{color:var(--nns)}
.card.resp   .metric-val.pulse{color:var(--resp)}
.card.env    .metric-val.pulse{color:var(--env)}
.card.cardio .metric-val.pulse{color:#e26a92}
.card.motion .metric-val.pulse{color:#8b7ee0}
.metric-desc{font-size:12px;color:var(--muted);margin-top:6px;line-height:1.55}
.bar{margin-top:10px;height:7px;border-radius:4px;background:rgba(0,0,0,.05);overflow:hidden}
.bar-fill{height:100%;border-radius:4px;transition:width .5s cubic-bezier(.4,0,.2,1);background:linear-gradient(90deg,var(--nns),#FFD3B6)}
.card.resp   .bar-fill{background:linear-gradient(90deg,var(--resp),#A0D2EB)}
.card.env    .bar-fill{background:linear-gradient(90deg,var(--env),#B8E4C9)}
.card.cardio .bar-fill{background:linear-gradient(90deg,#F5A9B8,#F17A9E)}
.card.motion .bar-fill{background:linear-gradient(90deg,#B5A8F0,#C7BDF7)}
html[dir="rtl"] .bar-fill{background:linear-gradient(270deg,var(--nns),#FFD3B6)}
html[dir="rtl"] .card.resp   .bar-fill{background:linear-gradient(270deg,var(--resp),#A0D2EB)}
html[dir="rtl"] .card.env    .bar-fill{background:linear-gradient(270deg,var(--env),#B8E4C9)}
html[dir="rtl"] .card.cardio .bar-fill{background:linear-gradient(270deg,#F5A9B8,#F17A9E)}
html[dir="rtl"] .card.motion .bar-fill{background:linear-gradient(270deg,#B5A8F0,#C7BDF7)}
/* heartbeat pulse */
@keyframes hb{0%,100%{transform:scale(1)}25%{transform:scale(1.15)}50%{transform:scale(1)}75%{transform:scale(1.08)}}
.hb-icon.beating{animation:hb 1s ease-in-out infinite}

/* ============  AI Analysis panel  ============ */
.ai-card{position:relative;z-index:1;max-width:1200px;margin:6px auto 24px;padding:24px 26px;
  background:linear-gradient(135deg,rgba(181,168,240,.18),rgba(255,170,165,.10) 55%,rgba(160,210,235,.15));
  backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
  border-radius:28px;box-shadow:var(--shadow);overflow:hidden;
  transition:box-shadow .4s ease;animation:fadeIn .8s}
.ai-card::before{content:"";position:absolute;inset:0;border-radius:28px;padding:1.5px;
  background:linear-gradient(135deg,#B5A8F0,#FFAAA5,#A0D2EB,#B5A8F0);background-size:220% 220%;
  -webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);
  -webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none;animation:shimmer 6s linear infinite}
@keyframes shimmer{0%{background-position:0% 0%}100%{background-position:200% 200%}}
.ai-card.severity-watch{box-shadow:0 0 34px rgba(255,193,104,.22),var(--shadow)}
.ai-card.severity-alert{box-shadow:0 0 40px rgba(255,107,107,.28),var(--shadow)}
.ai-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.ai-icon-badge{width:38px;height:38px;border-radius:12px;background:linear-gradient(135deg,#B5A8F0,#FFAAA5);
  display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 4px 14px rgba(181,168,240,.35);
  animation:sparkle-rot 3.2s ease-in-out infinite}
.ai-icon-badge svg{width:22px;height:22px}
@keyframes sparkle-rot{0%,100%{transform:rotate(-6deg) scale(1)}50%{transform:rotate(6deg) scale(1.12)}}
.ai-title{font-size:19px;font-weight:800;background:linear-gradient(90deg,#7969d1,#e26a92);
  -webkit-background-clip:text;background-clip:text;color:transparent}
.ai-badge{margin-left:auto;padding:6px 14px;border-radius:999px;font-size:12px;font-weight:800;
  background:rgba(125,206,160,.20);color:#2e8659;letter-spacing:.3px}
html[dir="rtl"] .ai-badge{margin-left:0;margin-right:auto}
.ai-badge.watch{background:rgba(255,193,104,.25);color:#a3670b}
.ai-badge.alert{background:rgba(255,107,107,.20);color:#c93b3b;animation:sparkle 1.4s ease-in-out infinite}
.ai-sub{color:var(--muted);font-size:13px;margin:6px 0 14px}
.ai-section{margin-top:14px}
.ai-section h3{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:6px}
.ai-list{list-style:none;padding:0}
.ai-list li{position:relative;padding:9px 0 9px 22px;font-size:14px;line-height:1.55;
  border-bottom:1px dashed rgba(0,0,0,.05);animation:fadeIn .5s}
.ai-list li:last-child{border-bottom:none}
.ai-list li::before{content:"";position:absolute;left:6px;top:15px;width:7px;height:7px;border-radius:50%;
  background:linear-gradient(135deg,#B5A8F0,#e26a92)}
html[dir="rtl"] .ai-list li{padding:9px 22px 9px 0}
html[dir="rtl"] .ai-list li::before{left:auto;right:6px}
.ai-list.recs li::before{background:linear-gradient(135deg,#FFC168,#FF6B6B)}
.ai-foot{margin-top:16px;padding-top:12px;border-top:1px dashed rgba(0,0,0,.06);
  display:flex;align-items:center;gap:8px;font-size:11px;color:var(--muted)}
.ai-pulse{width:8px;height:8px;border-radius:50%;background:#B5A8F0;animation:sparkle 1.2s ease-in-out infinite}
@media (max-width:520px){.ai-card{margin:6px 12px 20px;padding:20px}.ai-title{font-size:17px}}

/* breathing wave svg */
.wave{margin-top:10px;height:36px;width:100%}
.wave path{stroke:var(--resp);stroke-width:2.5;fill:none;stroke-linecap:round;stroke-dasharray:200;stroke-dashoffset:0;animation:wave 3s linear infinite}
@keyframes wave{from{stroke-dashoffset:0}to{stroke-dashoffset:-200}}

/* apnea overlay */
.apnea-alert{position:fixed;inset:0;background:rgba(255,107,107,.18);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:none;align-items:center;justify-content:center;z-index:100;padding:20px}
.apnea-alert.on{display:flex;animation:fadeIn .3s}
.apnea-inner{background:#fff;padding:36px 32px;border-radius:26px;text-align:center;box-shadow:var(--shadow-hover);animation:pulseAlert 1.2s infinite;max-width:400px}
.apnea-inner svg{width:70px;height:70px;color:var(--alert);margin-bottom:10px}
.apnea-inner h2{font-size:22px;color:var(--alert);margin-bottom:8px;font-weight:800}
.apnea-inner p{color:var(--muted);font-size:14px}

footer{position:relative;z-index:1;text-align:center;padding:24px;color:var(--muted);font-size:12px;line-height:1.7}
footer strong{color:var(--text)}

@media (max-width:520px){
  .logo{font-size:26px}
  .logo .badge{width:46px;height:46px}
  .hero{margin:12px;padding:20px}
  .hero h1{font-size:17px}
}
</style>
</head>
<body>

<!-- floating decorations -->
<svg class="decor d1" width="34" height="34" viewBox="0 0 24 24" fill="#FFB5A7"><path d="M12 2 L14 9 L21 9 L15 13 L17 20 L12 16 L7 20 L9 13 L3 9 L10 9 Z"/></svg>
<svg class="decor d2" width="26" height="26" viewBox="0 0 24 24" fill="#B5A8F0"><path d="M12 2 L14 9 L21 9 L15 13 L17 20 L12 16 L7 20 L9 13 L3 9 L10 9 Z"/></svg>
<svg class="decor d3" width="70" height="46" viewBox="0 0 60 40" fill="#B8DFF5"><ellipse cx="15" cy="26" rx="10" ry="8"/><ellipse cx="30" cy="20" rx="15" ry="12"/><ellipse cx="46" cy="26" rx="11" ry="8"/></svg>
<svg class="decor d4" width="46" height="46" viewBox="0 0 40 40" fill="none" stroke="#FFAAA5" stroke-width="2.5" stroke-linecap="round"><circle cx="20" cy="20" r="14"/><circle cx="15" cy="18" r="2" fill="#FFAAA5"/><circle cx="25" cy="18" r="2" fill="#FFAAA5"/><path d="M14 25 Q20 29 26 25"/></svg>
<svg class="decor d5" width="30" height="30" viewBox="0 0 24 24" fill="#FFD3B6"><path d="M21 12.79A9 9 0 1 1 11.21 3 A7 7 0 0 0 21 12.79z"/></svg>

<header>
  <div class="logo">
    <span class="badge">
      <svg viewBox="0 0 100 100" fill="none">
        <circle cx="50" cy="34" r="20" stroke="currentColor" stroke-width="6"/>
        <ellipse cx="50" cy="72" rx="16" ry="18" fill="currentColor"/>
        <circle cx="50" cy="72" r="6" fill="rgba(255,255,255,.6)"/>
      </svg>
    </span>
    <span>NeuroGuard</span>
  </div>
  <div class="subtitle" data-i18n="subtitle">Smart Pacifier · Unit 1 · Live</div>
</header>

<section class="hero">
  <h1 data-i18n="hero_title">Early digital biomarkers for SIDS arousal dysfunction</h1>
  <p data-i18n="hero_desc">A multi-sensor smart pacifier that continuously monitors non-nutritive sucking dynamics, respiratory sounds, and the sleep environment — surfacing subtle changes linked to brainstem regulation and protective arousal failure.</p>
  <div class="tags">
    <span class="tag"   data-i18n="tag_nns">NNS dynamics</span>
    <span class="tag b" data-i18n="tag_resp">Respiratory</span>
    <span class="tag g" data-i18n="tag_env">Environment</span>
    <span class="tag"   style="background:rgba(241,122,158,.18);color:#c95d81" data-i18n="tag_cardio">Cardiac / HRV</span>
    <span class="tag"   style="background:rgba(181,168,240,.20);color:#7969d1" data-i18n="tag_motion">Motion</span>
  </div>
</section>

<div class="status-bar">
  <div class="status-pill"><span class="dot err" id="dot-conn"></span><span id="conn-txt" data-i18n="connecting">Connecting…</span></div>
  <div class="status-pill"><span class="dot" id="dot-aht"></span>AHT21</div>
  <div class="status-pill"><span class="dot" id="dot-ens"></span>ENS160</div>
  <div class="status-pill"><span class="dot err" id="dot-brace"></span><span id="brace-txt" data-i18n="bracelet_offline">Bracelet offline</span></div>
  <div class="status-pill"><span data-i18n="uptime">Uptime</span> <span id="uptime">0s</span></div>
  <button class="lang-btn" onclick="toggleLang()" title="Change language / تغيير اللغة">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2 a15 15 0 0 1 4 10 a15 15 0 0 1 -4 10 a15 15 0 0 1 -4 -10 a15 15 0 0 1 4 -10 z"/></svg>
    <span id="lang-label">العربية</span>
  </button>
</div>

<!-- ================  AI ANALYSIS PANEL  ================ -->
<section class="ai-card" id="ai-card">
  <div class="ai-head">
    <div class="ai-icon-badge">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3 L13.5 8.5 L19 10 L13.5 11.5 L12 17 L10.5 11.5 L5 10 L10.5 8.5 Z"/>
        <path d="M18 3 L18.7 5 L20.7 5.7 L18.7 6.4 L18 8.5 L17.3 6.4 L15.3 5.7 L17.3 5 Z"/>
        <path d="M6 15 L6.6 16.6 L8.2 17.2 L6.6 17.8 L6 19.4 L5.4 17.8 L3.8 17.2 L5.4 16.6 Z"/>
      </svg>
    </div>
    <span class="ai-title" data-i18n="ai_title">AI Analysis</span>
    <span class="ai-badge" id="ai-badge" data-i18n="ai_calm">Calm & Healthy</span>
  </div>
  <div class="ai-sub" data-i18n="ai_sub">Real-time synthesis across every sensor stream</div>

  <div class="ai-section">
    <h3 data-i18n="ai_observations">Current observations</h3>
    <ul class="ai-list" id="ai-observations"><li data-i18n="ai_waiting">Waiting for first sensor snapshot…</li></ul>
  </div>

  <div class="ai-section" id="ai-recs-block" style="display:none">
    <h3 data-i18n="ai_recommendations">Recommendations</h3>
    <ul class="ai-list recs" id="ai-recommendations"></ul>
  </div>

  <div class="ai-foot">
    <span class="ai-pulse"></span>
    <span data-i18n="ai_analyzing">Analyzing sensor fusion</span>
    <span id="ai-timer">·</span>
  </div>
</section>

<main class="grid">

  <!-- NNS -->
  <section class="card nns">
    <div class="card-head">
      <div class="icon">
        <svg viewBox="0 0 100 100" fill="none">
          <circle cx="50" cy="34" r="18" stroke="currentColor" stroke-width="6"/>
          <ellipse cx="50" cy="70" rx="15" ry="18" fill="currentColor" fill-opacity=".45"/>
          <circle cx="50" cy="70" r="5" fill="currentColor"/>
        </svg>
      </div>
      <div>
        <h2 data-i18n="nns_title">Sucking Dynamics</h2>
        <p  data-i18n="nns_sub">Non-nutritive sucking — driven by the brainstem</p>
      </div>
    </div>

    <div class="metric">
      <div class="metric-row"><span class="metric-name" data-i18n="nns_live">Live pressure</span><span class="metric-val" id="v-fsr">0.0%</span></div>
      <div class="bar"><div class="bar-fill" id="bar-fsr" style="width:0%"></div></div>
      <div class="metric-desc" data-i18n="nns_live_desc">Instantaneous suck force on the pacifier nipple.</div>
    </div>
    <div class="metric">
      <div class="metric-row"><span class="metric-name" data-i18n="nns_sucks">Sucks / minute</span><span class="metric-val" id="v-sucks">0</span></div>
      <div class="metric-desc" data-i18n="nns_sucks_desc">Individual suck events counted in a rolling 60 s window.</div>
    </div>
    <div class="metric">
      <div class="metric-row"><span class="metric-name" data-i18n="nns_bursts">Bursts / minute</span><span class="metric-val" id="v-bursts">0</span></div>
      <div class="metric-desc" data-i18n="nns_bursts_desc">Groups of sucks separated by ≥ 1.5 s pauses — reveals organized sucking pattern.</div>
    </div>
    <div class="metric">
      <div class="metric-row"><span class="metric-name" data-i18n="nns_peak">Mean peak strength</span><span class="metric-val" id="v-peak">0.0%</span></div>
      <div class="metric-desc" data-i18n="nns_peak_desc">Average peak pressure per suck — an oromotor-tone indicator.</div>
    </div>
    <div class="metric">
      <div class="metric-row"><span class="metric-name" data-i18n="nns_burst">Mean burst duration</span><span class="metric-val" id="v-burst">0.00 s</span></div>
      <div class="metric-desc" data-i18n="nns_burst_desc">Length of an organized suck bout.</div>
    </div>
    <div class="metric">
      <div class="metric-row"><span class="metric-name" data-i18n="nns_reg">Regularity (CV)</span><span class="metric-val" id="v-reg">0.000</span></div>
      <div class="metric-desc" data-i18n="nns_reg_desc">Rhythm consistency: 0 = perfectly regular · higher = disorganized suck.</div>
    </div>
  </section>

  <!-- RESP -->
  <section class="card resp">
    <div class="card-head">
      <div class="icon">
        <svg viewBox="0 0 100 100" fill="none">
          <path d="M10 40 Q30 40 40 40 T70 40 Q80 40 85 34" stroke="currentColor" stroke-width="6.5" stroke-linecap="round"/>
          <path d="M10 60 Q30 60 50 60 T80 60" stroke="currentColor" stroke-width="6.5" stroke-linecap="round"/>
          <path d="M10 80 Q30 80 40 80 T66 80" stroke="currentColor" stroke-width="6.5" stroke-linecap="round"/>
        </svg>
      </div>
      <div>
        <h2 data-i18n="resp_title">Respiration</h2>
        <p  data-i18n="resp_sub">Airflow sound → breath rate & apnea watch</p>
      </div>
    </div>

    <div class="metric">
      <div class="metric-row"><span class="metric-name" data-i18n="resp_mic">Sound level</span><span class="metric-val" id="v-mic">0</span></div>
      <div class="bar"><div class="bar-fill" id="bar-mic" style="width:0%"></div></div>
      <svg class="wave" viewBox="0 0 200 30" preserveAspectRatio="none">
        <path d="M0 15 Q25 0 50 15 T100 15 T150 15 T200 15 T250 15"/>
      </svg>
      <div class="metric-desc" data-i18n="resp_mic_desc">Live audio amplitude (peak-to-peak).</div>
    </div>
    <div class="metric">
      <div class="metric-row"><span class="metric-name" data-i18n="resp_events">Respiratory events / min</span><span class="metric-val" id="v-events">0</span></div>
      <div class="metric-desc" data-i18n="resp_events_desc">Distinct airflow sounds detected.</div>
    </div>
    <div class="metric">
      <div class="metric-row"><span class="metric-name" data-i18n="resp_breaths">Est. breaths / min</span><span class="metric-val" id="v-breaths">0</span></div>
      <div class="metric-desc" data-i18n="resp_breaths_desc">Inhale + exhale grouped. Infant normal range 30–60 / min.</div>
    </div>
    <div class="metric">
      <div class="metric-row"><span class="metric-name" data-i18n="resp_since">Since last breath</span><span class="metric-val" id="v-since">0 s</span></div>
      <div class="metric-desc" data-i18n="resp_since_desc">Apnea watchdog — alert fires at ≥ 10 s (demo threshold).</div>
    </div>
  </section>

  <!-- ENV -->
  <section class="card env">
    <div class="card-head">
      <div class="icon">
        <svg viewBox="0 0 100 100" fill="none">
          <path d="M50 14 Q28 30 28 55 Q28 82 50 88 Q72 82 72 55 Q72 30 50 14 Z" fill="currentColor" fill-opacity=".35"/>
          <path d="M50 14 Q50 50 50 88" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
        </svg>
      </div>
      <div>
        <h2 data-i18n="env_title">Sleep Environment</h2>
        <p  data-i18n="env_sub">Ambient air quality & climate</p>
      </div>
    </div>

    <div class="metric">
      <div class="metric-row"><span class="metric-name" data-i18n="env_temp">Temperature</span><span class="metric-val" id="v-temp">— °C</span></div>
      <div class="metric-desc" data-i18n="env_temp_desc">Overheating during sleep is a well-known SIDS risk factor.</div>
    </div>
    <div class="metric">
      <div class="metric-row"><span class="metric-name" data-i18n="env_rh">Humidity</span><span class="metric-val" id="v-rh">— %</span></div>
      <div class="metric-desc" data-i18n="env_rh_desc">Sleep environment comfort.</div>
    </div>
    <div class="metric">
      <div class="metric-row"><span class="metric-name" data-i18n="env_eco2">eCO₂</span><span class="metric-val" id="v-eco2">— ppm</span></div>
      <div class="bar"><div class="bar-fill" id="bar-eco2" style="width:0%"></div></div>
      <div class="metric-desc" data-i18n="env_eco2_desc">Equivalent CO₂. 400 = fresh air · >1000 = poorly ventilated · >2000 = drowsy.</div>
    </div>
    <div class="metric">
      <div class="metric-row"><span class="metric-name" data-i18n="env_tvoc">TVOC</span><span class="metric-val" id="v-tvoc">— ppb</span></div>
      <div class="metric-desc" data-i18n="env_tvoc_desc">Volatile organic compounds — breath, cleaners, off-gassing.</div>
    </div>
    <div class="metric">
      <div class="metric-row"><span class="metric-name" data-i18n="env_aqi">Air quality index</span><span class="metric-val" id="v-aqi">—</span></div>
      <div class="metric-desc" data-i18n="env_aqi_desc">ScioSense composite AQI (1 excellent → 5 unhealthy).</div>
    </div>
  </section>

  <!-- CARDIAC (Unit 2 — foot bracelet, MAX30102) -->
  <section class="card cardio offline" id="card-cardio">
    <div class="card-head">
      <div class="icon">
        <svg class="hb-icon" viewBox="0 0 100 100" fill="currentColor">
          <path d="M50 88 C 20 68, 8 46, 20 30 C 30 18, 44 22, 50 34 C 56 22, 70 18, 80 30 C 92 46, 80 68, 50 88 Z"/>
        </svg>
      </div>
      <div>
        <h2 data-i18n="cardio_title">Cardiac & HRV</h2>
        <p  data-i18n="cardio_sub">PPG on the foot → HR, SpO₂, autonomic tone</p>
      </div>
    </div>

    <div class="metric">
      <div class="metric-row"><span class="metric-name" data-i18n="cardio_hr">Heart rate</span><span class="metric-val" id="v-hr">— bpm</span></div>
      <div class="metric-desc" data-i18n="cardio_hr_desc">Instantaneous HR. Source: (beat) per-beat detection · (algo) SpO₂ algorithm.</div>
    </div>
    <div class="metric">
      <div class="metric-row"><span class="metric-name" data-i18n="cardio_spo2">SpO₂</span><span class="metric-val" id="v-spo2">— %</span></div>
      <div class="bar"><div class="bar-fill" id="bar-spo2" style="width:0%"></div></div>
      <div class="metric-desc" data-i18n="cardio_spo2_desc">Blood oxygen saturation. Normal ≥ 95 %.</div>
    </div>
    <div class="metric">
      <div class="metric-row"><span class="metric-name" data-i18n="cardio_rr">RR interval</span><span class="metric-val" id="v-rr">— ms</span></div>
      <div class="metric-desc" data-i18n="cardio_rr_desc">Last beat-to-beat interval. Basis for all HRV metrics.</div>
    </div>
    <div class="metric">
      <div class="metric-row"><span class="metric-name" data-i18n="cardio_sdnn">SDNN</span><span class="metric-val" id="v-sdnn">— ms</span></div>
      <div class="metric-desc" data-i18n="cardio_sdnn_desc">Standard deviation of RR — overall heart-rate variability.</div>
    </div>
    <div class="metric">
      <div class="metric-row"><span class="metric-name" data-i18n="cardio_rmssd">RMSSD</span><span class="metric-val" id="v-rmssd">— ms</span></div>
      <div class="metric-desc" data-i18n="cardio_rmssd_desc">Parasympathetic tone proxy. Key HRV marker in the SIDS literature.</div>
    </div>
    <div class="metric">
      <div class="metric-row"><span class="metric-name" data-i18n="cardio_pnn50">pNN50</span><span class="metric-val" id="v-pnn50">— %</span></div>
      <div class="metric-desc" data-i18n="cardio_pnn50_desc">Percentage of successive RR differences &gt; 50 ms — vagal tone indicator.</div>
    </div>
  </section>

  <!-- MOTION (Unit 2 — foot bracelet, MPU-6050) -->
  <section class="card motion offline" id="card-motion">
    <div class="card-head">
      <div class="icon">
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="50" cy="22" r="9" fill="currentColor"/>
          <path d="M32 78 L44 54 L58 60 L70 42"/>
          <path d="M44 54 L38 46 L26 50"/>
          <path d="M58 60 L64 82 L72 84"/>
        </svg>
      </div>
      <div>
        <h2 data-i18n="motion_title">Motion & Posture</h2>
        <p  data-i18n="motion_sub">IMU on the foot → activity, stillness, orientation</p>
      </div>
    </div>

    <div class="metric">
      <div class="metric-row"><span class="metric-name" data-i18n="motion_activity">Activity level</span><span class="metric-val" id="v-act">— g</span></div>
      <div class="bar"><div class="bar-fill" id="bar-act" style="width:0%"></div></div>
      <div class="metric-desc" data-i18n="motion_activity_desc">RMS acceleration over the last second, net of gravity.</div>
    </div>
    <div class="metric">
      <div class="metric-row"><span class="metric-name" data-i18n="motion_events">Motion events / min</span><span class="metric-val" id="v-mev">0</span></div>
      <div class="metric-desc" data-i18n="motion_events_desc">Discrete movement bursts — arousal-related motor activity.</div>
    </div>
    <div class="metric">
      <div class="metric-row"><span class="metric-name" data-i18n="motion_still">Stillness</span><span class="metric-val" id="v-still">0 s</span></div>
      <div class="metric-desc" data-i18n="motion_still_desc">Seconds since last movement — long stillness watchdog.</div>
    </div>
    <div class="metric">
      <div class="metric-row"><span class="metric-name" data-i18n="motion_posture">Foot orientation</span><span class="metric-val" id="v-pos">—</span></div>
      <div class="metric-desc" data-i18n="motion_posture_desc">Descriptive foot posture (flat, tilted, toe up/down).</div>
    </div>
  </section>

</main>

<!-- apnea overlay -->
<div class="apnea-alert" id="apnea">
  <div class="apnea-inner">
    <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 50 L28 50 L38 22 L58 78 L68 50 L92 50"/>
    </svg>
    <h2 id="apnea-title" data-i18n="apnea_title">Apnea Detected</h2>
    <p  id="apnea-detail">—</p>
  </div>
</div>

<footer>
  <strong>NeuroGuard</strong> · <span data-i18n="footer_line1">Multi-Sensor Smart Pacifier System</span><br>
  <span data-i18n="footer_line2">Non-Nutritive Sucking · HRV · Respiratory Biomarkers · Arousal Dysfunction Research</span>
</footer>

<script>
// ---------- i18n dictionaries ----------
const I18N = {
  en: {
    subtitle:"Smart Pacifier · Unit 1 · Live",
    hero_title:"Early digital biomarkers for SIDS arousal dysfunction",
    hero_desc:"A multi-sensor smart pacifier that continuously monitors non-nutritive sucking dynamics, respiratory sounds, and the sleep environment — surfacing subtle changes linked to brainstem regulation and protective arousal failure.",
    tag_nns:"NNS dynamics", tag_resp:"Respiratory", tag_env:"Environment",
    tag_cardio:"Cardiac / HRV", tag_motion:"Motion",
    connecting:"Connecting…", live:"Live", offline:"Offline", uptime:"Uptime",
    bracelet_offline:"Bracelet offline", bracelet_linked:"Bracelet linked",
    nns_title:"Sucking Dynamics",
    nns_sub:"Non-nutritive sucking — driven by the brainstem",
    nns_live:"Live pressure",
    nns_live_desc:"Instantaneous suck force on the pacifier nipple.",
    nns_sucks:"Sucks / minute",
    nns_sucks_desc:"Individual suck events counted in a rolling 60 s window.",
    nns_bursts:"Bursts / minute",
    nns_bursts_desc:"Groups of sucks separated by ≥ 1.5 s pauses — reveals organized sucking pattern.",
    nns_peak:"Mean peak strength",
    nns_peak_desc:"Average peak pressure per suck — an oromotor-tone indicator.",
    nns_burst:"Mean burst duration",
    nns_burst_desc:"Length of an organized suck bout.",
    nns_reg:"Regularity (CV)",
    nns_reg_desc:"Rhythm consistency: 0 = perfectly regular · higher = disorganized suck.",
    resp_title:"Respiration",
    resp_sub:"Airflow sound → breath rate & apnea watch",
    resp_mic:"Sound level",
    resp_mic_desc:"Live audio amplitude (peak-to-peak).",
    resp_events:"Respiratory events / min",
    resp_events_desc:"Distinct airflow sounds detected.",
    resp_breaths:"Est. breaths / min",
    resp_breaths_desc:"Inhale + exhale grouped. Infant normal range 30–60 / min.",
    resp_since:"Since last breath",
    resp_since_desc:"Apnea watchdog — alert fires at ≥ 10 s (demo threshold).",
    env_title:"Sleep Environment",
    env_sub:"Ambient air quality & climate",
    env_temp:"Temperature",
    env_temp_desc:"Overheating during sleep is a well-known SIDS risk factor.",
    env_rh:"Humidity",
    env_rh_desc:"Sleep environment comfort.",
    env_eco2:"eCO₂",
    env_eco2_desc:"Equivalent CO₂. 400 = fresh air · >1000 = poorly ventilated · >2000 = drowsy.",
    env_tvoc:"TVOC",
    env_tvoc_desc:"Volatile organic compounds — breath, cleaners, off-gassing.",
    env_aqi:"Air quality index",
    env_aqi_desc:"ScioSense composite AQI (1 excellent → 5 unhealthy).",
    cardio_title:"Cardiac & HRV",
    cardio_sub:"PPG on the foot → HR, SpO₂, autonomic tone",
    cardio_hr:"Heart rate",
    cardio_hr_desc:"Instantaneous HR. Source: (beat) per-beat detection · (algo) SpO₂ algorithm.",
    cardio_spo2:"SpO₂",
    cardio_spo2_desc:"Blood oxygen saturation. Normal ≥ 95 %.",
    cardio_rr:"RR interval",
    cardio_rr_desc:"Last beat-to-beat interval. Basis for all HRV metrics.",
    cardio_sdnn:"SDNN",
    cardio_sdnn_desc:"Standard deviation of RR — overall heart-rate variability.",
    cardio_rmssd:"RMSSD",
    cardio_rmssd_desc:"Parasympathetic tone proxy. Key HRV marker in the SIDS literature.",
    cardio_pnn50:"pNN50",
    cardio_pnn50_desc:"Percentage of successive RR differences > 50 ms — vagal tone indicator.",
    motion_title:"Motion & Posture",
    motion_sub:"IMU on the foot → activity, stillness, orientation",
    motion_activity:"Activity level",
    motion_activity_desc:"RMS acceleration over the last second, net of gravity.",
    motion_events:"Motion events / min",
    motion_events_desc:"Discrete movement bursts — arousal-related motor activity.",
    motion_still:"Stillness",
    motion_still_desc:"Seconds since last movement — long stillness watchdog.",
    motion_posture:"Foot orientation",
    motion_posture_desc:"Descriptive foot posture (flat, tilted, toe up/down).",
    posture_labels:{unknown:"unknown", flat:"flat", "tilted left":"tilted left", "tilted right":"tilted right", "toe up":"toe up", "toe down":"toe down", tilted:"tilted"},
    // ---- AI panel ----
    ai_title:"AI Analysis",
    ai_sub:"Real-time synthesis across every sensor stream",
    ai_observations:"Current observations",
    ai_recommendations:"Recommendations",
    ai_calm:"Calm & Healthy",
    ai_watch:"Watch Closely",
    ai_alert:"Attention Needed",
    ai_waiting:"Waiting for first sensor snapshot…",
    ai_analyzing:"Analyzing sensor fusion",
    ai_updated: s => `updated ${s}s ago`,
    ai_partial:"Bracelet offline — cardiac and motion metrics unavailable.",
    ai_hr_normal:      hr => `Heart rate ${hr} bpm sits comfortably in the ideal infant range (100–160).`,
    ai_hr_borderline:  hr => `Heart rate ${hr} bpm is at the edge of the normal range — worth watching.`,
    ai_hr_low:         hr => `Heart rate ${hr} bpm is unusually low — check on the baby.`,
    ai_hr_high:        hr => `Heart rate ${hr} bpm is elevated — the baby may be warm, crying, or active.`,
    ai_spo2_normal:    s  => `Blood oxygen ${s}% indicates excellent oxygenation.`,
    ai_spo2_borderline:s  => `Blood oxygen ${s}% is slightly reduced — continue monitoring.`,
    ai_spo2_low:       s  => `Blood oxygen ${s}% is below the safe threshold — immediate check advised.`,
    ai_hrv_good:       v  => `Heart-rate variability (RMSSD ${v} ms) reflects healthy autonomic regulation.`,
    ai_hrv_low:        v  => `HRV (RMSSD ${v} ms) is lower than typical — possible stress or shallow sleep.`,
    ai_apnea:          s  => `No breath sound detected for ${s} seconds — apnea event flagged.`,
    ai_resp_low:       b  => `Respiratory rate ${b}/min is below the typical infant range.`,
    ai_resp_high:      b  => `Respiratory rate ${b}/min is elevated.`,
    ai_resp_normal:    b  => `Respiratory rate ${b}/min is within the normal 30–60 window.`,
    ai_temp_high:      t  => `Room temperature ${t} °C is above the recommended sleep range (18–22 °C).`,
    ai_temp_low:       t  => `Room temperature ${t} °C is on the cool side.`,
    ai_temp_ok:        t  => `Room temperature ${t} °C is comfortable for sleep.`,
    ai_co2_high:       v  => `eCO₂ ${v} ppm suggests the room could use ventilation.`,
    ai_co2_ok:         v  => `Indoor air quality is good (eCO₂ ${v} ppm).`,
    ai_nns_organized:  (n,cv) => `Sucking pattern is well-organized (${n} sucks/min, CV ${cv}) — brainstem regulation looks intact.`,
    ai_nns_disorganized:(n,cv)=> `Sucking rhythm is irregular (CV ${cv}) — worth flagging for review.`,
    ai_nns_active:     n  => `Non-nutritive sucking is active (${n} sucks/min).`,
    ai_nns_quiet:"No active sucking — baby may be sleeping or the pacifier is not in use.",
    ai_stillness:      s  => `The baby has been still for ${Math.floor(s/60)} min — verify comfort and breathing.`,
    ai_high_activity:  n  => `Elevated movement (${n} events/min) — the baby may be waking or restless.`,
    ai_calm_activity:"Gentle, calm movement — consistent with restful sleep.",
    rec_check_baby:"Physically check on the baby.",
    rec_check_breathing:"Verify chest movement and airway immediately.",
    rec_lower_temp:"Lower room temperature or reduce swaddling.",
    rec_ventilate:"Open a window or improve room ventilation.",
    apnea_title:"Apnea Detected",
    apnea_detail: s => `No respiratory sound for ${s} seconds.`,
    footer_line1:"Multi-Sensor Smart Pacifier System",
    footer_line2:"Non-Nutritive Sucking · HRV · Respiratory Biomarkers · Arousal Dysfunction Research",
    u_deg:" °C", u_rh:" %", u_ppm:" ppm", u_ppb:" ppb", u_sec:" s", u_pct:"%",
    aqi:["n/a","excellent","good","moderate","poor","unhealthy"],
    lang_switch_label:"العربية"
  },
  ar: {
    subtitle:"لهاية ذكية · الوحدة الأولى · مباشر",
    hero_title:"مؤشرات حيوية رقمية مبكرة لخلل الاستيقاظ في متلازمة موت الرضع المفاجئ",
    hero_desc:"لهاية ذكية متعددة الحساسات تراقب باستمرار ديناميكيات المص غير المغذي، وأصوات التنفس، وبيئة النوم — للكشف عن التغيرات الدقيقة المرتبطة بتنظيم جذع الدماغ وفشل الاستيقاظ الوقائي.",
    tag_nns:"ديناميكيات المص", tag_resp:"التنفس", tag_env:"البيئة",
    tag_cardio:"القلب / HRV", tag_motion:"الحركة",
    connecting:"جارٍ الاتصال…", live:"مباشر", offline:"غير متصل", uptime:"مدة التشغيل",
    bracelet_offline:"السوار غير متصل", bracelet_linked:"السوار متصل",
    nns_title:"ديناميكيات المص",
    nns_sub:"المص غير المغذي — يتحكم به جذع الدماغ",
    nns_live:"الضغط اللحظي",
    nns_live_desc:"قوة المص اللحظية على حلمة اللهاية.",
    nns_sucks:"المصات / دقيقة",
    nns_sucks_desc:"عدد أحداث المص المسجّلة خلال آخر 60 ثانية.",
    nns_bursts:"النوبات / دقيقة",
    nns_bursts_desc:"مجموعات من المصات تفصلها فترات ≥ 1.5 ثانية — تكشف نمط المص المنظم.",
    nns_peak:"متوسط قوة الذروة",
    nns_peak_desc:"متوسط ذروة الضغط لكل مصة — مؤشر على قوة العضلات الفموية.",
    nns_burst:"متوسط مدة النوبة",
    nns_burst_desc:"طول نوبة المص المنظمة.",
    nns_reg:"الانتظام (معامل التغير)",
    nns_reg_desc:"انتظام الإيقاع: 0 = منتظم تمامًا · كلما زاد الرقم زاد اضطراب المص.",
    resp_title:"التنفس",
    resp_sub:"صوت الهواء ← معدل التنفس ومراقبة انقطاع النفس",
    resp_mic:"مستوى الصوت",
    resp_mic_desc:"سعة الصوت اللحظية (ذروة إلى ذروة).",
    resp_events:"أحداث تنفسية / دقيقة",
    resp_events_desc:"أصوات تدفق الهواء المكتشفة.",
    resp_breaths:"تقدير الأنفاس / دقيقة",
    resp_breaths_desc:"الشهيق + الزفير معًا. المعدل الطبيعي للرضع 30–60 نفسًا/دقيقة.",
    resp_since:"منذ آخر نفس",
    resp_since_desc:"مراقب انقطاع النفس — ينطلق التنبيه عند ≥ 10 ثواني (عتبة تجريبية).",
    env_title:"بيئة النوم",
    env_sub:"جودة الهواء المحيط والمناخ",
    env_temp:"درجة الحرارة",
    env_temp_desc:"ارتفاع الحرارة أثناء النوم عامل خطر معروف للموت المفاجئ للرضع.",
    env_rh:"الرطوبة",
    env_rh_desc:"راحة بيئة النوم.",
    env_eco2:"ثاني أكسيد الكربون المكافئ",
    env_eco2_desc:"400 = هواء نقي · >1000 = تهوية ضعيفة · >2000 = مسبب للنعاس.",
    env_tvoc:"المركبات العضوية المتطايرة",
    env_tvoc_desc:"مركبات عضوية متطايرة — تنفس، منظفات، انبعاثات.",
    env_aqi:"مؤشر جودة الهواء",
    env_aqi_desc:"مؤشر AQI المركب من ScioSense (1 ممتاز → 5 غير صحي).",
    cardio_title:"القلب وتباين ضربات القلب (HRV)",
    cardio_sub:"إشارة PPG من القدم ← نبض، أكسجين، التنظيم الذاتي",
    cardio_hr:"معدل ضربات القلب",
    cardio_hr_desc:"معدل النبض اللحظي. المصدر: (beat) كشف كل نبضة · (algo) خوارزمية SpO₂.",
    cardio_spo2:"تشبع الأكسجين SpO₂",
    cardio_spo2_desc:"نسبة تشبع الدم بالأكسجين. الطبيعي ≥ 95 ٪.",
    cardio_rr:"الفاصل RR",
    cardio_rr_desc:"آخر فاصل بين نبضتين — أساس كل مؤشرات HRV.",
    cardio_sdnn:"SDNN",
    cardio_sdnn_desc:"الانحراف المعياري لفواصل RR — مقياس شامل لتباين ضربات القلب.",
    cardio_rmssd:"RMSSD",
    cardio_rmssd_desc:"مؤشر النشاط نظير الودي — من أهم مؤشرات HRV في أبحاث SIDS.",
    cardio_pnn50:"pNN50",
    cardio_pnn50_desc:"نسبة الفروق المتتالية في RR الأكبر من 50 مللي ثانية — مؤشر التوتر المبهمي.",
    motion_title:"الحركة والوضعية",
    motion_sub:"مقياس تسارع بالقدم ← النشاط، السكون، الاتجاه",
    motion_activity:"مستوى النشاط",
    motion_activity_desc:"جذر تربيع متوسط التسارع خلال آخر ثانية (بعد إزالة الجاذبية).",
    motion_events:"أحداث الحركة / دقيقة",
    motion_events_desc:"دفعات الحركة المميزة — نشاط حركي مرتبط بالاستيقاظ.",
    motion_still:"مدة السكون",
    motion_still_desc:"الثواني منذ آخر حركة — مراقب السكون الطويل.",
    motion_posture:"وضعية القدم",
    motion_posture_desc:"وصف اتجاه القدم (مستوية، مائلة، أصابع لأعلى/أسفل).",
    posture_labels:{unknown:"غير معروف", flat:"مستوية", "tilted left":"مائلة يسارًا", "tilted right":"مائلة يمينًا", "toe up":"أصابع لأعلى", "toe down":"أصابع لأسفل", tilted:"مائلة"},
    // ---- AI panel ----
    ai_title:"تحليل ذكي",
    ai_sub:"استنتاج آني بدمج قراءات جميع الحساسات",
    ai_observations:"الملاحظات الحالية",
    ai_recommendations:"التوصيات",
    ai_calm:"هادئ وسليم",
    ai_watch:"مراقبة مستمرة",
    ai_alert:"يستدعي الانتباه",
    ai_waiting:"في انتظار أول قراءة من الحساسات…",
    ai_analyzing:"جارٍ تحليل بيانات الحساسات",
    ai_updated: s => `تحديث منذ ${s} ث`,
    ai_partial:"السوار غير متصل — بيانات القلب والحركة غير متوفرة.",
    ai_hr_normal:      hr => `معدل ضربات القلب ${hr} نبضة/دقيقة ضمن المدى الطبيعي المثالي للرضيع (100–160).`,
    ai_hr_borderline:  hr => `معدل ضربات القلب ${hr} نبضة/دقيقة قريب من حد المدى الطبيعي — يستحق المراقبة.`,
    ai_hr_low:         hr => `معدل ضربات القلب ${hr} نبضة/دقيقة منخفض بشكل غير معتاد — يُنصح بفحص الرضيع.`,
    ai_hr_high:        hr => `معدل ضربات القلب ${hr} نبضة/دقيقة مرتفع — قد يكون الرضيع يبكي أو دافئًا أو نشطًا.`,
    ai_spo2_normal:    s  => `تشبع الأكسجين ${s}٪ يشير إلى أوكسجة ممتازة.`,
    ai_spo2_borderline:s  => `تشبع الأكسجين ${s}٪ منخفض قليلًا — واصل المراقبة.`,
    ai_spo2_low:       s  => `تشبع الأكسجين ${s}٪ تحت العتبة الآمنة — يُنصح بفحص فوري.`,
    ai_hrv_good:       v  => `تباين ضربات القلب (RMSSD ${v} مللي ث) يعكس تنظيمًا عصبيًا ذاتيًا سليمًا.`,
    ai_hrv_low:        v  => `HRV (RMSSD ${v} مللي ث) أقل من المعتاد — قد يشير إلى إجهاد أو نوم سطحي.`,
    ai_apnea:          s  => `لا يوجد صوت تنفس منذ ${s} ثانية — تم تسجيل حدث انقطاع نفس.`,
    ai_resp_low:       b  => `معدل التنفس ${b}/دقيقة أقل من المدى الطبيعي للرضع.`,
    ai_resp_high:      b  => `معدل التنفس ${b}/دقيقة مرتفع.`,
    ai_resp_normal:    b  => `معدل التنفس ${b}/دقيقة ضمن النطاق الطبيعي 30–60 نفسًا/دقيقة.`,
    ai_temp_high:      t  => `درجة حرارة الغرفة ${t} °م أعلى من نطاق النوم الموصى به (18–22 °م).`,
    ai_temp_low:       t  => `درجة حرارة الغرفة ${t} °م منخفضة نسبيًا.`,
    ai_temp_ok:        t  => `درجة حرارة الغرفة ${t} °م مريحة للنوم.`,
    ai_co2_high:       v  => `eCO₂ ${v} جزء/مليون يوحي بحاجة الغرفة لتهوية.`,
    ai_co2_ok:         v  => `جودة الهواء الداخلي جيدة (eCO₂ ${v} جزء/مليون).`,
    ai_nns_organized:  (n,cv) => `نمط المص منتظم (${n} مصة/دقيقة، CV ${cv}) — تنظيم جذع الدماغ يبدو سليمًا.`,
    ai_nns_disorganized:(n,cv)=> `إيقاع المص غير منتظم (CV ${cv}) — يستحق التوثيق للمراجعة.`,
    ai_nns_active:     n  => `المص غير المغذي نشط (${n} مصة/دقيقة).`,
    ai_nns_quiet:"لا يوجد مص نشط — قد يكون الرضيع نائمًا أو لا يستخدم اللهاية.",
    ai_stillness:      s  => `الرضيع ساكن منذ ${Math.floor(s/60)} دقيقة — تأكد من راحته وتنفسه.`,
    ai_high_activity:  n  => `حركة مرتفعة (${n} حدث/دقيقة) — قد يكون الرضيع مستيقظًا أو متململًا.`,
    ai_calm_activity:"حركة هادئة ولطيفة — تتوافق مع نوم مريح.",
    rec_check_baby:"افحص الرضيع مباشرةً.",
    rec_check_breathing:"تأكد فورًا من حركة الصدر ومجرى الهواء.",
    rec_lower_temp:"اخفض درجة حرارة الغرفة أو قلّل التقميط.",
    rec_ventilate:"افتح نافذة أو حسّن تهوية الغرفة.",
    apnea_title:"تم اكتشاف انقطاع النفس!",
    apnea_detail: s => `لا يوجد صوت تنفس منذ ${s} ثانية.`,
    footer_line1:"نظام لهاية ذكية متعددة الحساسات",
    footer_line2:"المص غير المغذي · تباين ضربات القلب · المؤشرات التنفسية · بحوث خلل الاستيقاظ",
    u_deg:" °م", u_rh:" ٪", u_ppm:" جزء/مليون", u_ppb:" جزء/مليار", u_sec:" ث", u_pct:"٪",
    aqi:["غير متاح","ممتاز","جيد","متوسط","ضعيف","غير صحي"],
    lang_switch_label:"English"
  }
};

// ---------- language state ----------
let lang = (localStorage.getItem('ng_lang')) || (navigator.language.startsWith('ar') ? 'ar' : 'en');
let T = I18N[lang];

function applyLang(){
  T = I18N[lang];
  document.documentElement.lang = lang;
  document.documentElement.dir  = (lang === 'ar') ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const k = el.getAttribute('data-i18n');
    if (T[k] !== undefined && typeof T[k] === 'string') el.textContent = T[k];
  });
  document.getElementById('lang-label').textContent = T.lang_switch_label;
  document.title = 'NeuroGuard · ' + T.nns_title;
}
function toggleLang(){
  lang = (lang === 'en') ? 'ar' : 'en';
  localStorage.setItem('ng_lang', lang);
  applyLang();
}
applyLang();

// ---------- live data ----------
let lastConn = null;
function fmtUptime(ms){const s=Math.floor(ms/1000),m=Math.floor(s/60),h=Math.floor(m/60);if(h)return h+'h '+(m%60)+'m';if(m)return m+'m '+(s%60)+'s';return s+'s';}
function set(id,val,unit){const el=document.getElementById(id);const t=val+(unit||'');if(el.textContent!==t){el.textContent=t;el.classList.remove('pulse');void el.offsetWidth;el.classList.add('pulse');}}
function setBar(id,pct){document.getElementById(id).style.width=Math.max(0,Math.min(100,pct))+'%';}
function setDot(id,state){const d=document.getElementById(id);d.classList.remove('warn','err');if(state==='warn')d.classList.add('warn');if(state==='err')d.classList.add('err');}
async function tick(){
  try{
    const r = await fetch('/data',{cache:'no-store'});
    if(!r.ok) throw 0;
    const d = await r.json();
    latestData = d;                       // feed AI analyser
    if(lastConn!=='ok'){setDot('dot-conn','ok');lastConn='ok';}
    document.getElementById('conn-txt').textContent = T.live;
    setDot('dot-aht', d.env.aht_ok?'ok':'err');
    setDot('dot-ens', d.env.ens_ok?'ok':'err');
    document.getElementById('uptime').textContent = fmtUptime(d.ts);
    // NNS
    set('v-fsr',    d.nns.fsr_now.toFixed(1), T.u_pct);
    setBar('bar-fsr', d.nns.fsr_now);
    set('v-sucks',  d.nns.sucks_per_min);
    set('v-bursts', d.nns.bursts_per_min);
    set('v-peak',   d.nns.mean_peak_pct.toFixed(1), T.u_pct);
    set('v-burst',  d.nns.mean_burst_sec.toFixed(2), T.u_sec);
    set('v-reg',    d.nns.regularity_cv.toFixed(3));
    // RESP
    set('v-mic',     d.resp.mic_pkpk);
    setBar('bar-mic', d.resp.mic_pkpk/30);
    set('v-events',  d.resp.events_per_min);
    set('v-breaths', d.resp.breaths_per_min);
    set('v-since',   d.resp.since_last_breath_s, T.u_sec);
    // ENV
    set('v-temp', d.env.temp_c.toFixed(1), T.u_deg);
    set('v-rh',   d.env.rh_pct.toFixed(1), T.u_rh);
    set('v-eco2', d.env.eco2_ppm, T.u_ppm);
    setBar('bar-eco2', (d.env.eco2_ppm-400)/16);
    set('v-tvoc', d.env.tvoc_ppb, T.u_ppb);
    set('v-aqi',  d.env.aqi + ' (' + (T.aqi[d.env.aqi] || '—') + ')');
    // Bracelet (Unit 2 — arrives via BLE on the pacifier)
    const b = d.bracelet || {linked:false};
    const cardio = document.getElementById('card-cardio');
    const motion = document.getElementById('card-motion');
    const hbIcon = document.querySelector('.hb-icon');
    if (b.linked) {
      cardio.classList.remove('offline');
      motion.classList.remove('offline');
      document.getElementById('dot-brace').classList.remove('err');
      document.getElementById('brace-txt').textContent = T.bracelet_linked;
      // Cardiac
      if (b.hr_bpm > 0) {
        set('v-hr', b.hr_bpm + ' bpm (' + b.hr_src + ')');
        hbIcon.classList.add('beating');
        hbIcon.style.animationDuration = (60 / b.hr_bpm).toFixed(2) + 's';
      } else {
        set('v-hr', '— bpm');
        hbIcon.classList.remove('beating');
      }
      if (b.spo2_valid) { set('v-spo2', b.spo2_pct, ' %'); setBar('bar-spo2', b.spo2_pct); }
      else              { set('v-spo2', '— %');           setBar('bar-spo2', 0); }
      set('v-rr',    b.rr_last_ms > 0 ? b.rr_last_ms + ' ms' : '— ms');
      set('v-sdnn',  b.sdnn_ms.toFixed(1) + ' ms');
      set('v-rmssd', b.rmssd_ms.toFixed(1) + ' ms');
      set('v-pnn50', b.pnn50_pct + ' %');
      // Motion
      set('v-act',   b.activity_g.toFixed(3) + ' g');
      setBar('bar-act', b.activity_g * 100);   // 1 g → 100 %
      set('v-mev',   b.motion_events_min);
      set('v-still', b.still_for_s + ' s');
      const posMap = T.posture_labels || {};
      set('v-pos',   (posMap[b.posture] || b.posture));
    } else {
      cardio.classList.add('offline');
      motion.classList.add('offline');
      document.getElementById('dot-brace').classList.add('err');
      document.getElementById('brace-txt').textContent = T.bracelet_offline;
      hbIcon.classList.remove('beating');
    }
    // Apnea
    const a = document.getElementById('apnea');
    if(d.resp.apnea){
      a.classList.add('on');
      document.getElementById('apnea-detail').textContent = T.apnea_detail(d.resp.since_last_breath_s);
    } else a.classList.remove('on');
  }catch(e){
    if(lastConn!=='err'){setDot('dot-conn','err');lastConn='err';}
    document.getElementById('conn-txt').textContent = T.offline;
  }
}
tick(); setInterval(tick, 1000);

// -------- AI analysis engine (rule-based fusion, presented as AI summary) --------
const SEV = {calm:0, watch:1, alert:2};
function worst(a,b){ return SEV[b] > SEV[a] ? b : a; }
let latestData = null;
let lastAiTs = 0;

function analyze(d){
  const obs = [], recs = [];
  let sev = 'calm';
  const b = d.bracelet || {linked:false};

  // ---- Cardiac ----
  if (b.linked && b.hr_bpm > 0) {
    const hr = b.hr_bpm;
    if (hr < 90)        { obs.push(T.ai_hr_low(hr));        sev = worst(sev,'alert'); recs.push(T.rec_check_baby); }
    else if (hr > 180)  { obs.push(T.ai_hr_high(hr));       sev = worst(sev,'alert'); }
    else if (hr < 100 || hr > 160) { obs.push(T.ai_hr_borderline(hr)); sev = worst(sev,'watch'); }
    else                { obs.push(T.ai_hr_normal(hr)); }

    if (b.spo2_valid) {
      const s = b.spo2_pct;
      if (s < 92)      { obs.push(T.ai_spo2_low(s));        sev = worst(sev,'alert'); recs.push(T.rec_check_breathing); }
      else if (s < 95) { obs.push(T.ai_spo2_borderline(s)); sev = worst(sev,'watch'); }
      else             { obs.push(T.ai_spo2_normal(s)); }
    }
    if (b.rmssd_ms > 5) {
      const v = Math.round(b.rmssd_ms);
      if (b.rmssd_ms > 30) obs.push(T.ai_hrv_good(v));
      else                 obs.push(T.ai_hrv_low(v));
    }
  }

  // ---- Respiratory ----
  if (d.resp.apnea) {
    obs.push(T.ai_apnea(d.resp.since_last_breath_s));
    sev = 'alert';
    recs.push(T.rec_check_breathing);
  } else {
    const br = d.resp.breaths_per_min;
    if (br > 0) {
      if (br < 20)                obs.push(T.ai_resp_low(br))  || (sev = worst(sev,'watch'));
      else if (br > 70)           obs.push(T.ai_resp_high(br)) || (sev = worst(sev,'watch'));
      else if (br >= 30 && br<=60) obs.push(T.ai_resp_normal(br));
    }
  }

  // ---- Environment ----
  const t = d.env.temp_c;
  if      (t > 24) { obs.push(T.ai_temp_high(t.toFixed(1))); sev = worst(sev,'watch'); recs.push(T.rec_lower_temp); }
  else if (t < 18) { obs.push(T.ai_temp_low(t.toFixed(1)));  sev = worst(sev,'watch'); }
  else             { obs.push(T.ai_temp_ok(t.toFixed(1))); }

  const co2 = d.env.eco2_ppm;
  if      (co2 > 1500) { obs.push(T.ai_co2_high(co2)); sev = worst(sev,'watch'); recs.push(T.rec_ventilate); }
  else if (co2 > 400)  { obs.push(T.ai_co2_ok(co2)); }

  // ---- NNS ----
  const sucks = d.nns.sucks_per_min;
  if (sucks > 0) {
    const cv = d.nns.regularity_cv;
    if (cv > 0.5)              { obs.push(T.ai_nns_disorganized(sucks, cv.toFixed(2))); sev = worst(sev,'watch'); }
    else if (cv > 0 && cv<0.3) { obs.push(T.ai_nns_organized(sucks, cv.toFixed(2))); }
    else                       { obs.push(T.ai_nns_active(sucks)); }
  } else {
    obs.push(T.ai_nns_quiet);
  }

  // ---- Motion / stillness ----
  if (b.linked) {
    if (b.stillness_alert)              { obs.push(T.ai_stillness(b.still_for_s)); sev = worst(sev,'watch'); recs.push(T.rec_check_baby); }
    else if (b.motion_events_min > 20)  { obs.push(T.ai_high_activity(b.motion_events_min)); }
    else if (b.motion_events_min > 0)   { obs.push(T.ai_calm_activity); }
  } else {
    obs.push(T.ai_partial);
  }

  return { severity: sev, observations: obs, recommendations: recs };
}

function renderAnalysis(){
  if (!latestData) return;
  const r = analyze(latestData);
  const card  = document.getElementById('ai-card');
  const badge = document.getElementById('ai-badge');
  const obsEl = document.getElementById('ai-observations');
  const recBl = document.getElementById('ai-recs-block');
  const recEl = document.getElementById('ai-recommendations');

  card.classList.remove('severity-watch','severity-alert');
  if (r.severity === 'watch') card.classList.add('severity-watch');
  if (r.severity === 'alert') card.classList.add('severity-alert');

  badge.className = 'ai-badge' + (r.severity === 'watch' ? ' watch' : r.severity === 'alert' ? ' alert' : '');
  badge.textContent = r.severity === 'calm' ? T.ai_calm : r.severity === 'watch' ? T.ai_watch : T.ai_alert;

  obsEl.innerHTML = '';
  r.observations.forEach(txt => { const li = document.createElement('li'); li.textContent = txt; obsEl.appendChild(li); });

  if (r.recommendations.length) {
    recBl.style.display = 'block';
    recEl.innerHTML = '';
    r.recommendations.forEach(txt => { const li = document.createElement('li'); li.textContent = txt; recEl.appendChild(li); });
  } else {
    recBl.style.display = 'none';
  }
  lastAiTs = Date.now();
}

// Re-run analysis every 3 s (feels considered, not twitchy). latestData is
// refreshed by every tick() above.
setInterval(renderAnalysis, 3000);
setInterval(() => {
  if (lastAiTs > 0) document.getElementById('ai-timer').textContent = '· ' + T.ai_updated(Math.floor((Date.now()-lastAiTs)/1000));
}, 1000);
setTimeout(renderAnalysis, 1500);   // first render shortly after first fetch
</script>
</body>
</html>
)HTML";
