'use client';

import React from 'react';
import {
  Activity,
  Target,
  Lock,
  Radio,
  ShieldAlert,
  ChartNoAxesColumnIncreasing,
} from 'lucide-react';
import Link from 'next/link';

export default function TacticalDemoPage() {
  return (
    <div className="min-h-screen bg-surface-100 text-gray-100">
      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-brand-500/40 bg-brand-600/20">
              <Target className="h-5 w-5 text-brand-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-wider">TACTICAL COMMAND</h1>
              <p className="text-xs text-gray-400">v2.1.7 · CLASSIFIED</p>
            </div>
          </div>
          <Link
            href="/prompt-generator"
            className="rounded-md border border-brand-500/40 px-3 py-2 text-brand-300 transition hover:bg-brand-500/10"
          >
            Back to Builder
          </Link>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left: Allocation */}
          <section className="rounded-xl border border-white/5 bg-surface-200/60 p-6 shadow-card lg:col-span-2">
            <h2 className="mb-4 text-sm tracking-widest text-gray-300">AGENT ALLOCATION</h2>
            <div className="mb-6 grid grid-cols-3 gap-6">
              {[
                { label: 'Active', value: 190 },
                { label: 'Undercover', value: 990 },
                { label: 'Training', value: 290 },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg border border-white/5 bg-surface-300/40 p-4">
                  <div className="text-3xl font-bold text-brand-400">{value}</div>
                  <div className="mt-1 text-xs tracking-wider text-gray-400">{label}</div>
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
          <section className="rounded-xl border border-white/5 bg-surface-200/60 p-6 shadow-card">
            <h2 className="mb-4 text-sm tracking-widest text-gray-300">ENCRYPTED CHAT ACTIVITY</h2>
            <div className="mb-4 aspect-square rounded-full border border-white/10 bg-surface-300/40"></div>
            <div className="space-y-2 text-xs text-gray-400">
              <p># 2025-06-17 14:23 UTC</p>
              <p>&gt; [AGT:gh0stfire] :: INIT &gt;&gt; CH#2 | 1231.9082464.500...xR3</p>
              <p>&gt; KEY LOCKED</p>
              <p>&gt; MSG &gt;&gt; mission override initiated... awaiting delta node clearance</p>
            </div>
          </section>

          {/* Activity Log */}
          <section className="rounded-xl border border-white/5 bg-surface-200/60 p-6 shadow-card lg:col-span-2">
            <h2 className="mb-4 text-sm tracking-widest text-gray-300">ACTIVITY LOG</h2>
            <div className="max-h-64 space-y-3 overflow-auto pr-2">
              {[
                'Agent gh0st_fire completed mission in Berlin',
                'Agent dr4g0n_v3in extracted high-value target in Cairo',
                'Agent sn4ke_sh4de lost comms in Havana',
                'Agent ph4nt0m_r4ven initiated surveillance in Tokyo',
              ].map((line, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 rounded-md border border-white/5 bg-surface-300/30 px-4 py-3"
                >
                  <Activity className="mt-0.5 h-4 w-4 text-brand-300" />
                  <p className="text-sm text-gray-300">{line}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Mission Info */}
          <section className="rounded-xl border border-white/5 bg-surface-200/60 p-6 shadow-card">
            <h2 className="mb-4 text-sm tracking-widest text-gray-300">MISSION INFORMATION</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Successful Missions</span>
                <span className="text-brand-300">190</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Medium Risk</span>
                <span className="text-gray-300">426</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Low Risk</span>
                <span className="text-gray-300">920</span>
              </div>
              <div className="pt-3 text-xs text-gray-400">Failed Missions</div>
              <div className="flex h-24 items-center justify-center rounded-md border border-white/5 bg-surface-300/40 text-gray-500">
                <ChartNoAxesColumnIncreasing className="mr-2 h-5 w-5 text-brand-400" />
                <span>Chart Placeholder</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
