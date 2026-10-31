import { describe, expect, it } from "vitest";
import { extractYoutubeVideoId, youtubeEmbedUrl, youtubeThumbnailUrl, youtubeWatchUrl } from "@/app/components/admin/tabs/social-media/trend-intelligence/youtube";

describe("extractYoutubeVideoId", () => {
  it("extracts from a standard watch URL", () => {
    expect(extractYoutubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts from a watch URL with extra query params", () => {
    expect(extractYoutubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s&list=xyz")).toBe("dQw4w9WgXcQ");
  });

  it("extracts from a youtu.be short link", () => {
    expect(extractYoutubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts from a youtu.be short link with trailing path", () => {
    expect(extractYoutubeVideoId("https://youtu.be/dQw4w9WgXcQ?si=abc")).toBe("dQw4w9WgXcQ");
  });

  it("extracts from a /shorts/ URL", () => {
    expect(extractYoutubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts from an /embed/ URL", () => {
    expect(extractYoutubeVideoId("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts without the www. prefix", () => {
    expect(extractYoutubeVideoId("https://youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("returns null for a non-YouTube URL", () => {
    expect(extractYoutubeVideoId("https://www.tiktok.com/@someone/video/123")).toBeNull();
  });

  it("returns null for a malformed URL", () => {
    expect(extractYoutubeVideoId("not a url")).toBeNull();
  });

  it("returns null for null/undefined", () => {
    expect(extractYoutubeVideoId(null)).toBeNull();
    expect(extractYoutubeVideoId(undefined)).toBeNull();
  });

  it("returns null for a watch URL with an invalid id length", () => {
    expect(extractYoutubeVideoId("https://www.youtube.com/watch?v=short")).toBeNull();
  });
});

describe("YouTube URL builders", () => {
  it("builds a thumbnail URL", () => {
    expect(youtubeThumbnailUrl("dQw4w9WgXcQ")).toBe("https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  });

  it("builds a watch URL", () => {
    expect(youtubeWatchUrl("dQw4w9WgXcQ")).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });

  it("builds a nocookie embed URL", () => {
    expect(youtubeEmbedUrl("dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });
});
