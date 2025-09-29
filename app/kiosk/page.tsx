"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import dayjs from "dayjs";
import Image from "next/image";

type Hall = "HallA" | "HallB";
type Role = "AUDIO" | "LIGHTING" | "VIDEO";
const halls: Hall[] = ["HallA", "HallB"];
const roles: Role[] = ["AUDIO", "LIGHTING", "VIDEO"];
const roleLabel = (r: Role) =>
  ({ AUDIO: "音響", LIGHTING: "照明", VIDEO: "映像" }[r]);

type Entry = {
  id: string;
  hall: Hall;
  role: Role;
  memberNames?: string[];
  status: "IN_PROGRESS" | "DONE";
};

export default function KioskTop() {
  const [now, setNow] = useState(dayjs());
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    const t = setInterval(() => setNow(dayjs()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchStatus = async () => {
    const q = query(
      collection(db, "entries"),
      where("status", "==", "IN_PROGRESS"),
      orderBy("hall")
    );
    const snap = await getDocs(q);
    setEntries(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
  };
  useEffect(() => {
    fetchStatus();
  }, []);

  const activeBy = useMemo(() => {
    const map = new Map<string, Entry>();
    for (const e of entries) {
      map.set(`${e.hall}__${e.role}`, e);
    }
    return map;
  }, [entries]);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="flex  items-center justify-between">
        <h1 className="text-2xl font-bold">
          <Image
            src="/logo.svg" // public/logo.png
            alt="CREWロゴ"
            width={200} // 横幅（調整してね）
            height={60} // 縦幅（調整してね）
            priority // ページロード時に先読み
          />
        </h1>
        <div className="text-right">
          <div className="text-3xl font-mono tabular-nums">
            {now.format("HH:mm:ss")}
          </div>
          <div className="text-sm text-neutral-600">
            {now.format("YYYY-MM-DD")}
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-1">
        {halls.map((hall) => (
          <div key={hall} className="rounded-2xl border p-5 shadow-sm">
            <div className="mb-3 text-xl font-semibold">
              {hall === "HallA" ? "ホールA" : "ホールB"}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {roles.map((r) => {
                const e = activeBy.get(`${hall}__${r}`);
                const on = !!e;
                const count =
                  on && Array.isArray((e as any).memberNames)
                    ? (e as any).memberNames.length
                    : 0;
                return (
                  <Link
                    key={r}
                    href={`/kiosk/${hall}/${r}`}
                    className={`rounded-lg border px-3 py-2 text-center text-sm hover:shadow
                      ${
                        on
                          ? "border-emerald-500 bg-cyan-50"
                          : "border-neutral-200 bg-neutral-50"
                      }`}
                  >
                    <div className="font-medium text-black">{roleLabel(r)}</div>
                    <div
                      className={`text-xs ${
                        on ? "text-cyan-700" : "text-neutral-500"
                      }`}
                    >
                      {on ? (
                        <>
                          出勤中（{count}名）
                          <br />
                          {/* 出勤開始時刻（HH:mm） */}
                          {(() => {
                            const checkIn = (e as any)?.checkIn;
                            const d = checkIn?.toDate?.() // Firestore Timestamp
                              ? checkIn.toDate()
                              : checkIn instanceof Date
                              ? checkIn
                              : null;
                            return d ? (
                              <>
                                開始 {dayjs(d).format("HH:mm")}
                                <br />
                              </>
                            ) : null;
                          })()}
                          {/* 氏名一覧（読点区切り） */}
                          {Array.isArray((e as any).memberNames)
                            ? (e as any).memberNames.join(" / ")
                            : ""}
                        </>
                      ) : (
                        "勤務外"
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* <div className="mt-4 text-right">
        <button
          onClick={() => location.reload()}
          className="rounded-xl bg-neutral-800 px-4 py-2 text-white"
        >
          更新
        </button>
      </div> */}
    </div>
  );
}
