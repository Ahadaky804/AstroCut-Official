import { Terminal } from 'lucide-react'
import { Button, Modal } from '../ui'

interface OllamaSetupModalProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * Step-by-step Windows setup guide for running Ollama locally with AstroCut.
 */
export function OllamaSetupModal({ isOpen, onClose }: OllamaSetupModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Local Ollama Setup Guide (Windows)"
      description="Run AI content generation 100% locally at zero ongoing cost."
      size="lg"
      footer={
        <Button variant="primary" onClick={onClose}>
          Got It
        </Button>
      }
    >
      <div className="space-y-4 text-xs leading-relaxed text-content-secondary">
        <div className="space-y-1.5 rounded-xl border border-edge-subtle bg-elevated p-3.5">
          <p className="font-semibold text-content-primary">
            1. Install Ollama for Windows
          </p>
          <p>
            Download the installer from ollama.com/download or install via
            Windows Package Manager:
          </p>
          <pre className="mt-1.5 overflow-x-auto rounded-lg border border-edge-subtle bg-input px-3 py-2 font-mono text-[11px] text-content-primary">
            winget install Ollama.Ollama
          </pre>
        </div>

        <div className="space-y-1.5 rounded-xl border border-edge-subtle bg-elevated p-3.5">
          <p className="font-semibold text-content-primary">
            2. Allow Browser Access (OLLAMA_ORIGINS)
          </p>
          <p>
            Because AstroCut runs in your browser at{' '}
            <code className="text-content-primary">http://localhost:5173</code>,
            enable CORS access for local origins in PowerShell, then quit and
            re-open Ollama:
          </p>
          <pre className="mt-1.5 overflow-x-auto rounded-lg border border-edge-subtle bg-input px-3 py-2 font-mono text-[11px] text-content-primary">
            setx OLLAMA_ORIGINS &quot;http://localhost:5173,http://127.0.0.1:5173&quot;
          </pre>
        </div>

        <div className="space-y-1.5 rounded-xl border border-edge-subtle bg-elevated p-3.5">
          <p className="font-semibold text-content-primary">
            3. Start Ollama &amp; Pull a Compatible Model
          </p>
          <p>
            For systems with 16 GB RAM and a 4–5 GB VRAM GPU (such as NVIDIA
            Quadro P2000) or CPU fallback, compact 2B–4B models stay responsive:
          </p>
          <pre className="mt-1.5 overflow-x-auto rounded-lg border border-edge-subtle bg-input px-3 py-2 font-mono text-[11px] text-content-primary">
            ollama pull llama3.2:3b
          </pre>
          <p className="text-[11px] text-content-muted">
            Other lightweight options: <code>qwen2.5:3b</code> or{' '}
            <code>gemma2:2b</code>. Speed depends on model size, GPU drivers,
            VRAM, and system RAM.
          </p>
        </div>

        <div className="flex items-start gap-2.5 rounded-xl border border-accent/25 bg-accent-soft p-3.5 text-content-primary">
          <Terminal className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          <p>
            Once Ollama is running on <code>http://localhost:11434</code>, click{' '}
            <strong>Test Connection</strong> and select any installed model.
            AstroCut never uploads your videos to any cloud API.
          </p>
        </div>
      </div>
    </Modal>
  )
}
