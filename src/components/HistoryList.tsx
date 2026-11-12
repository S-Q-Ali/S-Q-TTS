"use client";

import React from "react";
import { History, Play, Trash2, Download, Clock } from "lucide-react";
import { HistoryItem } from "@/lib/types";

interface HistoryListProps {
  history: HistoryItem[];
  onPlayItem: (item: HistoryItem) => void;
  onDeleteItem: (id: string) => void;
  onClearAll: () => void;
}

export function HistoryList({
  history,
  onPlayItem,
  onDeleteItem,
  onClearAll,
}: HistoryListProps) {
  if (history.length === 0) {
    return null;
  }

  const formatTimestamp = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <History className="h-4 w-4 text-brand-400" />
          <span>Generation History ({history.length})</span>
        </div>
        <button
          onClick={onClearAll}
          className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
        >
          <Trash2 className="h-3 w-3" />
          <span>Clear History</span>
        </button>
      </div>

      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
        {history.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/40 border border-white/5 hover:border-white/10 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => onPlayItem(item)}
                className="h-8 w-8 rounded-lg bg-brand-600/30 hover:bg-brand-600 text-brand-300 hover:text-white flex items-center justify-center transition-all shrink-0"
                title="Play Audio"
              >
                <Play className="h-4 w-4 fill-current ml-0.5" />
              </button>
              <div className="min-w-0">
                <p className="text-xs text-slate-200 truncate font-medium">
                  {item.text}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                  <span className="text-brand-300">{item.voiceLabel}</span>
                  <span>•</span>
                  <span className="flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" />
                    {formatTimestamp(item.timestamp)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <a
                href={item.audioUrl}
                download={`SQ_TTS_${item.voiceLabel}_${item.id}.mp3`}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                title="Download MP3"
              >
                <Download className="h-3.5 w-3.5" />
              </a>
              <button
                onClick={() => onDeleteItem(item.id)}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-white/5 rounded-lg transition-colors"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
