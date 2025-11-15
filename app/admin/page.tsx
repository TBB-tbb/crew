"use client";
import React, { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
  doc,
  updateDoc,
} from "firebase/firestore";
import dayjs from "dayjs";
import Image from "next/image";

// Firestore 型
type Hall = "HallA" | "HallB";
type Role = "AUDIO" | "LIGHTING" | "VIDEO";

type EntryDoc = {
  id: string;
  hall: Hall;
  role: Role;
  memberNames: string[];
  date: string;
  checkIn?: Date | null;
  checkOut?: Date | null;
  minutes?: number;
  status: "IN_PROGRESS" | "DONE";
  memo?: string; // ★ 内部コメントの追加
};

const roleLabel = (r: Role) =>
  ({ AUDIO: "音響", LIGHTING: "照明", VIDEO: "映像" }[r]);

export default function AdminPage() {
  const [yyyymm, setYyyymm] = useState(dayjs().format("YYYY-MM"));
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<EntryDoc[]>([]);
  const [hallFilter, setHallFilter] = useState<"" | Hall>("");
  const [roleFilter, setRoleFilter] = useState<"" | Role>("");

  // 編集用
  const [editing, setEditing] = useState<EntryDoc | null>(null);

  const monthRange = useMemo(() => {
    const start = dayjs(yyyymm + "-01");
    const end = start.endOf("month");
    return {
      startStr: start.format("YYYY-MM-DD"),
      endStr: end.format("YYYY-MM-DD"),
      title: start.format("YYYY年M月"),
    };
  }, [yyyymm]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "entries"),
        where("date", ">=", monthRange.startStr),
        where("date", "<=", monthRange.endStr),
        orderBy("date")
      );

      const snap = await getDocs(q);
      let data = snap.docs.map(
        (d) =>
          ({
            id: d.id,
            ...d.data(),
          } as EntryDoc)
      );

      // フィルタ
      if (hallFilter) data = data.filter((r) => r.hall === hallFilter);
      if (roleFilter) data = data.filter((r) => r.role === roleFilter);

      // checkIn / checkOut を Date 型に
      data = data.map((r) => {
        const toDate = (x: any) =>
          x?.toDate?.() ? x.toDate() : x instanceof Date ? x : null;
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
    fetchData();
  }, []);

  // 保存処理
  const saveEdit = async () => {
    if (!editing) return;
    const ref = doc(db, "entries", editing.id);

    await updateDoc(ref, {
      memberNames: editing.memberNames,
      checkIn: editing.checkIn || null,
      checkOut: editing.checkOut || null,
      memo: editing.memo ?? "", // ★ メモも保存
    });

    setEditing(null);
    fetchData(); // 更新後再取得
  };

  // CSV出力（メモ欄追加）
  const toCsvAndDownload = () => {
    const header = [
      "日付",
      "ホール",
      "役割",
      "メンバー",
      "人数",
      "開始",
      "退勤",
      "ステータス",
      "メモ", // ★ 追加
    ];

    const escape = (v: any) => {
      const s = (v ?? "").toString();
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const fmt = (d?: Date | null) =>
      d ? dayjs(d).format("HH:mm") : "";

    const lines = rows.map((r) =>
      [
        r.date,
        r.hall === "HallA" ? "ホールA" : "ホールB",
        roleLabel(r.role),
        r.memberNames.join("、"),
        (r.memberNames || []).length,
        fmt(r.checkIn),
        fmt(r.checkOut),
        r.status === "DONE" ? "退勤済" : "出勤中",
        r.memo ?? "", // ★ 追加
      ]
        .map(escape)
        .join(",")
    );

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

  const totalMinutes = rows.reduce(
    (s, r) => s + (r.minutes ?? 0), 0
  );

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-bold mb-6">
        <Image src="/logo.svg" alt="CREWロゴ" width={200} height={60} />
      </h1>

      {/* ========= フィルタ ========= */}
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm">対象月</span>
          <input
            type="month"
            value={yyyymm}
            onChange={(e) => setYyyymm(e.target.value)}
            className="rounded border p-2 bg-gray-100 text-gray-900"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm">ホール</span>
          <select
            value={hallFilter}
            onChange={(e) => setHallFilter(e.target.value as any)}
            className="rounded border p-2"
          >
            <option value="">すべて</option>
            <option value="HallA">ホールA</option>
            <option value="HallB">ホールB</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm">セクション</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="rounded border p-2"
          >
            <option value="">すべて</option>
            <option value="AUDIO">音響</option>
            <option value="LIGHTING">照明</option>
            <option value="VIDEO">映像</option>
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
            className="rounded-lg bg-black px-4 py-2 text-white"
          >
            CSV
          </button>
        </div>
      </div>

      {/* ========= サマリ ========= */}
      <div className="mb-3 text-sm text-neutral-600">
        件数: {rows.length} ／ 合計分: {totalMinutes}（約{" "}
        {Math.round(totalMinutes / 60)} 時間）
      </div>

      {/* ========= テーブル ========= */}
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
    <th className="px-3 py-2">メモ</th>
    <th className="px-3 py-2">操作</th>
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
                  {r.memberNames.join("、")}
                </td>
                <td className="px-3 py-2">
                  {r.checkIn ? dayjs(r.checkIn).format("HH:mm") : ""}
                </td>
                <td className="px-3 py-2">
                  {r.checkOut ? dayjs(r.checkOut).format("HH:mm") : ""}
                </td>
                <td className="px-3 py-2">
                  {new Set(r.memberNames).size}
                </td>
                <td className="px-3 py-2">
                  {r.status === "DONE" ? "退勤済" : "出勤中"}
                </td>
                <td className="px-3 py-2 whitespace-pre-wrap">
                  {r.memo || ""}
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => setEditing(r)}
                    className="text-blue-600 underline"
                  >
                    編集
                  </button>
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  className="px-3 py-6 text-center text-neutral-500"
                >
                  データがありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ========= 編集モーダル ========= */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white text-black p-6 rounded-xl w-[90%] max-w-lg">
            <h2 className="text-xl font-bold mb-4">
              編集（{editing.date}）
            </h2>

            {/* メンバー */}
            <label className="block mb-4">
              <span className="text-sm text-gray-700">
                メンバー（「、」区切り）
              </span>
              <input
                type="text"
                value={editing.memberNames.join("、")}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    memberNames: e.target.value
                      .split("、")
                      .map((s) => s.trim()),
                  })
                }
                className="w-full border p-2 rounded"
              />
            </label>

            {/* 開始 */}
            <label className="block mb-4">
              <span className="text-sm text-gray-700">開始時間</span>
              <input
                type="time"
                value={
                  editing.checkIn
                    ? dayjs(editing.checkIn).format("HH:mm")
                    : ""
                }
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    checkIn: e.target.value
                      ? new Date(`${editing.date}T${e.target.value}`)
                      : null,
                  })
                }
                className="w-full border p-2 rounded"
              />
            </label>

            {/* 退勤 */}
            <label className="block mb-4">
              <span className="text-sm text-gray-700">退勤時間</span>
              <input
                type="time"
                value={
                  editing.checkOut
                    ? dayjs(editing.checkOut).format("HH:mm")
                    : ""
                }
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    checkOut: e.target.value
                      ? new Date(`${editing.date}T${e.target.value}`)
                      : null,
                  })
                }
                className="w-full border p-2 rounded"
              />
            </label>

            {/* ★ メモ欄 */}
            <label className="block mb-4">
              <span className="text-sm text-gray-700">内部メモ</span>
              <textarea
                value={editing.memo ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, memo: e.target.value })
                }
                className="w-full border p-2 rounded h-24"
              />
            </label>

            {/* ボタン */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded border"
              >
                キャンセル
              </button>
              <button
                onClick={saveEdit}
                className="px-4 py-2 rounded bg-black text-white"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
