"use client";
import React, { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import dayjs from "dayjs";
import Image from "next/image";

type Hall = "HallA" | "HallB";
type Role = "AUDIO" | "LIGHTING" | "VIDEO";
type EntryDoc = {
  id: string;
  hall: Hall;
  role: Role;
  memberNames: string[];
  date: string; // 'YYYY-MM-DD'
  checkIn?: any; // Firestore Timestamp | Date
  checkOut?: any; // Firestore Timestamp | Date
  minutes?: number;
  status: "IN_PROGRESS" | "DONE";
};

const roleLabel = (r: Role) =>
  ({ AUDIO: "音響", LIGHTING: "照明", VIDEO: "映像" }[r]);

export default function AdminPage() {
  // デフォルトは今月
  const [yyyymm, setYyyymm] = useState<string>(dayjs().format("YYYY-MM"));
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<EntryDoc[]>([]);
  const [hallFilter, setHallFilter] = useState<"" | Hall>("");
  const [roleFilter, setRoleFilter] = useState<"" | Role>("");

  const monthRange = useMemo(() => {
    const start = dayjs(yyyymm + "-01");
    const end = start.endOf("month"); // その月の末日
    return {
      startStr: start.format("YYYY-MM-DD"),
      endStr: end.format("YYYY-MM-DD"),
      title: start.format("YYYY年M月"),
    };
  }, [yyyymm]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // date は文字列 'YYYY-MM-DD' なので、範囲フィルタが可能
      const q = query(
        collection(db, "entries"),
        where("date", ">=", monthRange.startStr),
        where("date", "<=", monthRange.endStr),
        orderBy("date") // 範囲を使うので orderBy('date') を付ける
      );
      const snap = await getDocs(q);
      let data = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      })) as EntryDoc[];

      // 追加フィルタ（任意）
      if (hallFilter) data = data.filter((r) => r.hall === hallFilter);
      if (roleFilter) data = data.filter((r) => r.role === roleFilter);

      // 安全に Date 化
      data = data.map((r) => {
        const toDate = (x: any) =>
          x?.toDate?.() ? x.toDate() : x instanceof Date ? x : undefined;
        return {
          ...r,
          checkIn: toDate(r.checkIn),
          checkOut: toDate(r.checkOut),
        };
      });

      setRows(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(); /* 初回 */
  }, []);

  const toCsvAndDownload = () => {
    // CSV ヘッダ
    const header = [
      "日付",
      "ホール",
      "役割",
      "メンバー",
      "人数",
      "開始",
      "退勤",
      "ステータス",
    ];
    const escape = (v: any) => {
      const s = (v ?? "").toString();
      // ダブルクオートと改行を考慮
      if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const fmtTime = (d?: Date) => (d ? dayjs(d).format("HH:mm") : "");

    const lines = rows.map((r) =>
      [
        r.date,
        r.hall === "HallA" ? "ホールA" : "ホールB",
        roleLabel(r.role),
        (r.memberNames || []).join("、"),
        (r.memberNames || []).length, // ★人数
        fmtTime(r.checkIn as any),
        fmtTime(r.checkOut as any),
        r.status === "DONE" ? "退勤済" : "出勤中",
      ]
        .map(escape)
        .join(",")
    );

    // Excel(JP)想定で BOM を付ける
    const csv = "\uFEFF" + [header.join(","), ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CREW_${monthRange.title}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const totalMinutes = rows.reduce((sum, r) => sum + (r.minutes || 0), 0);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-bold mb-6">
        <Image
          src="/logo.svg" // public/logo.png
          alt="CREWロゴ"
          width={200} // 横幅（調整してね）
          height={60} // 縦幅（調整してね）
          priority // ページロード時に先読み
        />
      </h1>

      {/* フィルタ */}
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-100">対象月</span>
          <input
            type="month"
            value={yyyymm}
            onChange={(e) => setYyyymm(e.target.value)}
            className="rounded border p-2 bg-gray-100 text-gray-900"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-100">ホール</span>
          <select
            value={hallFilter}
            onChange={(e) => setHallFilter(e.target.value as any)}
            className="rounded border p-2"
          >
            <option className="text-gray-600" value="">
              すべて
            </option>
            <option className="text-gray-600" value="HallA">
              ホールA
            </option>
            <option className="text-gray-600" value="HallB">
              ホールB
            </option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-100">セクション</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="rounded border p-2"
          >
            <option className="text-gray-600" value="">
              すべて
            </option>
            <option className="text-gray-600" value="AUDIO">
              音響
            </option>
            <option className="text-gray-600" value="LIGHTING">
              照明
            </option>
            <option className="text-gray-600" value="VIDEO">
              映像
            </option>
          </select>
        </label>

        <div className="flex items-end gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="rounded-lg border px-4 py-2"
          >
            {loading ? "読込中…" : "再読み込み"}
          </button>
          <button
            onClick={toCsvAndDownload}
            disabled={rows.length === 0}
            className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            CSVダウンロード
          </button>
        </div>
      </div>

      {/* 集計サマリ */}
      <div className="mb-3 text-sm text-neutral-600">
        件数: {rows.length} ／ 合計分: {totalMinutes}（約{" "}
        {Math.round(totalMinutes / 60)} 時間）
      </div>

      {/* 一覧 */}
      <div className="overflow-x-auto rounded-xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50">
            <tr className="text-left text-gray-600">
              <th className="px-3 py-2">日付</th>
              <th className="px-3 py-2">ホール</th>
              <th className="px-3 py-2">役割</th>
              <th className="px-3 py-2">メンバー</th>
              <th className="px-3 py-2">開始</th>
              <th className="px-3 py-2">退勤</th>
              <th className="px-3 py-2">人数</th>
              <th className="px-3 py-2">状態</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">{r.date}</td>
                <td className="px-3 py-2">
                  {r.hall === "HallA" ? "ホールA" : "ホールB"}
                </td>
                <td className="px-3 py-2">{roleLabel(r.role)}</td>
                <td className="px-3 py-2">
                  {(r.memberNames || []).join("、")}
                </td>
                <td className="px-3 py-2">
                  {r.checkIn ? dayjs(r.checkIn).format("HH:mm") : ""}
                </td>
                <td className="px-3 py-2">
                  {r.checkOut ? dayjs(r.checkOut).format("HH:mm") : ""}
                </td>
                <td className="px-3 py-2">
                  {new Set(r.memberNames ?? []).size}
                </td>
                <td className="px-3 py-2">
                  {r.status === "DONE" ? "退勤済" : "出勤中"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  className="px-3 py-6 text-center text-neutral-500"
                  colSpan={8}
                >
                  データがありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
