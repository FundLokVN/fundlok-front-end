"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "@/lib/types";
import {
  projectsService,
  type CreateProjectPayload,
  type RepeatProjectPayload,
  type Project,
} from "@/services/projects.service";

import { projectKeys } from "@/hooks/project-keys";

// Defined in a module without "use client" so the dashboard page (a server
// component) can prefetch under the same key. See hooks/project-keys.ts.
export { projectKeys };

export function useMyProjects(enabled = true) {
  return useQuery<Project[], ApiError>({
    queryKey: projectKeys.mine(),
    queryFn: () => projectsService.getMyProjects(),
    staleTime: 2 * 60 * 1000,
    retry: false,
    enabled,
  });
}

export function usePublicProjects(enabled = true) {
  return useQuery<Project[], ApiError>({
    queryKey: projectKeys.public(),
    queryFn: () => projectsService.getPublicProjects(),
    staleTime: 2 * 60 * 1000,
    retry: false,
    enabled,
  });
}

export function useRepeatProject() {
  const queryClient = useQueryClient();

  return useMutation<Project, ApiError, RepeatProjectPayload>({
    mutationFn: (payload) => projectsService.repeatProject(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.mine() });
    },
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation<Project, ApiError, CreateProjectPayload>({
    mutationFn: (payload) => projectsService.createProject(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.mine() });
    },
  });
}
