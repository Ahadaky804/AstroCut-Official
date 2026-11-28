#!/usr/bin/env python3
"""
AstroCut Phase 7 — Local Whisper Transcription Runner
Supports faster-whisper (primary) and openai-whisper (fallback) on CPU,
with explicit runtime CUDA compatibility checks and automatic CPU fallback
so older GPUs like NVIDIA Quadro P2000 never crash transcription.
"""

import argparse
import json
import os
import sys


def emit_stage(stage: str, detail: str = "") -> None:
    payload = {"stage": stage}
    if detail:
        payload["detail"] = detail
    print(json.dumps(payload), file=sys.stderr, flush=True)


def can_use_cuda() -> tuple[bool, str]:
    try:
        import torch

        if not torch.cuda.is_available():
            return False, "CUDA runtime is unavailable; using CPU."
        major, minor = torch.cuda.get_device_capability(0)
        name = torch.cuda.get_device_name(0)
        # Pascal (Quadro P2000 = SM 6.1) often lacks compatible prebuilt kernels or cuDNN libs on modern wheels.
        if major < 7:
            return (
                False,
                f"{name} uses compute capability {major}.{minor} (< 7.0); using safe CPU fallback.",
            )
        probe = torch.zeros(1, device="cuda")
        del probe
        return True, f"CUDA verified on {name} (SM {major}.{minor})"
    except Exception as exc:
        return False, f"CUDA check failed ({exc}); using CPU fallback."


def run_faster_whisper(
    audio_path: str, model_size: str, language: str, cache_dir: str, device_pref: str
) -> dict:
    from faster_whisper import WhisperModel

    os.makedirs(cache_dir, exist_ok=True)
    fallback_note = ""

    if device_pref == "cpu":
        device = "cpu"
        compute_type = "int8"
    else:
        cuda_ok, cuda_msg = can_use_cuda()
        if cuda_ok:
            device = "cuda"
            compute_type = "float16"
        else:
            device = "cpu"
            compute_type = "int8"
            fallback_note = cuda_msg

    emit_stage("loading_model", f"Loading {model_size} model ({device})...")
    try:
        model = WhisperModel(
            model_size,
            device=device,
            compute_type=compute_type,
            download_root=cache_dir,
        )
    except Exception as exc:
        if device == "cuda":
            fallback_note = f"CUDA model load failed ({exc}); fell back to CPU."
            emit_stage("loading_model", f"Retrying {model_size} on CPU...")
            device = "cpu"
            compute_type = "int8"
            model = WhisperModel(
                model_size,
                device=device,
                compute_type=compute_type,
                download_root=cache_dir,
            )
        else:
            raise

    emit_stage("transcribing", f"Transcribing with faster-whisper ({model_size}, {device})...")
    lang_arg = None if language == "auto" else language
    segments_iter, info = model.transcribe(
        audio_path,
        language=lang_arg,
        vad_filter=True,
    )

    segments = []
    for idx, seg in enumerate(segments_iter):
        text = (seg.text or "").strip()
        if not text:
            continue
        segments.append(
            {
                "id": f"seg-{idx + 1}",
                "startSeconds": round(float(seg.start), 3),
                "endSeconds": round(float(seg.end), 3),
                "text": text,
            }
        )

    detected_lang = getattr(info, "language", None) or (
        language if language != "auto" else "unknown"
    )
    return {
        "languageCode": detected_lang,
        "detectedLanguage": detected_lang,
        "modelSize": model_size,
        "engineName": "faster-whisper",
        "deviceUsed": f"{device} ({compute_type})",
        "fallbackNote": fallback_note or None,
        "segments": segments,
        "originalText": "\n".join(s["text"] for s in segments),
    }


def run_openai_whisper(
    audio_path: str, model_size: str, language: str, cache_dir: str, device_pref: str
) -> dict:
    import whisper

    os.makedirs(cache_dir, exist_ok=True)
    fallback_note = ""

    if device_pref == "cpu":
        device = "cpu"
    else:
        cuda_ok, cuda_msg = can_use_cuda()
        if cuda_ok:
            device = "cuda"
        else:
            device = "cpu"
            fallback_note = cuda_msg

    emit_stage("loading_model", f"Loading {model_size} model ({device})...")
    model = whisper.load_model(model_size, device=device, download_root=cache_dir)

    emit_stage("transcribing", f"Transcribing with openai-whisper ({model_size}, {device})...")
    lang_arg = None if language == "auto" else language
    result = model.transcribe(
        audio_path,
        language=lang_arg,
        fp16=(device == "cuda"),
    )

    segments = []
    for idx, seg in enumerate(result.get("segments", []) or []):
        text = str(seg.get("text", "")).strip()
        if not text:
            continue
        segments.append(
            {
                "id": f"seg-{idx + 1}",
                "startSeconds": round(float(seg.get("start", 0.0)), 3),
                "endSeconds": round(float(seg.get("end", 0.0)), 3),
                "text": text,
            }
        )

    detected_lang = str(
        result.get("language") or (language if language != "auto" else "unknown")
    )
    return {
        "languageCode": detected_lang,
        "detectedLanguage": detected_lang,
        "modelSize": model_size,
        "engineName": "openai-whisper",
        "deviceUsed": device,
        "fallbackNote": fallback_note or None,
        "segments": segments,
        "originalText": "\n".join(s["text"] for s in segments),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="AstroCut local Whisper runner")
    parser.add_argument("--audio", required=True)
    parser.add_argument(
        "--model", default="base", choices=["tiny", "base", "small", "medium"]
    )
    parser.add_argument("--language", default="auto")
    parser.add_argument("--cache-dir", required=True)
    parser.add_argument("--device", default="auto", choices=["auto", "cpu", "cuda"])
    args = parser.parse_args()

    try:
        try:
            payload = run_faster_whisper(
                args.audio, args.model, args.language, args.cache_dir, args.device
            )
        except ImportError:
            payload = run_openai_whisper(
                args.audio, args.model, args.language, args.cache_dir, args.device
            )
    except Exception as exc:
        print(f"Whisper transcription error: {exc}", file=sys.stderr, flush=True)
        return 1

    print(json.dumps(payload, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
