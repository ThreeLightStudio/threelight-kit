export function projectGreeting(projectName: string): string {
  const name = projectName.trim();
  if (!name) throw new Error('Project name is required');
  return `${name} is ready. Edit src/index.ts to get started.`;
}
