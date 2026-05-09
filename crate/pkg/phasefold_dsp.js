/**
 * Deterministic PRNG matching the TypeScript SeededRNG class exactly.
 *
 * Uses Mulberry32 for uniform generation and Box-Muller for gaussian.
 * All intermediate math uses the same types as JS to ensure bit-identical
 * output:
 *   - `next()`: u32 wrapping arithmetic → f64 division (matches JS >>> 0 / 4294967296)
 *   - `normal()`: f64 throughout (matches JS Math.sqrt/log/cos which are f64)
 *   - Array outputs truncate to f32 at the boundary (matches Float32Array storage)
 */
export class SeededRNG {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SeededRNGFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_seededrng_free(ptr, 0);
    }
    /**
     * Create a new PRNG with the given seed.
     * The `| 0` in TS converts to i32; we store as u32 for wrapping ops.
     * @param {number} seed
     */
    constructor(seed) {
        const ret = wasm.seededrng_new(seed);
        this.__wbg_ptr = ret;
        SeededRNGFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Uniform in [0, 1) — Mulberry32.
     * Returns f64 to match JS number precision.
     * @returns {number}
     */
    next() {
        const ret = wasm.seededrng_next(this.__wbg_ptr);
        return ret;
    }
    /**
     * Gaussian via Box-Muller — uses f64 throughout to match JS Math.
     * @param {number} mu
     * @param {number} sigma
     * @returns {number}
     */
    normal(mu, sigma) {
        const ret = wasm.seededrng_normal(this.__wbg_ptr, mu, sigma);
        return ret;
    }
    /**
     * Generate n gaussian samples as Float32Array.
     * f64 → f32 truncation happens here, matching TS Float32Array storage.
     * @param {number} mu
     * @param {number} sigma
     * @param {number} n
     * @returns {Float32Array}
     */
    normal_array(mu, sigma, n) {
        const ret = wasm.seededrng_normal_array(this.__wbg_ptr, mu, sigma, n);
        var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * Generate n uniform samples in [lo, hi) as Float32Array.
     * @param {number} lo
     * @param {number} hi
     * @param {number} n
     * @returns {Float32Array}
     */
    uniform_array(lo, hi, n) {
        const ret = wasm.seededrng_uniform_array(this.__wbg_ptr, lo, hi, n);
        var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
}
if (Symbol.dispose) SeededRNG.prototype[Symbol.dispose] = SeededRNG.prototype.free;

/**
 * Base tone generation + Chebyshev harmonic enrichment (generator sections 14+15).
 *
 * Takes the layer-weighted mix and applies:
 *   1. Phase-accumulated base tone with amplitude/breath modulation
 *   2. Voice emergence crossfade
 *   3. Soft clipping (tanh)
 *   4. Even (T2) and odd (T3) Chebyshev harmonics with convergence envelope
 *
 * Returns the processed mix as a new Float32Array.
 * @param {Float32Array} mix
 * @param {number} base_f0
 * @param {number} sample_rate
 * @param {Float32Array} amp_env
 * @param {Float32Array} breath
 * @param {Float32Array} voice_emerge_env
 * @param {Float32Array} conv_gain
 * @param {Float32Array} base_effects_env
 * @param {number} overtone_power
 * @param {number} harmonic_even
 * @param {number} harmonic_odd
 * @returns {Float32Array}
 */
export function apply_base_tone_and_harmonics(mix, base_f0, sample_rate, amp_env, breath, voice_emerge_env, conv_gain, base_effects_env, overtone_power, harmonic_even, harmonic_odd) {
    const ptr0 = passArrayF32ToWasm0(mix, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF32ToWasm0(amp_env, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF32ToWasm0(breath, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArrayF32ToWasm0(voice_emerge_env, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passArrayF32ToWasm0(conv_gain, wasm.__wbindgen_malloc);
    const len4 = WASM_VECTOR_LEN;
    const ptr5 = passArrayF32ToWasm0(base_effects_env, wasm.__wbindgen_malloc);
    const len5 = WASM_VECTOR_LEN;
    const ret = wasm.apply_base_tone_and_harmonics(ptr0, len0, base_f0, sample_rate, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5, overtone_power, harmonic_even, harmonic_odd);
    var v7 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v7;
}

/**
 * Exposed to JS: applyPhi(v0, v1, lam, thetaStep, eps) → [r0, r1]
 *
 * Core recursive transformation Phi. Combines projection (lambda),
 * tilt (eps), and rotation (thetaStep).
 * @param {number} v0
 * @param {number} v1
 * @param {number} lam
 * @param {number} theta_step
 * @param {number} eps_param
 * @returns {Float64Array}
 */
export function apply_phi(v0, v1, lam, theta_step, eps_param) {
    const ret = wasm.apply_phi(v0, v1, lam, theta_step, eps_param);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * Stereo + binaural rendering (generator section 16).
 *
 * Generates binaural oscillators (phase-accumulated in f64 for drift
 * prevention), applies stereo delay, breath-panning, and stereo width
 * LFO. Returns interleaved [L0, R0, L1, R1, ...] for efficient
 * transfer across the Wasm boundary (2 * N elements).
 * @param {Float32Array} mix
 * @param {Float32Array} conv_gain
 * @param {Float32Array} base_effects_env
 * @param {Float32Array} breath
 * @param {Float32Array} stereo_width_lfo
 * @param {Float32Array} sample_times
 * @param {number} base_f0
 * @param {number} sample_rate
 * @param {number} binaural_delta_hz0
 * @param {number} binaural_amount
 * @param {number} breath_rate
 * @returns {Float32Array}
 */
export function apply_stereo_binaural(mix, conv_gain, base_effects_env, breath, stereo_width_lfo, sample_times, base_f0, sample_rate, binaural_delta_hz0, binaural_amount, breath_rate) {
    const ptr0 = passArrayF32ToWasm0(mix, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF32ToWasm0(conv_gain, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF32ToWasm0(base_effects_env, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArrayF32ToWasm0(breath, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passArrayF32ToWasm0(stereo_width_lfo, wasm.__wbindgen_malloc);
    const len4 = WASM_VECTOR_LEN;
    const ptr5 = passArrayF32ToWasm0(sample_times, wasm.__wbindgen_malloc);
    const len5 = WASM_VECTOR_LEN;
    const ret = wasm.apply_stereo_binaural(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5, base_f0, sample_rate, binaural_delta_hz0, binaural_amount, breath_rate);
    var v7 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v7;
}

/**
 * Post-processing pipeline (generator sections 17-21).
 *
 * Applies fade-in, pure-tone volume envelope, collapse detection,
 * trimming, equal-power fade-out, and headroom normalisation.
 * Returns interleaved [L0, R0, L1, R1, ...] of the final output
 * (may be shorter than input due to collapse trimming).
 *
 * `activity_ctrl_smooth` and `ctrl_progress` are control-rate arrays
 * (Nc elements) used for collapse detection.
 * @param {Float32Array} left
 * @param {Float32Array} right
 * @param {Float32Array} pure_tone_vol_env
 * @param {Float32Array} activity_ctrl_smooth
 * @param {Float32Array} ctrl_progress
 * @param {number} sample_rate
 * @param {number} control_hz
 * @returns {Float32Array}
 */
export function finalize_stereo(left, right, pure_tone_vol_env, activity_ctrl_smooth, ctrl_progress, sample_rate, control_hz) {
    const ptr0 = passArrayF32ToWasm0(left, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF32ToWasm0(right, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF32ToWasm0(pure_tone_vol_env, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArrayF32ToWasm0(activity_ctrl_smooth, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passArrayF32ToWasm0(ctrl_progress, wasm.__wbindgen_malloc);
    const len4 = WASM_VECTOR_LEN;
    const ret = wasm.finalize_stereo(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, sample_rate, control_hz);
    var v6 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v6;
}

/**
 * 1-D linear interpolation — equivalent to np.interp(x, xp, fp).
 * Assumes `xp` is monotonically increasing.
 * Mirrors the TypeScript `interp` in dsp.ts.
 * @param {Float32Array} x
 * @param {Float32Array} xp
 * @param {Float32Array} fp
 * @returns {Float32Array}
 */
export function interp(x, xp, fp) {
    const ptr0 = passArrayF32ToWasm0(x, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF32ToWasm0(xp, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF32ToWasm0(fp, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.interp(ptr0, len0, ptr1, len1, ptr2, len2);
    var v4 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v4;
}

/**
 * Generate `n` evenly spaced values from `start` to `end` (inclusive).
 * Mirrors the TypeScript `linspace` in dsp.ts.
 * @param {number} start
 * @param {number} end
 * @param {number} n
 * @returns {Float32Array}
 */
export function linspace(start, end, n) {
    const ret = wasm.linspace(start, end, n);
    var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v1;
}

/**
 * Collapse-aware layer weighting (generator section 13).
 *
 * Takes all layer sums concatenated into a single flat buffer
 * (`layers * N` elements, layer-major order) plus the activity
 * envelope, and returns the weighted mix (N samples).
 *
 * Weight for layer ell = activityEnv[i]^(ell+1), so higher layers
 * fade out faster as activity drops toward convergence.
 * @param {Float32Array} layer_sums_flat
 * @param {Float32Array} activity_env
 * @param {number} layers
 * @returns {Float32Array}
 */
export function mix_layers(layer_sums_flat, activity_env, layers) {
    const ptr0 = passArrayF32ToWasm0(layer_sums_flat, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF32ToWasm0(activity_env, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.mix_layers(ptr0, len0, ptr1, len1, layers);
    var v3 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v3;
}

/**
 * y[n] = y[n-1] + alpha * (x[n] - y[n-1])
 * where alpha = 1 - exp(-2 pi fc / sr)
 *
 * Mirrors the TypeScript `smoothEnvelope` in dsp.ts exactly.
 * Takes ownership of the input and returns a new Vec<f32> as a
 * JS-visible Float32Array.
 * @param {Float32Array} input
 * @param {number} cutoff_hz
 * @param {number} sample_rate
 * @param {number} state
 * @returns {Float32Array}
 */
export function smooth_envelope(input, cutoff_hz, sample_rate, state) {
    const ptr0 = passArrayF32ToWasm0(input, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.smooth_envelope(ptr0, len0, cutoff_hz, sample_rate, state);
    var v2 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v2;
}

/**
 * Exposed to JS: stabilizeState([v0, v1]) → [s0, s1]
 * Returns a 2-element Vec<f64> (wasm-bindgen maps to Float64Array).
 * @param {number} v0
 * @param {number} v1
 * @returns {Float64Array}
 */
export function stabilize_state(v0, v1) {
    const ret = wasm.stabilize_state(v0, v1);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * Synthesise a single layer of the Phasefold engine.
 *
 * This is the hottest loop in the generator: for each voice, for each
 * sample, it computes FM phase modulation, time-varying detune, AM
 * envelope, and accumulates sin(phase) * amplitude.
 *
 * Phase accumulators use f64 internally to avoid audible drift over
 * long tracks, matching the TypeScript generator exactly.
 *
 * Returns the averaged voice sum as a Float32Array of N samples.
 * @param {Float32Array} conv_gain
 * @param {Float32Array} ctrl_l
 * @param {Float32Array} base_f
 * @param {Float32Array} drift_phase
 * @param {Float32Array} cents
 * @param {Float32Array} phase0
 * @param {number} layer_detune
 * @param {number} fm_scale
 * @param {number} am_scale
 * @param {number} sample_rate
 * @returns {Float32Array}
 */
export function synthesize_layer(conv_gain, ctrl_l, base_f, drift_phase, cents, phase0, layer_detune, fm_scale, am_scale, sample_rate) {
    const ptr0 = passArrayF32ToWasm0(conv_gain, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF32ToWasm0(ctrl_l, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF32ToWasm0(base_f, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArrayF32ToWasm0(drift_phase, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passArrayF32ToWasm0(cents, wasm.__wbindgen_malloc);
    const len4 = WASM_VECTOR_LEN;
    const ptr5 = passArrayF32ToWasm0(phase0, wasm.__wbindgen_malloc);
    const len5 = WASM_VECTOR_LEN;
    const ret = wasm.synthesize_layer(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5, layer_detune, fm_scale, am_scale, sample_rate);
    var v7 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v7;
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_throw_9c31b086c2b26051: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./phasefold_dsp_bg.js": import0,
    };
}

const SeededRNGFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_seededrng_free(ptr, 1));

function getArrayF32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayF64FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat64ArrayMemory0().subarray(ptr / 8, ptr / 8 + len);
}

let cachedFloat32ArrayMemory0 = null;
function getFloat32ArrayMemory0() {
    if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
        cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
    }
    return cachedFloat32ArrayMemory0;
}

let cachedFloat64ArrayMemory0 = null;
function getFloat64ArrayMemory0() {
    if (cachedFloat64ArrayMemory0 === null || cachedFloat64ArrayMemory0.byteLength === 0) {
        cachedFloat64ArrayMemory0 = new Float64Array(wasm.memory.buffer);
    }
    return cachedFloat64ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function passArrayF32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getFloat32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedFloat32ArrayMemory0 = null;
    cachedFloat64ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('phasefold_dsp_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
