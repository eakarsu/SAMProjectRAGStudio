export type RequestActor = {
  id: string;
  email: string;
  name: string;
  isLocalPreview: boolean;
};

export class UnauthorizedError extends Error {}

function safeDecode(value: string | null) {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export function actorFromRequest(request: Request): RequestActor | null {
  const id = request.headers.get('oai-authenticated-user-id');
  const email = request.headers.get('oai-authenticated-user-email');
  if (id && email) {
    const encodedName = request.headers.get('oai-authenticated-user-full-name');
    const isEncoded = request.headers.get('oai-authenticated-user-full-name-encoding') === 'percent-encoded-utf-8';
    const name = isEncoded ? safeDecode(encodedName) : encodedName;
    return { id, email, name: name || email, isLocalPreview: false };
  }

  if (process.env.NODE_ENV !== 'production') {
    return {
      id: 'local-preview-user',
      email: 'preview@procurescope.local',
      name: 'Local Preview',
      isLocalPreview: true,
    };
  }
  return null;
}

export function requireActor(request: Request): RequestActor {
  const actor = actorFromRequest(request);
  if (!actor) throw new UnauthorizedError('Sign in with ChatGPT to access this private workspace.');
  return actor;
}
