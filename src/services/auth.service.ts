// TODO: Replace with Prisma queries when DB is available
export async function validateCredentials(nickname: string, password: string) {
  // Mock validation - hardcoded for development
  if (nickname === 'admin' && password === 'PopoApp2024!') {
    return {
      userId: '1',
      nickname: 'admin',
      displayName: 'Administrador',
    };
  }
  return null;
}
