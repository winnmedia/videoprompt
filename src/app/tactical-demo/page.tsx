'use client';

import React, { useState } from 'react';
import {
  Activity,
  Target,
  Lock,
  Radio,
  ShieldAlert,
  ChartNoAxesColumnIncreasing,
} from 'lucide-react';
import Link from 'next/link';

const TONE_PRESETS: Record<string, { bg: string; text: string; card: string; accent: string }> = {
  serious: { bg: 'bg-gray-50', text: 'text-gray-900', card: 'bg-white', accent: 'text-blue-700' },
  light: { bg: 'bg-white', text: 'text-gray-800', card: 'bg-white', accent: 'text-teal-700' },
  inspirational: { bg: 'bg-gradient-to-br from-amber-50 to-white', text: 'text-gray-900', card: 'bg-white', accent: 'text-amber-700' },
  professional: { bg: 'bg-slate-50', text: 'text-slate-900', card: 'bg-white', accent: 'text-indigo-700' },
};

export default function TacticalDemoPage() {
  const [tone, setTone] = useState<keyof typeof TONE_PRESETS>('professional');
  const toneClass = TONE_PRESETS[tone];
  return (
    <div className={`min-h-screen ${toneClass.bg} ${toneClass.text}`}>
      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-blue-200 bg-blue-50">
              <Target className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-wider">TACTICAL COMMAND</h1>
              <p className="text-xs opacity-70">v2.1.7 · CLASSIFIED</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm">톤앤매너</label>
            <select
              className="rounded-md border px-2 py-1"
              value={tone}
              onChange={(e) => setTone(e.target.value as any)}
              aria-label="톤앤매너 선택"
            >
              {Object.keys(TONE_PRESETS).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <Link
              href="/prompt-generator"
              className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-blue-700 transition hover:bg-blue-100"
            >
              Back to Builder
            </Link>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left: Allocation */}
          <section className={`rounded-xl border border-gray-200 ${toneClass.card} p-6 shadow-sm lg:col-span-2`}>
            <h2 className="mb-4 text-sm tracking-widest text-gray-300">AGENT ALLOCATION</h2>
            <div className="mb-6 grid grid-cols-3 gap-6">
              {[
                { label: 'Active', value: 190 },
                { label: 'Undercover', value: 990 },
                { label: 'Training', value: 290 },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                  <div className={`text-3xl font-bold ${toneClass.accent}`}>{value}</div>
                  <div className="mt-1 text-xs tracking-wider opacity-70">{label}</div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              {[
                { code: 'G-078W', name: 'VENGEFUL SPIRIT' },
                { code: 'G-079X', name: 'OBSIDIAN SENTINEL' },
                { code: 'G-080Y', name: 'GHOSTLY FURY' },
                { code: 'G-081Z', name: 'CURSED REVENANT' },
              ].map(({ code, name }) => (
                <div
                  key={code}
                  className="flex items-center justify-between rounded-md border border-white/5 bg-surface-300/30 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-brand-400"></span>
                    <span className="text-sm font-medium">{code}</span>
                  </div>
                  <span className="text-xs text-gray-400">{name}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Right: Encrypted */}
          <section className={`rounded-xl border border-gray-200 ${toneClass.card} p-6 shadow-sm`}>
            <h2 className="mb-4 text-sm tracking-widest text-gray-300">ENCRYPTED CHAT ACTIVITY</h2>
            <div className="mb-4 aspect-square rounded-full border border-gray-200 bg-gray-50"></div>
            <div className="space-y-2 text-xs opacity-70">
              <p># 2025-06-17 14:23 UTC</p>
              <p>&gt; [AGT:gh0stfire] :: INIT &gt;&gt; CH#2 | 1231.9082464.500...xR3</p>
              <p>&gt; KEY LOCKED</p>
              <p>&gt; MSG &gt;&gt; mission override initiated... awaiting delta node clearance</p>
            </div>
          </section>

          {/* Activity Log */}
          <section className={`rounded-xl border border-gray-200 ${toneClass.card} p-6 shadow-sm lg:col-span-2`}>
            <h2 className="mb-4 text-sm tracking-widest text-gray-300">ACTIVITY LOG</h2>
            <div className="max-h-64 space-y-3 overflow-auto pr-2">
              {[
                'Agent gh0st_fire completed mission in Berlin',
                'Agent dr4g0n_v3in extracted high-value target in Cairo',
                'Agent sn4ke_sh4de lost comms in Havana',
                'Agent ph4nt0m_r4ven initiated surveillance in Tokyo',
              ].map((line, idx) => (
                <div key={idx} className="flex items-start gap-3 rounded-md border border-gray-100 bg-gray-50 px-4 py-3">
                  <Activity className={`mt-0.5 h-4 w-4 ${toneClass.accent}`} />
                  <p className="text-sm opacity-80">{line}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Mission Info */}
          <section className={`rounded-xl border border-gray-200 ${toneClass.card} p-6 shadow-sm`}>
            <h2 className="mb-4 text-sm tracking-widest text-gray-300">MISSION INFORMATION</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="opacity-70">Successful Missions</span>
                <span className={toneClass.accent}>190</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="opacity-70">Medium Risk</span>
                <span className="opacity-80">426</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="opacity-70">Low Risk</span>
                <span className="opacity-80">920</span>
              </div>
              <div className="pt-3 text-xs opacity-70">Failed Missions</div>
              <div className="flex h-24 items-center justify-center rounded-md border border-gray-100 bg-gray-50 text-gray-500">
                <ChartNoAxesColumnIncreasing className={`mr-2 h-5 w-5 ${toneClass.accent}`} />
                <span>Chart Placeholder</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
