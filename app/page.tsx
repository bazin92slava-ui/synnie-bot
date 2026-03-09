"use client";

import { useState } from "react";

type Mode = "reply" | "caption";
type NsfwLevel = "low" | "medium" | "hard";
type Platform = "instagram" | "threads" | "telegram" | "fanvue";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const platforms: Array<{ value: Platform; label: string }> = [
  { value: "instagram", label: "Instagram" },
  { value: "threads", label: "Threads" },
  { value: "telegram", label: "Telegram" },
  { value: "fanvue", label: "Fanvue" },
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

async function resizeImage(
  file: File,
  maxWidth = 900,
  quality = 0.72
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = () => {
        let { width, height } = img;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context error"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL("image/jpeg", quality);
        resolve(compressed);
      };

      img.onerror = () => reject(new Error("Image load error"));
      img.src = reader.result as string;
    };

    reader.onerror = () => reject(new Error("File read error"));
    reader.readAsDataURL(file);
  });
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("reply");
  const [nsfwLevel, setNsfwLevel] = useState<NsfwLevel>("medium");
  const [platform, setPlatform] = useState<Platform>("instagram");

  const [replyInput, setReplyInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [replyLoading, setReplyLoading] = useState(false);

  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [captionResult, setCaptionResult] = useState("");
  const [isCaptionLoading, setIsCaptionLoading] = useState(false);

  const handleReplySubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const trimmed = replyInput.trim();
    if (!trimmed || replyLoading) return;

    const userMessage: ChatMessage = {
      id: uid(),
      role: "user",
      content: trimmed,
    };

    const assistantId = uid();

    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: assistantId, role: "assistant", content: "" },
    ]);
    setReplyInput("");
    setReplyLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: trimmed,
            },
          ],
          nsfwLevel,
          platform,
          mode: "reply",
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API ${res.status}: ${errorText}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Пустой ответ от API");

      const decoder = new TextDecoder();
      let text = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        text += decoder.decode(value, { stream: true });

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId ? { ...msg, content: text } : msg
          )
        );
      }
    } catch (err) {
      const errorText =
        err instanceof Error ? err.message : "неизвестная ошибка";

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? { ...msg, content: `Ошибка: ${errorText}` }
            : msg
        )
      );
    } finally {
      setReplyLoading(false);
    }
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []);

    if (files.length === 0) return;

    if (files.length > 5) {
      alert("Максимум 5 фото для карусели");
      return;
    }

    if (files.some((f) => f.size > 5 * 1024 * 1024)) {
      alert("Каждое фото не больше 5 МБ");
      return;
    }

    try {
      const previews = await Promise.all(
        files.map((file) => resizeImage(file, 900, 0.72))
      );
      setImagePreviews(previews);
    } catch {
      alert("Ошибка обработки изображений");
    }
  };

  const generateCaption = async () => {
    if (imagePreviews.length === 0) {
      alert("Загрузи хотя бы одно фото!");
      return;
    }

    setIsCaptionLoading(true);
    setCaptionResult("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [],
          nsfwLevel,
          platform,
          mode: "caption",
          imageBase64Array: imagePreviews,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API ${res.status}: ${errorText}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Пустой ответ от API");

      const decoder = new TextDecoder();
      let text = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        text += decoder.decode(value, { stream: true });
        setCaptionResult(text);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "неизвестная ошибка";
      setCaptionResult(`Ошибка: ${message}`);
    } finally {
      setIsCaptionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 flex items-center justify-center">
      <div className="max-w-3xl w-full">
        <h1 className="text-5xl font-bold text-center mb-8 text-violet-400">
          Synnie Bot 🔥
        </h1>

        <div className="flex justify-center gap-4 mb-8 bg-zinc-900 p-2 rounded-3xl">
          <button
            onClick={() => setMode("reply")}
            className={`flex-1 py-4 rounded-2xl font-bold ${
              mode === "reply" ? "bg-violet-600" : "bg-zinc-800"
            }`}
          >
            Ответы на комментарии
          </button>
          <button
            onClick={() => setMode("caption")}
            className={`flex-1 py-4 rounded-2xl font-bold ${
              mode === "caption" ? "bg-violet-600" : "bg-zinc-800"
            }`}
          >
            Описания фото / карусели
          </button>
        </div>

        <div className="mb-8">
          <p className="text-center text-zinc-400 mb-3">Площадка</p>
          <div className="flex flex-wrap justify-center gap-3">
            {platforms.map((p) => (
              <button
                key={p.value}
                onClick={() => setPlatform(p.value)}
                className={`px-7 py-3 rounded-2xl font-medium ${
                  platform === p.value
                    ? "bg-fuchsia-600 scale-105"
                    : "bg-zinc-800 hover:bg-zinc-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-center gap-3 mb-10">
          {(["low", "medium", "hard"] as NsfwLevel[]).map((level) => (
            <button
              key={level}
              onClick={() => setNsfwLevel(level)}
              className={`px-8 py-3 rounded-2xl font-semibold ${
                nsfwLevel === level
                  ? "bg-violet-600 scale-110"
                  : "bg-zinc-800"
              }`}
            >
              {level.toUpperCase()}
            </button>
          ))}
        </div>

        {mode === "reply" && (
          <div>
            <div className="bg-zinc-900 rounded-3xl p-8 mb-8 h-[420px] overflow-y-auto">
              {messages.map((m) => (
                <div key={m.id} className="mb-6">
                  <div
                    className={`inline-block max-w-[90%] rounded-2xl px-6 py-5 whitespace-pre-wrap ${
                      m.role === "user" ? "bg-violet-600 ml-auto" : "bg-zinc-800"
                    }`}
                  >
                    {m.content || (m.role === "assistant" ? "Synnie думает..." : "")}
                  </div>
                </div>
              ))}
              {messages.length === 0 && (
                <p className="text-center text-zinc-500">
                  Вставь комментарий и получи готовый ответ
                </p>
              )}
            </div>

            <form onSubmit={handleReplySubmit} className="flex flex-col gap-4">
              <textarea
                value={replyInput}
                onChange={(e) => setReplyInput(e.target.value)}
                placeholder="Вставь комментарий..."
                className="w-full h-40 bg-zinc-900 border border-zinc-700 rounded-3xl p-6 text-lg resize-y"
              />
              <button
                type="submit"
                disabled={replyLoading || !replyInput.trim()}
                className="bg-gradient-to-r from-violet-600 to-fuchsia-600 py-5 rounded-3xl text-2xl font-bold disabled:opacity-60"
              >
                {replyLoading ? "Synnie думает..." : "Сгенерировать 2 варианта"}
              </button>
            </form>
          </div>
        )}

        {mode === "caption" && (
          <div className="bg-zinc-900 rounded-3xl p-8">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="block w-full mb-6 text-sm text-zinc-400"
            />

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
              {imagePreviews.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  className="rounded-xl border border-zinc-700 max-h-56 w-full object-cover"
                  alt={`preview ${i + 1}`}
                />
              ))}
            </div>

            <button
              onClick={generateCaption}
              disabled={isCaptionLoading || imagePreviews.length === 0}
              className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 py-5 rounded-3xl text-2xl font-bold disabled:opacity-60"
            >
              {isCaptionLoading
                ? "Synnie анализирует фото..."
                : `Сгенерировать 2 описания (${imagePreviews.length} фото)`}
            </button>

            {captionResult && (
              <div className="mt-8 bg-zinc-800 p-6 rounded-2xl whitespace-pre-wrap text-sm">
                {captionResult}
              </div>
            )}
          </div>
        )}

        <p className="text-center text-zinc-500 text-sm mt-10">
          Grok • Vision • До 5 фото • Synnie Bot
        </p>
      </div>
    </div>
  );
}
