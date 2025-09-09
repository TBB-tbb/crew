"use client";
import React, { useEffect, useRef, useState } from "react";

type Props = { children: React.ReactNode };

export default function ClickSfxProvider({ children }: Props) {
  const poolRef = useRef<HTMLAudioElement[] | null>(null);
  const idxRef = useRef(0);
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem("crew_sfx_enabled");
    return v ? v === "1" : true; // 既定ON
  });

  useEffect(() => {
    // オーディオプール（同時連打でも途切れにくい）
    const createPool = () =>
      Array.from({ length: 4 }).map(() => {
        const a = new Audio("/sfx/click.mp3");
        a.preload = "auto";
        a.volume = 0.4;
        return a;
      });

    poolRef.current = createPool();

    const handler = (e: PointerEvent) => {
      if (!enabled) return;
      // a / button / role="button" に反応（disabledは除外）
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const el = t.closest('a,button,[role="button"]') as
        | HTMLAnchorElement
        | HTMLButtonElement
        | HTMLElement
        | null;
      if (!el) return;
      // 任意で無効化したい要素は data-sfx="off"
      if (el.getAttribute("data-sfx") === "off") return;
      // disabled ボタンは無視
      if ((el as HTMLButtonElement).disabled) return;

      // 再生
      const pool = poolRef.current;
      if (!pool || pool.length === 0) return;
      const i = idxRef.current % pool.length;
      const audio = pool[i];
      idxRef.current++;
      try {
        // iOS対策：ユーザー操作（pointerdown）内なので再生OK
        audio.currentTime = 0;
        // 再生中インスタンスを潰さないために clone して鳴らすのもアリ：
        // const a = audio.cloneNode(true) as HTMLAudioElement; a.play();
        audio.play().catch(() => {});
      } catch {}
    };

    // pointerdown の方が反応が早く、モバイルでも安定
    document.addEventListener("pointerdown", handler, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", handler as any);
      poolRef.current?.forEach((a) => a.pause());
      poolRef.current = null;
    };
  }, [enabled]);

  // （任意）キーボードでトグル：Alt+S でON/OFF
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "s" || e.key === "S")) {
        setEnabled((v) => {
          const nv = !v;
          localStorage.setItem("crew_sfx_enabled", nv ? "1" : "0");
          return nv;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return <>{children}</>;
}
