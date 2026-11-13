import { isAxiosError } from "axios";
import { apiClient } from "@/shared/api/client";
import { worksClient } from "@/features/works/api";
import { worksV2Enabled } from "@/shared/config/works";
import type { components } from "@/shared/types/openapi";

type Schema = components["schemas"];
export type PoolItem = Schema["TagPoolItemResponse-Output"];
export type TagPoolResponse = Schema["TagPoolResponse"];
export type TagRelation = Schema["TagRelationResponse"];
export type TargetTags = Schema["TargetTagsResponse"];
export type CustomTagSnapshot = Schema["CustomTagSnapshotResponse-Output"];
export type MergePreview = Schema["TagMergePreviewResponse"];
export type TagTarget = { type: "thread" | "booklist"; id: string };
const managementClient = worksV2Enabled ? worksClient : apiClient;
const managementPath = worksV2Enabled ? "/tag-management" : "/tags";
const targetClient = (target: TagTarget) => worksV2Enabled && target.type === "booklist" ? worksClient : apiClient;
const targetPath = (target: TagTarget) => `${worksV2Enabled && target.type === "booklist" ? "/tag-management" : "/tags"}/${target.type}/${encodeURIComponent(target.id)}`;

export function tagError(error: unknown): { code?: string; message: string } {
  if (isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (detail && typeof detail === "object" && !Array.isArray(detail)) {
      return { code: detail.code, message: `${detail.message || detail.code || "操作失败"}${detail.tag_id ? `（标签 ID：${detail.tag_id}）` : ""}` };
    }
    if (typeof detail === "string") return { message: detail };
  }
  return { message: error instanceof Error ? error.message : "操作失败" };
}

export const customTagsApi = {
  role: async () => (await managementClient.get<Schema["UserRole"]>(worksV2Enabled ? "/tag-management/role" : "/meta/role")).data,
  categories: async () => (await managementClient.get<Schema["TagCategoryResponse"][]>(`${managementPath}/categories`)).data,
  pool: async (params: { q: string; category?: number; source?: "custom" | "discord"; selectable: boolean; include_deleted: boolean }, signal?: AbortSignal) =>
    (await managementClient.get<TagPoolResponse>(managementPath, { params, signal })).data,
  relations: async () => (await managementClient.get<TagRelation[]>(`${managementPath}/relations`)).data,
  mergePreview: async (id: string, target_tag_id: string) =>
    (await managementClient.get<MergePreview>(`${managementPath}/${id}/merge-preview`, { params: { target_tag_id } })).data,
  merge: async (id: string, body: Schema["TagMergeRequest"]) =>
    (await managementClient.post<Schema["TagResponse"]>(`${managementPath}/${id}/merge`, body)).data,
  create: async (body: Schema["TagCreateRequest"]) => (await managementClient.post<Schema["TagResponse"]>(managementPath, body)).data,
  update: async (id: string, body: Schema["TagUpdateRequest"]) => (await managementClient.patch<Schema["TagResponse"]>(`${managementPath}/${id}`, body)).data,
  aliases: async (id: string, aliases: string[]) => (await managementClient.put(`${managementPath}/${id}/aliases`, { aliases })).data,
  remove: async (id: string) => (await managementClient.delete(`${managementPath}/${id}`)).data,
  restore: async (id: string) => (await managementClient.post(`${managementPath}/${id}/restore`)).data,
  addRelation: async (id: string, target_tag_id: string, kind: TagRelation["kind"]) =>
    (await managementClient.post(`${managementPath}/${id}/relations`, { target_tag_id, kind })).data,
  removeRelation: async (id: string, targetId: string, kind: TagRelation["kind"]) =>
    (await managementClient.delete(`${managementPath}/${id}/relations/${kind}/${targetId}`)).data,
  target: async (target: TagTarget) => (await targetClient(target).get<TargetTags>(targetPath(target))).data,
  replace: async (target: TagTarget, version: string, tag_ids: string[]) =>
    (await targetClient(target).put<TargetTags>(targetPath(target), { version, tag_ids })).data,
  propose: async (target: TagTarget, tag_id: string) =>
    (await targetClient(target).post<Schema["TagProposalResponse"]>(`${targetPath(target)}/proposals`, { tag_id })).data,
  proposals: async (target: TagTarget, review_queue: boolean, offset: number) =>
    (await targetClient(target).get<Schema["TagProposalResponse"][]>(`${targetPath(target)}/proposals`, { params: { review_queue, offset } })).data,
  review: async (target: TagTarget, id: string, approve: boolean) =>
    (await targetClient(target).put(`${targetPath(target)}/proposals/${id}`, { approve })).data,
  vote: async (target: TagTarget, bindingId: string, vote: -1 | 0 | 1) =>
    (await targetClient(target).put<TargetTags>(`${targetPath(target)}/votes/${bindingId}`, { vote })).data,
  audit: async (type: "tag" | TagTarget["type"], id: string, offset: number) =>
    (await (worksV2Enabled && type !== "thread" ? worksClient : apiClient).get<Schema["TagAuditResponse-Output"][]>(`${worksV2Enabled && type !== "thread" ? "/tag-management" : "/tags"}/${type}/${id}/audit`, { params: { offset } })).data,
};
