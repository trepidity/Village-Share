export function inviteSms({
  inviterName,
  shopName,
  role,
  inviteUrl,
}: {
  inviterName: string
  shopName: string
  role: string
  inviteUrl: string
}) {
  return `${inviterName} invited you to join ${shopName} on VillageShare as a ${role}. Accept: ${inviteUrl}`
}
