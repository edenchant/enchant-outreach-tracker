import { redirect } from "next/navigation";
import { listSegments } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function Home() {
  const segments = listSegments();
  if (segments.length === 0) {
    redirect("/segments/new");
  }
  redirect(`/segments/${segments[0].slug}`);
}
