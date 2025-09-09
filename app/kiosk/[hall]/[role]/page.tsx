// app/kiosk/[hall]/[role]/page.tsx  ← サーバーコンポーネント（"use client" は書かない）
import ClientPage from "./ClientPage";

export const dynamicParams = false; // 未定義パラメータはビルド時に弾く

export function generateStaticParams() {
  const halls = ["HallA", "HallB"] as const;
  const roles = ["AUDIO", "LIGHTING", "VIDEO"] as const;
  return halls.flatMap((hall) => roles.map((role) => ({ hall, role })));
}

export default function Page() {
  // 中身はクライアント側に任せる
  return <ClientPage />;
}
