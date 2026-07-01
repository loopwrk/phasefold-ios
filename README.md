# Soneuro

Soneuro (working title, part of the PhaseFold family of apps) is a generative therapeutic audio synthesiser optimised to sit amongst apps like Calm, Headspace and Insight Timer. Informed by the iso-principle from music therapy, and inspired natural physical phenomena such as wave dynamics, Soneuro creates unique, evolving soundscapesin real time using pure mathematical synthesis including oscillating binaural beats - no samples, no loops, no AI. Each session guides the listener from stimulation through relaxation to deep rest via a unified convergence architecture.

The interface guides the user to the an appropriate preset which is suitable for their needs, whilst allowing for optional full customisation.

Currently optimised as a mobile-first web app, wrapped in Capacitor for later deployment as an iOS app. The synthesis engine is optimised for mobile hardware: a full session generates in a few seconds on-device.

![Vue](https://img.shields.io/badge/Vue-3.x-4FC08D?logo=vue.js) ![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript) ![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite) ![Capacitor](https://img.shields.io/badge/Capacitor-iOS-119EFF?logo=capacitor) ![Web Audio API](https://img.shields.io/badge/Web_Audio_API-44.1kHz-FF6600)

## Getting started

### Prerequisites

- Node.js 18+
- npm 9+

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Component stories (Histoire)

```bash
npm run story:dev
```

## Tech stack

- Vue 3 + TypeScript + Vite
- Capacitor (iOS native shell)
- vue-i18n v11
- vue-router 4
- Histoire (component stories)
- Web Workers (off-thread audio generation)
- Web Audio API (playback)

## How the engine works

The engine runs in a Web Worker at 44.1 kHz. A two-rate architecture separates control-rate state evolution (60 Hz) from audio-rate sample rendering: slow envelopes (convergence, activity, breath) are computed as small control-rate tables, then a single fused block loop interpolates them per sample and synthesises all voices and layers directly into the output buffers. Oscillators use table lookup rather than per-sample transcendental calls, and no intermediate track-length buffers are allocated, which is what lets complex harmonic structures generate in seconds on mobile hardware.

Every session follows a convergence arc derived from the iso principle: sound begins with harmonic complexity (multiple detuned tonal layers, active modulation, spatial movement) and gradually resolves toward stillness. This arc is computed into every parameter simultaneously - detuning collapses, harmonics simplify, spatial movement settles - so the transition feels organic.

Two entrainment mechanisms work in parallel: binaural beating (frequency-following response) and breath-rate entrainment (spatial modulation). Both are phase-locked to the same oscillator.

Sessions are deterministic: the same engine version, preset and seed always produce identical audio (see ENGINE_VERSION in src/engine/types.ts).

A dev-only benchmark harness lives at the unlinked /bench route for timing the engine on new devices.

## TODO

- Add more details to listed presets on the preset pages such as duration and frequency range
- Refactor and update UI of 'custom' page
- Consider extending 'collapse tone' upon convergence and/or longer fade-out
- Port the DSP engine to Rust for the native iOS build (dart:ffi from Flutter, same crate compiled to WASM for web)
- Rewrite the frontend in Flutter for Native iOS
- Optimise colours for accessibility

## License

Copyright (c) 2026 PhaseFold. All rights reserved.
