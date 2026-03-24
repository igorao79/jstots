"use client";

import { useState, useRef, useCallback, memo } from "react";
import dynamic from "next/dynamic";
import { Button } from "@igorao79/uivix";

const NoiseBackground = dynamic(
  () => import("@igorao79/uivix").then((m) => m.NoiseBackground),
  { ssr: false }
);
const ShimmerText = dynamic(
  () => import("@igorao79/uivix").then((m) => m.ShimmerText),
  { ssr: false }
);
const Watermark = dynamic(
  () => import("@igorao79/uivix").then((m) => m.Watermark),
  { ssr: false }
);
import {
  Upload,
  FileCode,
  ArrowRight,
  Download,
  Trash2,
  Loader2,
  CheckCircle,
  AlertCircle,
  Copy,
  Check,
  FolderOpen,
} from "lucide-react";

// Memoize NoiseBackground so it never re-renders on parent state changes
const StaticNoise = memo(function StaticNoise() {
  return (
    <NoiseBackground
      variant="electric"
      colors={["#3b82f6", "#1d4ed8", "#1e3a8a", "#172554"]}
      speed={0.5}
      scale={1.2}
      opacity={0.4}
    />
  );
});

interface FileItem {
  name: string;
  content: string;
}

interface ConvertedFile {
  name: string;
  content: string;
}

export default function Home() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [convertedFiles, setConvertedFiles] = useState<ConvertedFile[]>([]);
  const [projectMode, setProjectMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const readFile = (file: File): Promise<FileItem> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve({ name: file.name, content: reader.result as string });
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const handleFiles = useCallback(async (fileList: FileList) => {
    const jsFiles = Array.from(fileList).filter(
      (f) => f.name.endsWith(".js") || f.name.endsWith(".jsx")
    );
    if (jsFiles.length === 0) return;
    const items = await Promise.all(jsFiles.map(readFile));
    setFiles((prev) => [...prev, ...items]);
    setConvertedFiles([]);
    setError(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setConvertedFiles([]);
  };

  const convert = async () => {
    if (files.length === 0) return;
    setLoading(true);
    setError(null);
    setConvertedFiles([]);
    try {
      const res = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files, projectMode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Conversion failed");
      setConvertedFiles(data.results);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const downloadFile = (file: ConvertedFile) => {
    const blob = new Blob([file.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAll = () => {
    convertedFiles.forEach(downloadFile);
  };

  return (
    <>
      <Watermark
        position="bottom-right"
        text="Powered by UIVIX"
        size="md"
        className="!right-1/2 !translate-x-1/2"
      />
      <div className="fixed inset-0">
        <StaticNoise />
      </div>
      <div className="relative z-10 h-screen flex items-center justify-center px-4">
        <div className="bg-white/5 backdrop-blur-2xl border border-white/15 rounded-3xl p-8 shadow-[0_8px_64px_rgba(0,0,0,0.4)] w-full max-w-2xl">
          {/* Header */}
          <div className="text-center mb-6 fade-in">
            <h1 className="text-5xl font-bold mb-3">
              <span className="text-yellow-400 animate-pulse-slow drop-shadow-[0_0_8px_rgba(250,204,21,0.3)]">JS</span>
              <span className="text-white/50 mx-3">→</span>
              <span className="text-blue-400 animate-pulse-slow-delay drop-shadow-[0_0_8px_rgba(96,165,250,0.3)]">TS</span>
            </h1>
            <ShimmerText
              as="p"
              className="text-base"
              baseColor="rgba(163,163,163,0.4)"
              shimmerColor="rgba(255,255,255,0.6)"
            >
              AI-конвертер JavaScript в TypeScript на базе Llama 3.3 70B
            </ShimmerText>
          </div>

          {/* Upload Zone */}
          <div
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer mb-4 fade-in ${
              dragOver
                ? "border-blue-500 bg-blue-500/5"
                : "border-white/20 hover:border-white/40"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".js,.jsx"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
            <Upload className="w-8 h-8 text-white/40 mx-auto mb-3" />
            <p className="text-base font-medium mb-1">
              Перетащите .js / .jsx файлы сюда
            </p>
            <p className="text-white/40 text-sm">или нажмите для выбора</p>
          </div>

          {/* Files List */}
          {files.length > 0 && (
            <div className="mb-4 fade-in">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-blue-400" />
                  Файлы ({files.length})
                </h2>
                <button
                  onClick={() => {
                    setFiles([]);
                    setConvertedFiles([]);
                  }}
                  className="text-sm text-white/40 hover:text-red-400 transition-colors"
                >
                  Очистить все
                </button>
              </div>

              <div className="grid gap-2">
                {files.map((file, i) => (
                  <div
                    key={`${file.name}-${i}`}
                    className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <FileCode className="w-4 h-4 text-yellow-400" />
                      <span className="font-medium text-sm">{file.name}</span>
                      <span className="text-white/40 text-xs">
                        {(file.content.length / 1024).toFixed(1)} KB
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(i);
                      }}
                      className="text-white/40 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Project Mode Toggle */}
          {files.length >= 2 && (
            <div className="mb-4 fade-in">
              <label className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 cursor-pointer hover:border-white/20 transition-colors">
                <input
                  type="checkbox"
                  checked={projectMode}
                  onChange={(e) => setProjectMode(e.target.checked)}
                  className="w-4 h-4 accent-blue-500"
                />
                <div>
                  <p className="font-medium text-sm">
                    Скрипты с одного проекта
                  </p>
                  <p className="text-white/40 text-xs">
                    ИИ сначала проанализирует контекст между файлами, затем
                    конвертирует с учётом общих типов
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Convert Button */}
          {files.length > 0 && (
            <div className="flex justify-center mb-4 fade-in">
              <Button
                variant="default"
                size="lg"
                pill
                loading={loading}
                onClick={convert}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)]"
                rightIcon={
                  !loading ? <ArrowRight className="w-5 h-5" /> : undefined
                }
              >
                {loading
                  ? projectMode && files.length >= 2
                    ? "Анализ и конвертация..."
                    : "Конвертация..."
                  : "Конвертировать в TypeScript"}
              </Button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3 fade-in">
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-red-400">Ошибка</p>
                <p className="text-sm text-red-300/80">{error}</p>
              </div>
            </div>
          )}

          {/* Loading state — only for project mode context analysis */}
          {loading && projectMode && files.length >= 2 && (
            <div className="text-center text-white/50 text-sm fade-in">
              <p>Анализ контекста между {files.length} файлами...</p>
            </div>
          )}

          {/* Results — no code preview, just copy/download buttons */}
          {convertedFiles.length > 0 && (
            <div className="fade-in">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  Готово
                </h2>
                {convertedFiles.length > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadAll}
                    leftIcon={<Download className="w-4 h-4" />}
                  >
                    Скачать все
                  </Button>
                )}
              </div>

              <div className="grid gap-2">
                {convertedFiles.map((file, i) => (
                  <div
                    key={file.name}
                    className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <FileCode className="w-4 h-4 text-blue-400" />
                      <span className="font-medium text-sm">{file.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => copyToClipboard(file.content, i)}
                        className="text-white/40 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5"
                        title="Копировать"
                      >
                        {copiedIndex === i ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => downloadFile(file)}
                        className="text-white/40 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5"
                        title="Скачать"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
