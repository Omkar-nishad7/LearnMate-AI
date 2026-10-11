"use client";

import { useParams } from "next/navigation";
import YouTubeChannelPage from "@/components/search/YouTubeChannelPage";

export default function StudentYouTubeChannelPage() {
  const { id } = useParams();
  return <YouTubeChannelPage role="student" channelId={id} />;
}
