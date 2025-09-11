"use client";
import React, { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import dayjs from "dayjs";

type Role = "AUDIO" | "LIGHTING" | "VIDEO";
type Hall = "HallA" | "HallB";
const roleLabel = (r: Role) =>
  ({ AUDIO: "音響", LIGHTING: "照明", VIDEO: "映像" }[r]);

const normalizeName = (s: string) =>
  s.normalize("NFKC").trim().replace(/\s+/g, "").toLowerCase();
const dedupeByNormalized = (names: string[]) => {
  const m = new Map<string, string>();
  for (const n of names) {
    const k = normalizeName(n);
    if (!m.has(k)) m.set(k, n);
  }
  return [...m.values()];
};
const includesByNormalized = (arr: string[], name: string) =>
  arr.some((n) => normalizeName(n) === normalizeName(name));

type OpenEntry = {
  id: string;
  hall: Hall;
  role: Role;
  memberNames: string[];
  checkIn: Timestamp;
};

export default function MemberStep() {
  const { hall, role } = useParams() as { hall: Hall; role: Role };
  const router = useRouter();

  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [freeInput, setFreeInput] = useState("");
  const [freeList, setFreeList] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [openEntry, setOpenEntry] = useState<OpenEntry | null>(null);
  const [doneModal, setDoneModal] = useState<{
    open: boolean;
    names: string[];
    time: string;
    mode: "in" | "out";
  } | null>(null);
  const inSfxRef = useRef<HTMLAudioElement | null>(null);
  const outSfxRef = useRef<HTMLAudioElement | null>(null);
  const today = dayjs().format("YYYY-MM-DD");

  useEffect(() => {
    // 事前読み込み（音量はお好みで）
    const aIn = new Audio("/sfx/checkin.mp3");
    aIn.preload = "auto";
    aIn.volume = 0.5;

    const aOut = new Audio("/sfx/checkout.mp3");
    aOut.preload = "auto";
    aOut.volume = 0.5;

    inSfxRef.current = aIn;
    outSfxRef.current = aOut;

    return () => {
      aIn.pause();
      aOut.pause();
    };
  }, []);

  useEffect(() => {
    (async () => {
      const snap = await getDocs(
        query(
          collection(db, "members"),
          where("active", "==", true),
          where("role", "==", role),
          orderBy("name")
        )
      );
      setMembers(
        snap.docs.map((d) => ({
          id: d.id,
          name: (d.data() as any).name as string,
        }))
      );
    })();
  }, [role]);

  const fetchOpen = async () => {
    const s = await getDocs(
      query(
        collection(db, "entries"),
        where("date", "==", today),
        where("hall", "==", hall),
        where("role", "==", role),
        where("status", "==", "IN_PROGRESS"),
        limit(1)
      )
    );
    setOpenEntry(
      s.empty
        ? null
        : {
            id: s.docs[0].id,
            hall: (s.docs[0].data() as any).hall,
            role: (s.docs[0].data() as any).role,
            memberNames: ((s.docs[0].data() as any).memberNames ||
              []) as string[],
            checkIn: (s.docs[0].data() as any).checkIn as Timestamp,
          }
    );
  };
  useEffect(() => {
    fetchOpen();
  }, [hall, role, today]);

  const toggle = (name: string) => {
    const exists = includesByNormalized(selected, name);
    setSelected((prev) =>
      exists
        ? prev.filter((n) => normalizeName(n) !== normalizeName(name))
        : [...prev, name]
    );
  };

  const addFree = () => {
    const n = freeInput.trim();
    if (!n) return;
    const inSel = includesByNormalized(selected, n);
    const inFree = includesByNormalized(freeList, n);
    const inMembers = members.some(
      (m) => normalizeName(m.name) === normalizeName(n)
    );
    if (inSel || inFree || inMembers) {
      setFreeInput("");
      if (!inSel) setSelected((prev) => [...prev, n]);
      return;
    }
    setFreeList((p) => [...p, n]);
    setSelected((p) => [...p, n]);
    setFreeInput("");
  };

  const persistNewMembers = async (names: string[]) => {
    for (const name of names) {
      const s = await getDocs(
        query(
          collection(db, "members"),
          where("role", "==", role),
          where("name", "==", name),
          limit(1)
        )
      );
      const already =
        !s.empty ||
        members.some((m) => normalizeName(m.name) === normalizeName(name));
      if (!already) {
        await addDoc(collection(db, "members"), {
          name,
          role,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }
  };

  const handleCheckIn = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await fetchOpen();
      if (openEntry) {
        setMessage("この役割は既に出勤中です。退勤してください。");
        return;
      }

      const names = dedupeByNormalized([...selected, ...freeList]);
      if (names.length === 0) {
        setMessage("メンバーを1名以上選択・追加してください");
        return;
      }

      await persistNewMembers(freeList);

      await addDoc(collection(db, "entries"), {
        hall,
        role,
        memberNames: names,
        date: today,
        checkIn: Timestamp.now(),
        status: "IN_PROGRESS",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // ★ ポップアップを表示（現在時刻とメンバー）
      setDoneModal({
        open: true,
        names,
        time: dayjs().format("HH:mm"),
        mode: "in",
      });
    } catch (e: any) {
      setMessage(`エラー: ${e.message ?? e}`);
    } finally {
      setLoading(false);
    }
    try {
      if (inSfxRef.current) {
        inSfxRef.current.currentTime = 0;
        void inSfxRef.current.play();
      }
    } catch {}
  };

  const handleCheckOut = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const s = await getDocs(
        query(
          collection(db, "entries"),
          where("date", "==", today),
          where("hall", "==", hall),
          where("role", "==", role),
          where("status", "==", "IN_PROGRESS"),
          limit(1)
        )
      );
      if (s.empty) {
        setMessage("出勤中のレコードがありません");
        return;
      }
      const ref = s.docs[0].ref;
      const data = s.docs[0].data();
      const d = s.docs[0].data();
      const cin = (d.checkIn as Timestamp).toDate();
      const cout = new Date();
      const checkOut = new Date();

      let diff = (cout.getTime() - cin.getTime()) / 60000;
      if (diff < 0) diff += 1440;
      await updateDoc(ref, {
        checkOut: Timestamp.fromDate(checkOut),
        minutes: Math.round(diff),
        status: "DONE",
        updatedAt: serverTimestamp(),
      });

      // ★ モーダル表示（退勤）
      setDoneModal({
        open: true,
        names: (data.memberNames || []) as string[],
        time: dayjs(checkOut).format("HH:mm"),
        mode: "out",
      });
    } catch (e: any) {
      setMessage(`エラー: ${e.message ?? e}`);
    } finally {
      setLoading(false);
    }
    try {
      if (outSfxRef.current) {
        outSfxRef.current.currentTime = 0;
        void outSfxRef.current.play();
      }
    } catch {}
  };

  const allVisibleNames = members
    .map((m) => m.name)
    .filter((n) => n.toLowerCase().includes(search.toLowerCase()));
  const selectAllVisible = () =>
    setSelected((prev) =>
      dedupeByNormalized([...prev, ...allVisibleNames, ...freeList])
    );
  const clearAll = () => setSelected([]);

  const isOpen = !!openEntry;

  return (
    <div className="mx-auto max-w-3xl p-6 select-none">
      <h1 className="mb-3 text-3xl font-bold">
        {(hall === "HallA" ? "ホールA" : "ホールB") + "／" + roleLabel(role)}
      </h1>

      {isOpen ? (
        <>
          <p className="mb-5 text-lg text-emerald-600">
            出勤中　開始 {dayjs(openEntry!.checkIn.toDate()).format("HH:mm")}／
            {openEntry!.memberNames.join("、")}
          </p>
          <div className="mt-2 flex gap-4 flex-col">
            <button
              onClick={handleCheckOut}
              disabled={loading}
              data-sfx="off"
              className="rounded-2xl bg-sky-500 w-full px-6 py-10 text-white shadow active:scale-[0.98] disabled:opacity-50"
            >
              退勤
            </button>
            <a
              href="/kiosk"
              className="rounded-2xl w-full text-center border px-6 py-4 shadow-sm active:scale-[0.98]"
            >
              トップへ
            </a>
          </div>
        </>
      ) : (
        <>
          <p className="mb-4 text-base text-neutral-100">
            発注人数以外（研修等）は数にカウントしないでください。
          </p>

          <div className="mb-5 mt-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-base text-neutral-100">出勤メンバー</span>
              <div className="flex items-center gap-3">
                {/* <span className="rounded-lg bg-neutral-100 px-3 py-1 text-sm">
                  選択中: {selected.length} 名
                </span>
                <button
                  onClick={selectAllVisible}
                  className="text-sm underline"
                >
                  全選択
                </button>
                <button onClick={clearAll} className="text-sm underline">
                  全解除
                </button> */}
              </div>
            </div>

            {/* <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-4 w-full rounded-xl border p-3 text-base"
              placeholder="名前で検索"
            /> */}

            <div className="grid grid-cols-2 gap-3">
              {members
                .filter((m) =>
                  m.name.toLowerCase().includes(search.toLowerCase())
                )
                // ← ここで並び替えを追加
                .sort((a, b) => {
                  const priorityMembers = [
                    "小川",
                    "桐生",
                    "清水",
                    "堀口",
                    "武藤",
                    "松山",
                    "菊池",
                    "針生",
                    "市瀬",
                    "横田",
                    "浅井",
                    "大石",
                  ]; // ★優先メンバーリスト
                  const ai = priorityMembers.includes(a.name) ? 0 : 1;
                  const bi = priorityMembers.includes(b.name) ? 0 : 1;
                  return ai - bi || a.name.localeCompare(b.name, "ja");
                })
                .map((m) => {
                  const checked = includesByNormalized(selected, m.name);
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggle(m.name)}
                      className={`flex min-h-[68px] items-center gap-3 rounded-2xl text-gray-500 border px-4 py-3 text-left shadow-sm active:scale-[0.99] ${
                        checked
                          ? "border-black bg-sky-500 text-white"
                          : "border-neutral-300 bg-gray-600 text-white"
                      }`}
                    >
                      <span
                        className={`grid h-5 w-5 place-items-center rounded-sm border text-[12px] ${
                          checked
                            ? "border-white text-white"
                            : "border-neutral-300 bg-white"
                        }`}
                      >
                        {checked ? "✓" : ""}
                      </span>
                      {m.name}
                    </button>
                  );
                })}
            </div>

            {selected.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {selected.map((n) => (
                  <span
                    key={normalizeName(n)}
                    className="flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-sm  bg-sky-500 text-white"
                  >
                    {n}
                    <button onClick={() => toggle(n)} className="opacity-60">
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="mt-2 flex gap-4 flex-col">
            <button
              onClick={handleCheckIn}
              disabled={loading}
              data-sfx="off"
              className="rounded-2xl bg-orange-500 w-full px-6 py-6 text-white shadow active:scale-[0.98] disabled:opacity-50"
            >
              出勤
            </button>
            <a
              href="/kiosk"
              className="rounded-2xl border text-center px-6 py-4 shadow-sm active:scale-[0.98]"
            >
              トップへ
            </a>
          </div>

          <div className="mt-6">
            <div className="mb-2 text-base text-neutral-100">
              リストにない方の出勤はこちらから登録いただけます。
            </div>
            <div className="flex gap-3">
              <input
                value={freeInput}
                onChange={(e) => setFreeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    (document.activeElement as HTMLElement)?.blur();
                    addFree();
                  }
                }}
                className="w-full rounded-xl border p-3 text-base"
                placeholder="氏名"
              />
              <button
                onClick={addFree}
                className="rounded-2xl border px-5 py-1 shadow-sm active:scale-[0.98]"
              >
                追加
              </button>
            </div>
          </div>
        </>
      )}

      {message && <p className="mt-4 text-base text-blue-700">{message}</p>}

      {doneModal?.open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="mb-2 text-xl font-bold text-gray-500">
              {doneModal.mode === "in"
                ? "出勤を登録しました"
                : "退勤を登録しました"}
            </h2>
            <p className="mb-1 text-sm text-neutral-600">
              {doneModal.mode === "in" ? "開始時刻" : "退勤時刻"}：
              <span className="font-mono">{doneModal.time}</span>
            </p>
            <p className="mb-3 text-sm text-neutral-600">
              メンバー：{doneModal.names.join("、")}
            </p>
            <p className="mb-6 text-lg text-gray-500">
              {doneModal.mode === "in"
                ? "今日もよろしくお願いします！"
                : "今日もありがとうございました！"}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setDoneModal(null);
                  router.push("/kiosk");
                }}
                className="rounded-xl bg-black px-4 py-2 text-white"
              >
                トップへ戻る
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
