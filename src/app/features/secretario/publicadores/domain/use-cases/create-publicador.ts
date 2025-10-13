import type { PublicadorRepo } from '../ports/publicador-repo';
import type { Publicador } from '../models/publicador';

export async function createPublicador(repo: PublicadorRepo, payload: Partial<Publicador>) {
  // Simple use-case: validate minimal fields then delegate to repo
  if (!payload.primer_nombre || !payload.primer_apellido) {
    throw new Error('primer_nombre y primer_apellido son requeridos');
  }
  const created = await repo.create(payload);
  return created;
}
