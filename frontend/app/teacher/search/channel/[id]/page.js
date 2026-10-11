"use client";

import { useParams } from "next/navigation";
import YouTubeChannelPage from "@/components/search/YouTubeChannelPage";

export default function TeacherYouTubeChannelPage() {
  const { id } = useParams();
  return <YouTubeChannelPage role="teacher" channelId={id} />;
}
