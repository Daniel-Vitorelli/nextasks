import { NextResponse } from "next/server";

import { requireUser } from "@/lib/server/api";
import { prisma } from "@/lib/server/prisma";
import { loadFriendProfiles } from "@/lib/server/public-profile";
import type { UserSearchResult } from "@/types/domain";

const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 10;

/**
 * GET /api/users/search?q= — busca pessoas por nome (contém) ou e-mail
 * (exato). Privacidade: retorna só id/nome/avatar/nível; exclui você mesmo
 * e amizades JÁ ACEITAS (pedidos pendentes aparecem com o estado sinalizado).
 */
export async function GET(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

  const query = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (query.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ results: [] satisfies UserSearchResult[] });
  }
  // E-mail só casa exato (evita vazar prefixos); nome casa por contém.
  const emailQuery = query.toLowerCase();

  const candidates = await prisma.user.findMany({
    where: {
      id: { not: user.id },
      OR: [{ name: { contains: query } }, { email: emailQuery }],
      // Amizades aceitas em qualquer direção somem da busca.
      friendshipsRequested: {
        none: { addresseeId: user.id, status: "accepted" },
      },
      friendshipsReceived: {
        none: { requesterId: user.id, status: "accepted" },
      },
    },
    select: { id: true, name: true, image: true },
    orderBy: { name: "asc" },
    take: MAX_RESULTS,
  });
  const candidateIds = candidates.map((candidate) => candidate.id);

  const [profiles, related] = await Promise.all([
    loadFriendProfiles(prisma, candidateIds),
    prisma.friendship.findMany({
      where: {
        OR: [
          { requesterId: user.id, addresseeId: { in: candidateIds } },
          { addresseeId: user.id, requesterId: { in: candidateIds } },
        ],
      },
      select: {
        requesterId: true,
        addresseeId: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  // Estado por candidato: prioriza o registro mais recente entre os dois lados.
  const latestByCandidate = new Map<string, (typeof related)[number]>();
  for (const row of related) {
    const candidateId =
      row.requesterId === user.id ? row.addresseeId : row.requesterId;
    const current = latestByCandidate.get(candidateId);
    if (!current || current.createdAt < row.createdAt) {
      latestByCandidate.set(candidateId, row);
    }
  }

  const results: UserSearchResult[] = [];
  for (const candidate of candidates) {
    const profile = profiles.get(candidate.id);
    if (!profile) continue;

    let relationStatus: UserSearchResult["relationStatus"] = "none";
    const relatedRow = latestByCandidate.get(candidate.id);
    if (relatedRow && relatedRow.status === "pending") {
      relationStatus = relatedRow.requesterId === user.id ? "outgoing" : "incoming";
    }

    results.push({
      id: profile.id,
      name: profile.name,
      image: profile.image,
      level: profile.level,
      rank: profile.rank,
      relationStatus,
    });
  }

  return NextResponse.json({ results });
}
