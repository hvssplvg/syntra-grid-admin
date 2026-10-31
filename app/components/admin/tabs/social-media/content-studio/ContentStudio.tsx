"use client";

// Single entry point SocialMediaTab.tsx's "content" WorkspaceView
// renders (see /Users/hvss/.claude/plans/cuddly-gathering-willow.md).
// Phase 1 always shows the Content Home screen; a later phase can turn
// this into a real router (Home vs. an open editor session) without
// SocialMediaTab.tsx needing to change at all — its only dependency is
// this one component and its props.

import { ContentHomeScreen, type ContentHomeScreenProps } from "./ContentHomeScreen";

export function ContentStudio(props: ContentHomeScreenProps) {
  return <ContentHomeScreen {...props} />;
}
