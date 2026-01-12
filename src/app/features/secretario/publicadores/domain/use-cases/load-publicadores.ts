import { PublicadorRepo, PublicadorListParams } from '../ports/publicador-repo';

export async function loadPublicadores(repo: PublicadorRepo, params?: PublicadorListParams) {
  // placeholder para lógica de dominio
  return await repo.list(params);
}
