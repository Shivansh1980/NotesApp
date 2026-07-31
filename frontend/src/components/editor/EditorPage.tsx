import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CloudOff, ImagePlus, Loader2, Lock, SmilePlus, X, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { blocksApi } from "../../api/blocks.api";
import { resolveApiUrl } from "../../api/client";
import { pagesApi } from "../../api/pages.api";
import { uploadsApi } from "../../api/uploads.api";
import { useEditorStore } from "../../store/editorStore";
import type { PageUpdate } from "../../types/page.types";
import { blockText } from "../../utils/blockUtils";
import { IconButton } from "../common/IconButton";
import { BlockEditor } from "./BlockEditor";
import { PageOutline, type PageOutlineItem } from "./PageOutline";

type EditorPageProps = {
  pageId: string | null;
  workspaceId: string | null;
};

export function EditorPage({ pageId, workspaceId }: EditorPageProps) {
  const queryClient = useQueryClient();
  const saveStatus = useEditorStore((state) => state.saveStatus);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState("");
  const [coverUploading, setCoverUploading] = useState(false);
  const pageQuery = useQuery({
    queryKey: ["page", pageId],
    queryFn: () => pagesApi.get(pageId as string),
    enabled: Boolean(pageId)
  });
  const blocksQuery = useQuery({
    queryKey: ["blocks", pageId],
    queryFn: () => blocksApi.list(pageId as string),
    enabled: Boolean(pageId)
  });
  const updatePage = useMutation({
    mutationFn: (payload: PageUpdate) => pagesApi.update(pageId as string, payload),
    onSuccess(page) {
      queryClient.setQueryData(["page", page.id], page);
      queryClient.invalidateQueries({ queryKey: ["page-tree", page.workspace_id] });
    }
  });

  useEffect(() => {
    setTitle(pageQuery.data?.title ?? "");
  }, [pageQuery.data?.title]);

  if (!pageId) {
    return <section className="editor-page empty-page" />;
  }

  if (pageQuery.isLoading || blocksQuery.isLoading) {
    return (
      <section className="editor-page loading-page">
        <Loader2 className="spin" size={22} />
      </section>
    );
  }

  const page = pageQuery.data;
  if (!page) {
    return <section className="editor-page empty-page">Unable to open this page.</section>;
  }

  const hasIcon = Boolean(page.icon);
  const hasCover = Boolean(page.cover_url);
  const outlineItems: PageOutlineItem[] = (blocksQuery.data ?? [])
    .filter((block) => block.type === "heading_1" || block.type === "heading_2" || block.type === "heading_3")
    .map((block) => ({
      id: block.id,
      level: block.type === "heading_1" ? 1 : block.type === "heading_2" ? 2 : 3,
      title: blockText(block).trim()
    }));

  const patchPage = (payload: PageUpdate) => {
    queryClient.setQueryData(["page", page.id], { ...page, ...payload });
    updatePage.mutate(payload);
  };

  const uploadCover = async (file: File) => {
    if (!workspaceId) return;
    setCoverUploading(true);
    try {
      const upload = await uploadsApi.upload(workspaceId, file);
      patchPage({ cover_url: upload.public_url });
    } finally {
      setCoverUploading(false);
    }
  };

  return (
    <section
      className={[
        "editor-page",
        `page-font-${page.page_font}`,
        page.small_text ? "small-text" : "",
        hasCover ? "has-cover" : "",
        page.is_locked ? "is-locked" : ""
      ].filter(Boolean).join(" ")}
    >
      {hasCover ? (
        <div className="page-cover-shell">
          <img className="page-cover" src={resolveApiUrl(page.cover_url as string)} alt="" />
          {!page.is_locked ? (
            <div className="page-cover-actions">
              <button type="button" onClick={() => coverInputRef.current?.click()}>
                <ImagePlus size={15} />
                Change cover
              </button>
              <IconButton label="Remove cover" onClick={() => patchPage({ cover_url: null })}>
                <X size={15} />
              </IconButton>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={`editor-page-body width-${page.page_width}`}>
        {!page.is_locked ? (
          <div className="page-customize-row">
            {!hasIcon ? (
              <button type="button" onClick={() => patchPage({ icon: "\u{1F4C4}" })}>
                <SmilePlus size={15} />
                Add icon
              </button>
            ) : null}
            {!hasCover ? (
              <button type="button" onClick={() => coverInputRef.current?.click()}>
                <ImagePlus size={15} />
                Add cover
              </button>
            ) : null}
          </div>
        ) : null}

        <header className="page-header">
          <input
            className={`page-icon-input ${hasIcon ? "has-icon" : ""}`}
            aria-label="Page icon"
            title="Page icon"
            placeholder="+"
            readOnly={page.is_locked}
            value={page.icon ?? ""}
            onChange={(event) => patchPage({ icon: event.target.value.slice(0, 4) || null })}
          />
          <input
            className="page-title-input"
            aria-label="Page title"
            readOnly={page.is_locked}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => {
              if (title !== page.title) patchPage({ title: title || "Untitled" });
            }}
          />
          <SaveStatus status={saveStatus} />
        </header>

        {page.is_locked ? (
          <div className="page-lock-notice">
            <Lock size={14} />
            This page is locked
          </div>
        ) : null}

        <BlockEditor
          pageId={pageId}
          workspaceId={workspaceId}
          blocks={blocksQuery.data ?? []}
          locked={page.is_locked}
        />
      </div>

      <input
        ref={coverInputRef}
        className="visually-hidden"
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadCover(file);
          event.currentTarget.value = "";
        }}
      />
      {coverUploading ? (
        <div className="cover-upload-progress" role="status">
          <Loader2 className="spin" size={15} />
          Uploading cover...
        </div>
      ) : null}
      <PageOutline items={outlineItems} />
    </section>
  );
}

function SaveStatus({ status }: { status: "saved" | "saving" | "failed" | "offline" }) {
  const icon =
    status === "saved" ? (
      <CheckCircle2 size={15} />
    ) : status === "saving" ? (
      <Loader2 className="spin" size={15} />
    ) : status === "offline" ? (
      <CloudOff size={15} />
    ) : (
      <XCircle size={15} />
    );
  return <div className={`save-status ${status}`}>{icon}</div>;
}
