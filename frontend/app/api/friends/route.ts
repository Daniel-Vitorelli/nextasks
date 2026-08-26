import { NextResponse } from "next/server";

import { requireUser } from "@/lib/server/api";
import { prisma } from "@/lib/server/prisma";
import { loadFriendProfiles } from "@/lib/server/public-profile";
import type { FriendRequestView, FriendsResponse } from "@/types/domain";

export async function GET() {
  const { user, response } = await requireUser();
  if (response) return response;

  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [{ requesterId: user.id }, { addresseeId: user.id }],
    },
    orderBy: { updatedAt: "desc" },
  });

  const accepted = friendships.filter((row) => row.status === "accepted");
  const incomingPending = friendships.filter(
    (row) => row.status === "pending" && row.addresseeId === user.id,
  );
  const outgoingPending = friendships.filter(
    (row) => row.status === "pending" && row.requesterId === user.id,
  );

  const friendIds = accepted.map((row) =>
    row.requesterId === user.id ? row.addresseeId : row.requesterId,
  );
  const profiles = await loadFriendProfiles(prisma, [
    ...friendIds,
    ...incomingPending.map((row) => row.requesterId),
    ...outgoingPending.map((row) => row.addresseeId),
  ]);

  const friends = friendIds
    .map((id) => profiles.get(id))
    .filter((profile): profile is NonNullable<typeof profile> => Boolean(profile));

  const toRequestView = (
    row: typeof friendships[number],
    otherId: string,
  ): FriendRequestView | null => {
    const profile = profiles.get(otherId);
    return profile ? { id: row.id, createdAt: row.createdAt.toISOString(), user: profile } : null;
  };

  const payload: FriendsResponse = {
    friends,
    incoming: incomingPending
      .map((row) => toRequestView(row, row.requesterId))
      .filter((view): view is FriendRequestView => view !== null),
    outgoing: outgoingPending
      .map((row) => toRequestView(row, row.addresseeId))
      .filter((view): view is FriendRequestView => view !== null),
  };

  return NextResponse.json(payload);
}
