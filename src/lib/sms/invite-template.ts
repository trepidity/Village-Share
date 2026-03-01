export function inviteSms({
  inviterName,
  villageName,
  role,
  inviteUrl,
}: {
  inviterName: string
  villageName: string
  role: string
  inviteUrl: string
}) {
  return `${inviterName} invited you to join ${villageName} on VillageShare as a ${role}. Accept: ${inviteUrl}`
}
