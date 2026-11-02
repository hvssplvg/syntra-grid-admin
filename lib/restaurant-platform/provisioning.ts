import "server-only";
import { prisma } from "@/lib/prisma";
import {
  createRemoteRestaurant,
  RestaurantManagementApiError,
  type CreateRemoteRestaurantInput,
} from "@/lib/restaurant-platform/client";

export type ProvisioningPayload = Omit<CreateRemoteRestaurantInput, "requestId">;

export type AttemptProvisioningResult =
  | { ok: true; restaurantId: string; restaurantName: string; restaurantSlug: string; inviteLink: string }
  | { ok: false; error: string; code: string; retryable: boolean };

/**
 * Codes the remote API can return that mean "this exact input will never
 * succeed, don't retry with the same payload" — everything else (network
 * failure, timeout, 5xx, rate limit) is treated as retryable with the
 * SAME provisioningRequestId, never a new one.
 */
const NON_RETRYABLE_CODES = new Set(["VALIDATION_ERROR", "SLUG_CONFLICT", "REQUEST_ID_PAYLOAD_MISMATCH"]);

/**
 * Calls Restaurant Admin's management API to (re)attempt provisioning for
 * an existing RestaurantLink, using its already-persisted
 * provisioningRequestId and provisioningPayload — never a new request id,
 * so a retry can never create a second restaurant for the same local
 * record. Updates the link's state and writes an audit-log row regardless
 * of outcome.
 */
export async function attemptRemoteProvisioning(params: {
  linkId: string;
  managedSystemId: string;
  requestId: string;
  payload: ProvisioningPayload;
  actorId: string;
}): Promise<AttemptProvisioningResult> {
  try {
    const result = await createRemoteRestaurant({ requestId: params.requestId, ...params.payload });

    await prisma.$transaction([
      prisma.restaurantLink.update({
        where: { id: params.linkId },
        data: {
          externalRestaurantId: result.restaurantId,
          externalSlug: result.restaurantSlug,
          provisioningState: "PROVISIONED",
          provisioningError: null,
          remoteStatus: "ACTIVE",
          remoteStatusSyncedAt: new Date(),
          lastSyncedAt: new Date(),
        },
      }),
      prisma.auditLog.create({
        data: {
          actorId: params.actorId,
          action: "RESTAURANT_PLATFORM_PROVISIONED",
          entityType: "ManagedSystem",
          entityId: params.managedSystemId,
          metadata: { restaurantId: result.restaurantId, requestId: params.requestId },
        },
      }),
    ]);

    return { ok: true, ...result };
  } catch (error) {
    const isApiError = error instanceof RestaurantManagementApiError;
    const code = isApiError ? error.code : "NETWORK_ERROR";
    const message = error instanceof Error ? error.message : "Could not reach the Restaurant Management API.";
    const retryable = !NON_RETRYABLE_CODES.has(code);

    await prisma.$transaction([
      prisma.restaurantLink.update({
        where: { id: params.linkId },
        data: {
          // A non-retryable rejection is a terminal failure for this
          // payload; anything else stays PENDING so the same request id
          // can be safely retried once Restaurant Admin's atomic RPC is
          // live (see the known limitation noted on that app's create
          // endpoint — today's non-atomic path means a retry is not yet
          // guaranteed duplicate-free on the remote side either).
          provisioningState: retryable ? "PENDING" : "FAILED",
          provisioningError: message,
        },
      }),
      prisma.auditLog.create({
        data: {
          actorId: params.actorId,
          action: "RESTAURANT_PLATFORM_PROVISION_FAILED",
          entityType: "ManagedSystem",
          entityId: params.managedSystemId,
          metadata: { requestId: params.requestId, code, message, retryable },
        },
      }),
    ]);

    return { ok: false, error: message, code, retryable };
  }
}
