"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Dashboard, Sidebar, Topbar } from "@/components/dashboard-shell";
import {
  defaultProjectTarget,
  defaultWorkspaceTarget,
  sidebarTargetByKey,
  type SidebarTarget,
} from "@/components/feature-navigation";
import { ProjectWorkspace } from "@/components/project-workspace";
import { RecordDetailsProvider } from "@/components/record-details";
import type {
  ProjectDetail,
  ProjectTab,
  ProposalView,
  WorkspaceData,
  WorkspaceView,
} from "@/components/ui-types";
import {
  CompanyLibrary,
  DiscoveryCenter,
  OperationsHub,
} from "@/components/procurement-workspaces";
import {
  ErrorState,
  fetchJson,
  Toast,
  WorkspaceSkeleton,
} from "@/components/ui-kit";
import {
  ImportDialog,
  ProposalDialog,
  SourceDialog,
} from "@/components/workspace-dialogs";

export function WorkspaceApp() {
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [tab, setTab] = useState<ProjectTab>("command");
  const [workspaceView, setWorkspaceView] =
    useState<WorkspaceView>("portfolio");
  const [activeNavigationKey, setActiveNavigationKey] = useState("portfolio");
  const [featureFocus, setFeatureFocus] = useState("portfolio");
  const [aiAction, setAiAction] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [proposalOpen, setProposalOpen] = useState<ProposalView | null>(null);
  const restoredLocation = useRef(false);
  const projectRequest = useRef(0);

  const loadWorkspace = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchJson<WorkspaceData>("/api/workspace");
      setWorkspace(data);
      return data;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load the workspace.",
      );
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProject = useCallback(
    async (projectId: string, nextTab?: ProjectTab) => {
      const request = ++projectRequest.current;
      setDetailLoading(true);
      try {
        const data = await fetchJson<ProjectDetail>(
          `/api/projects/${projectId}`,
        );
        if (request !== projectRequest.current) return null;
        setDetail(data);
        setSelectedProjectId(projectId);
        if (nextTab) setTab(nextTab);
        return data;
      } catch (requestError) {
        setToast(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load the project.",
        );
        return null;
      } finally {
        if (request === projectRequest.current) setDetailLoading(false);
      }
    },
    [],
  );

  const writeLocation = useCallback(
    (target: SidebarTarget, projectId: string | null, replace = false) => {
      const url = new URL(window.location.href);
      url.searchParams.set(
        "view",
        target.scope === "workspace"
          ? (target.view ?? "portfolio")
          : (target.tab ?? "command"),
      );
      url.searchParams.set("feature", target.key);
      if (projectId) url.searchParams.set("project", projectId);
      else url.searchParams.delete("project");
      if (target.aiAction) url.searchParams.set("action", target.aiAction);
      else url.searchParams.delete("action");
      window.history[replace ? "replaceState" : "pushState"]({}, "", url);
    },
    [],
  );

  const applyTargetState = useCallback((target: SidebarTarget) => {
    setActiveNavigationKey(target.key);
    setFeatureFocus(target.feature);
    setAiAction(target.aiAction ?? null);
    if (target.view) setWorkspaceView(target.view);
    if (target.tab) setTab(target.tab);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadWorkspace(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadWorkspace]);
  const restoreLocation = useCallback(
    async (data: WorkspaceData) => {
      const url = new URL(window.location.href);
      const projectId = url.searchParams.get("project");
      const view = url.searchParams.get("view");
      const projectTabs = new Set<ProjectTab>([
        "command",
        "sources",
        "compliance",
        "capture",
        "proposal",
        "review",
      ]);
      const workspaceViews = new Set<WorkspaceView>([
        "portfolio",
        "discover",
        "library",
        "operations",
      ]);
      const requested = sidebarTargetByKey(url.searchParams.get("feature"));
      if (
        projectId &&
        data.projects.some((project) => project.id === projectId) &&
        projectTabs.has(view as ProjectTab)
      ) {
        const target =
          requested && requested.scope !== "workspace"
            ? requested
            : defaultProjectTarget(view as ProjectTab);
        applyTargetState(target);
        await loadProject(projectId, target.tab ?? (view as ProjectTab));
        return;
      }
      const workspaceTarget =
        requested && requested.scope === "workspace"
          ? requested
          : defaultWorkspaceTarget(
              workspaceViews.has(view as WorkspaceView)
                ? (view as WorkspaceView)
                : "portfolio",
            );
      projectRequest.current += 1;
      setSelectedProjectId(null);
      setDetail(null);
      applyTargetState(workspaceTarget);
    },
    [applyTargetState, loadProject],
  );

  useEffect(() => {
    if (!workspace || restoredLocation.current) return;
    restoredLocation.current = true;
    const timeout = window.setTimeout(() => void restoreLocation(workspace), 0);
    return () => window.clearTimeout(timeout);
  }, [workspace, restoreLocation]);
  useEffect(() => {
    if (!workspace) return;
    const restore = () => void restoreLocation(workspace);
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [workspace, restoreLocation]);
  useEffect(() => {
    if (!featureFocus) return;
    let attempts = 0;
    let timeout = 0;
    const focusFeature = () => {
      const element = document.querySelector<HTMLElement>(
        `[data-feature-id="${featureFocus}"]`,
      );
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
        element.focus({ preventScroll: true });
        return;
      }
      if (attempts++ < 10) timeout = window.setTimeout(focusFeature, 80);
    };
    timeout = window.setTimeout(focusFeature, 60);
    return () => window.clearTimeout(timeout);
  }, [featureFocus, workspaceView, tab, detail?.project.id]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timeout);
  }, [toast]);

  const openProject = async (
    projectId: string,
    nextTab: ProjectTab = "command",
    requestedTarget?: SidebarTarget,
  ) => {
    setMobileNav(false);
    const target = requestedTarget ?? defaultProjectTarget(nextTab);
    applyTargetState(target);
    await loadProject(projectId, target.tab ?? nextTab);
    writeLocation(target, projectId);
  };

  const handleNavigation = (target: SidebarTarget) => {
    setMobileNav(false);
    if (target.scope !== "workspace") {
      const projectId = selectedProjectId ?? workspace?.projects[0]?.id ?? null;
      if (!projectId) {
        setToast("Create or import a project before opening project features.");
        return;
      }
      void openProject(projectId, target.tab ?? "command", target);
      return;
    }
    projectRequest.current += 1;
    setSelectedProjectId(null);
    setDetail(null);
    applyTargetState(target);
    writeLocation(target, null);
  };

  const handleProjectTab = (nextTab: ProjectTab) => {
    if (!selectedProjectId) return;
    const target = defaultProjectTarget(nextTab);
    applyTargetState(target);
    writeLocation(target, selectedProjectId);
  };

  const handleAiAction = (actionKey: string) => {
    if (!selectedProjectId) return;
    const target = sidebarTargetByKey(`ai-${actionKey}`);
    if (!target) return;
    applyTargetState(target);
    writeLocation(target, selectedProjectId);
  };

  const refreshAfterMutation = async (message?: string) => {
    const projectId = selectedProjectId;
    const [, refreshedProject] = await Promise.all([
      loadWorkspace(),
      projectId ? loadProject(projectId) : Promise.resolve(null),
    ]);
    if (proposalOpen && refreshedProject) {
      setProposalOpen(
        refreshedProject.proposals.find(
          (proposal) => proposal.id === proposalOpen.id,
        ) ?? null,
      );
    }
    if (message) setToast(message);
  };

  return (
    <RecordDetailsProvider
      currentRole={workspace?.user.role ?? "viewer"}
      onMutated={(action, descriptor) =>
        refreshAfterMutation(
          action === "deleted"
            ? `${descriptor.title} removed from active records.`
            : `${descriptor.title} updated.`,
        )
      }
    >
      <main className="min-h-screen bg-[#f3f6f4] text-[#17211d]">
        <div className="mx-auto grid min-h-screen max-w-[1900px] grid-cols-1 lg:grid-cols-[296px_minmax(0,1fr)]">
          <Sidebar
            open={mobileNav}
            onClose={() => setMobileNav(false)}
            active={activeNavigationKey}
            onNavigate={handleNavigation}
            workspace={workspace}
            activeProject={
              detail
                ? {
                    title: detail.project.title,
                    solicitationNumber: detail.project.solicitationNumber,
                  }
                : null
            }
          />
          <section className="min-w-0">
            <Topbar
              workspace={workspace}
              onMenu={() => setMobileNav(true)}
              onImport={() => setImportOpen(true)}
              selectedProjectId={selectedProjectId}
              onOpenProject={(id, nextTab) => void openProject(id, nextTab)}
              onOperations={() =>
                handleNavigation(
                  sidebarTargetByKey("notifications") ??
                    defaultWorkspaceTarget("operations"),
                )
              }
            />
            {loading ? (
              <WorkspaceSkeleton />
            ) : error ? (
              <ErrorState
                message={error}
                onRetry={() => void loadWorkspace()}
              />
            ) : workspace ? (
              selectedProjectId && detail ? (
                <ProjectWorkspace
                  detail={detail}
                  workspace={workspace}
                  tab={tab}
                  setTab={handleProjectTab}
                  aiAction={aiAction}
                  onAiAction={handleAiAction}
                  loading={detailLoading}
                  onBack={() =>
                    handleNavigation(defaultWorkspaceTarget("portfolio"))
                  }
                  onAddSource={() => setSourceOpen(true)}
                  onRefresh={() =>
                    void refreshAfterMutation("Project refreshed.")
                  }
                  onMutated={refreshAfterMutation}
                  onOpenProposal={setProposalOpen}
                />
              ) : workspaceView === "discover" ? (
                <DiscoveryCenter
                  workspace={workspace}
                  onImport={() => setImportOpen(true)}
                />
              ) : workspaceView === "library" ? (
                <CompanyLibrary
                  key={featureFocus}
                  workspace={workspace}
                  onMutated={refreshAfterMutation}
                  featureFocus={featureFocus}
                />
              ) : workspaceView === "operations" ? (
                <OperationsHub
                  workspace={workspace}
                  onMutated={refreshAfterMutation}
                />
              ) : (
                <Dashboard
                  workspace={workspace}
                  onOpenProject={openProject}
                  onImport={() => setImportOpen(true)}
                />
              )
            ) : null}
          </section>
        </div>

        {importOpen && workspace ? (
          <ImportDialog
            samConfigured={workspace.integrations.samGov.configured}
            onClose={() => setImportOpen(false)}
            onCreated={async (projectId) => {
              setImportOpen(false);
              await loadWorkspace();
              await openProject(projectId, "sources");
              setToast("Project created with its own RAG namespace.");
            }}
          />
        ) : null}
        {sourceOpen && detail ? (
          <SourceDialog
            project={detail.project}
            documents={detail.documents}
            onClose={() => setSourceOpen(false)}
            onCreated={async () => {
              setSourceOpen(false);
              await refreshAfterMutation(
                "Source indexed into this project only.",
              );
            }}
          />
        ) : null}
        {proposalOpen ? (
          <ProposalDialog
            proposal={proposalOpen}
            onClose={() => setProposalOpen(null)}
          />
        ) : null}
        {toast ? <Toast message={toast} /> : null}
        <span className="sr-only" aria-live="polite">
          {detailLoading ? "Loading project" : ""}
        </span>
      </main>
    </RecordDetailsProvider>
  );
}
